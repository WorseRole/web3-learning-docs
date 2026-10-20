# Session1 · supply 里要算的数

> 晚上只啃这一页，再对着源码搜 `【学】`。  
> 代码：`KinzaFinance/KZA-lending/contracts/protocol/`  
> 主路径：`Pool.supply` → `SupplyLogic.executeSupply`

三个量不要混：

| 量 | 存在哪 | 含义 | 这一笔 supply 里怎么变 |
|----|--------|------|------------------------|
| **index** | `ReserveData.liquidityIndex` / `variableBorrowIndex` | 从储备上线起累计到「现在」的利息系数，ray | `updateState` 用**旧利率**把过去的 Δt 乘进去 |
| **rate** | `currentLiquidityRate` / `currentVariableBorrowRate` / `currentStableBorrowRate` | 年化利率，ray | `updateInterestRates` 用**本笔之后的池子**算出，给**下一次**计息用 |
| **scaled** | aToken 内部 ERC20 余额 | 份额，不是面值 | `mint` 时 `amount × RAY / index`，之后不再因利息变大 |

面值在读的时候现算，不写进余额：

```text
实际 aToken 余额 = scaledBalance × liquidityIndex / RAY
RAY = 1e27
```

`balanceOf` 若本区块还没人 `updateState`，会用 `getReserveNormalizedIncome` **现算**线性利息，不写 storage。

---

## 一笔 supply 的计算顺序

钱还没进池，index 先结算；利率用「假装钱已经进来」的流动性来算。

```text
cache
  currIndex = nextIndex = storage 里的旧指数
  currRate  = storage 里的旧年化利率

updateState                         // 结算过去
  同一区块已经更新过 → 直接 return，index 不动
  否则 nextLiquidityIndex = linear(旧 liquidityRate, Δt) × currLiquidityIndex
       nextVariableBorrowIndex = compound(旧 variableRate, Δt) × currVariableBorrowIndex
       写回 storage，lastUpdateTimestamp = now

validateSupply                      // 用 nextLiquidityIndex 把 scaled 还原成面值，再加本笔，对 supply cap

updateInterestRates(added=amount, taken=0)
  策略读 aToken 上的 underlying 余额（还没有本笔）+ added
  写出新的三档 current*Rate         // 不改 index

transferFrom 用户 → aToken 合约
mint：scaled = amount.rayDiv(nextLiquidityIndex)
```

同一区块里的第二笔 supply：`updateState` 跳过，index 不变；`updateInterestRates` 仍会按新的流动性重算 rate。

---

## 1. 存款指数（线性）

`MathUtils.calculateLinearInterest`，仅当 `currLiquidityRate != 0`。

```text
Δt = block.timestamp - lastUpdateTimestamp          // 秒
SECONDS_PER_YEAR = 365 days = 31_536_000

factor = RAY + liquidityRate × Δt / SECONDS_PER_YEAR
nextLiquidityIndex = factor × currLiquidityIndex / RAY     // rayMul，.5 向上
```

`liquidityRate` 是 ray 年化。10% 写成 `0.10 × 1e27 = 1e26`。

**手算：index 从 1 开始，年化 10%，过半年。**

```text
Δt / 年 = 0.5
factor = 1e27 + 1e26 × 0.5 = 1.05e27
旧 index = 1e27
新 index = 1.05e27
```

用户 scaled 一直是 `1000e6`（1000 USDC，6 位小数）时：

```text
存入时 index = 1e27
scaled = 1000e6 × 1e27 / 1e27 = 1000e6

半年后余额 = 1000e6 × 1.05e27 / 1e27 = 1050e6     // 1050 USDC
```

线性的含义：这段 Δt 内利率当成常数，利息 = 本金 × 年化 × 时间占比。下一次 `updateState` 才改用新 rate，**不会把新 rate 追溯到过去**。

利率为 0 时函数不会被调用，index 保持原值。初始 index 是 `RAY`（1e27），此时 scaled = 面值。

---

## 2. 可变借款指数（复利，supply 也会更新）

存款这笔交易只要池子里有可变债务，`_updateIndexes` 也会推进 `variableBorrowIndex`。用的是**旧的** `currentVariableBorrowRate`。

`calculateCompoundedInterest` 不直接做 `(1 + rate/年)^Δt`，用三项二项式：

```text
x = rate / SECONDS_PER_YEAR
n = Δt

factor ≈ RAY
       + rate × n / SECONDS_PER_YEAR
       + n(n-1)/2 × (rate² / 年²)
       + n(n-1)(n-2)/6 × (rate³ / 年³)
```

近似值略小于真复利。没有可变债务（`currScaledVariableDebt == 0`）时，即使 base rate > 0 也不推进借款指数。

稳定债务的本金不在这里乘 index。稳定债利息在 `_accrueToTreasury` 里用 `calculateCompoundedInterest(平均稳定利率, 稳定债自己的时间戳, 储备上次更新时间)` 还原。

---

## 3. mint 时的 scaled

```text
scaled = amount.rayDiv(index) = (amount × RAY + index/2) / index
```

除法四舍五入。`scaled` 折完变成 0 就 revert，避免转走了 underlying 却铸出 0 份额。

`_userState[user].additionalData` 记下该用户上次交互时的 index。事件里的「期间利息」是：

```text
balanceIncrease = scaled × 新 index / RAY − scaled × 用户自己的旧 index / RAY
```

storage 里的 scaled **不加**这段利息。利息已经含在「新 index × 旧 scaled」里。

---

## 4. 利率：利用率两条斜率

`DefaultReserveInterestRateStrategy.calculateInterestRates`。supply 传入 `liquidityAdded = amount`，`liquidityTaken = 0`。

```text
总债务 = 稳定债务面值 + 可变债务面值
可用现金 = aToken.balanceOf(underlying) + liquidityAdded - liquidityTaken

借款利用率 U = 总债务 / (可用现金 + 总债务)
```

无债务时：存款利率 = 0，可变借款利率停在 base，稳定借款利率停在稳定侧 base。

有债务、且 `U ≤ optimal`（optimal 部署时写入，常见 80% = `0.8e27`）：

```text
可变借款利率 = baseVariable + slope1 × U / optimal
稳定借款利率 = baseStable  + stableSlope1 × U / optimal
```

`U > optimal` 时，超出部分改用更陡的 slope2：

```text
excess = (U - optimal) / (1 - optimal)          // 代码里除数是 MAX_EXCESS_USAGE_RATIO
可变借款利率 = baseVariable + slope1 + slope2 × excess
```

**手算（符号用常见参数，链上以该储备策略合约的 immutable 为准）。**

```text
base = 0，slope1 = 4% = 0.04e27，optimal = 80% = 0.8e27
U = 40% = 0.4e27

可变借款利率 = 0.04e27 × 0.4 / 0.8 = 0.02e27 = 2%
```

超过拐点：

```text
slope2 = 60% = 0.60e27，U = 90% = 0.9e27
excess = (0.9 - 0.8) / 0.2 = 0.5
可变借款利率 = 0 + 4% + 60% × 0.5 = 34%
```

存款利率把借款人付的利息分给存款人，再扣协议抽成：

```text
整体借款利率 = (可变债务 × 可变利率 + 稳定债务 × 平均稳定利率) / 总债务
存款利用率   = 总债务 / (可用现金 + 总债务 + unbacked)
存款利率     = 整体借款利率 × 存款利用率 × (1 - reserveFactor)
```

`unbacked = 0` 时存款利用率等于 U。`reserveFactor` 是 bps，10% = 1000，`1 - reserveFactor` 在代码里是 `10000 - 1000`，再 `percentMul`。

接上例：U = 40%，借款利率 2%，reserveFactor = 10%，且没有稳定债、没有 unbacked：

```text
存款利率 = 2% × 0.40 × 0.90 = 0.72%
```

这个 0.72% 写成 ray 后存进 `currentLiquidityRate`。**本笔 mint 用的仍是 updateState 之后的旧 index。** 0.72% 要从下一笔交互的 Δt 起，才乘进 `liquidityIndex`。

---

## 5. 协议抽成不在 mint 里完成

`_accrueToTreasury` 在 `updateState` 里，用指数增长前后的债务差估出这段时间的借款利息，再乘 `reserveFactor`，按 **新** liquidityIndex 折成 scaled，加进 `accruedToTreasury`。真正铸给 treasury 是以后的 `mintToTreasury`。

`reserveFactor = 0` 时整段跳过，利息全在存款指数里。

supply cap 检查会把 `accruedToTreasury` 和用户 `scaledTotalSupply` 加在一起再乘 `nextLiquidityIndex`，所以未铸出的协议份额也占额度。

---

## 今晚建议的研磨顺序

1. 闭卷写出三行：`factor`、`nextLiquidityIndex`、`scaled = amount / index`。用上面「10% 半年 → 1000 变 1050」验一次。
2. 闭卷写出 `U ≤ optimal` 和 `U > optimal` 两个借款利率，再乘 `(1 - reserveFactor)` 得到存款利率。记住新 rate **不追溯**本笔 index。
3. 打开 `SupplyLogic.executeSupply`，对照第 1 节的顺序，确认 `updateInterestRates` 在 `transferFrom` 之前，以及 `liquidityAdded` 为什么要单传。
4. 打开 `_mintScaled`：scaled 存在 `super.balanceOf`，面值在 `AToken.balanceOf`。
5. 复利三项式知道「可变债用它、存款不用」即可，不必手展二项式。

源码入口（都有 `【学】`）：

- `pool/Pool.sol` `supply`
- `libraries/logic/SupplyLogic.sol` `executeSupply`
- `libraries/logic/ReserveLogic.sol` `cache` / `updateState` / `_updateIndexes` / `updateInterestRates`
- `libraries/math/MathUtils.sol` `calculateLinearInterest`
- `pool/DefaultReserveInterestRateStrategy.sol` `calculateInterestRates`
- `tokenization/base/ScaledBalanceTokenBase.sol` `_mintScaled`
- `tokenization/AToken.sol` `mint` / `balanceOf`
