# Session1 · supply 结息、校验、三档利率、铸币

> 更新：2026-11-02。接着 [利率与指数](./kinza-session1-supply-利率指数)。  
> 代码：`KinzaFinance/KZA-lending/contracts/protocol/`  
> 主路径：`Pool.supply` → `SupplyLogic.executeSupply`  
> **Session1 的 supply 主链路到文末第 7、8 节结束。**

存款指数的线性公式见上一篇。这一篇从 `_accrueToTreasury` 走到转账、`mint`、自动抵押。

完整顺序：

```text
cache
updateState
  _updateIndexes          // 用旧年化把指数推到现在
  _accrueToTreasury       // 这段借款利息 × reserveFactor，记给金库
  lastUpdateTimestamp = now
validateSupply            // 金额、三个开关、存款上限（要用新指数）
updateInterestRates       // 调 calculateInterestRates，写下一时段三档年化
safeTransferFrom          // underlying → aToken 合约
aToken.mint → _mintScaled // 铸 scaled，不是面值 amount
首次存款 → 尝试标抵押
emit Supply
```

校验失败时，`updateState` 已经写过 storage，但 `require` 让整笔交易回滚，指数不会留在链上。下一笔成功的交易从上次提交的时间重新算。

上限必须用更新后的指数，所以 `updateState` 放在 `validateSupply` 前面。用旧指数会少算「上次结息到现在」滚出来的供给，本来已经顶满的存款会被放行。金额、`active`、`frozen`、`paused` 不依赖指数，提前查也可以。

---

## 1. 金库拿的是这段借款利息的抽成

```text
这段总利息 = 这段可变债利息 + 这段稳定债利息
金库这次分到的币 = 这段总利息 × reserveFactor / 10000
accruedToTreasury += 金库这次分到的币 × RAY / nextLiquidityIndex
```

`reserveFactor` 是万分比，10% 写成 1000。`accruedToTreasury` 在 `ReserveData` 里，是 Pool 的 storage，每次累加。除以 `nextLiquidityIndex` 是因为金库和 aToken 一样记份额，以后铸给金库时再乘当时的存款指数换回币。

`reserveFactor = 0` 时整段跳过。

然后 `reserve.lastUpdateTimestamp = block.timestamp`。这是储备的结息时间，不是稳定债自己的借还时间。同一区块再进来，`updateState` 直接返回。

---

## 2. 可变债利息

存款不改可变债份额 `scaled`。同一份 `scaled` 乘新旧借款指数：

```text
之前 = scaled × currVariableBorrowIndex / RAY
现在 = scaled × nextVariableBorrowIndex / RAY
这段可变债利息 = 现在 − 之前
```

`nextVariableBorrowIndex = currVariableBorrowIndex × 复利系数`。复利系数是二项式前三项，不是直接做幂。没有可变债务时指数不推进，这段利息是 0。

---

## 3. 稳定债利息

稳定债没有全局指数。token 里存的是上次借或还时写下的本金、平均利率、以及 `_totalSupplyTimestamp`。

`cache` 一次读回来，不在 `_accrueToTreasury` 里算现在的总额：

```text
getSupplyData() =
  currPrincipalStableDebt          // super.totalSupply()，上次借还时的本金
  currTotalStableDebt              // _calcTotalSupply：本金复利到当前区块
  currAvgStableBorrowRate          // _avgStableRate
  stableDebtLastUpdateTimestamp    // _totalSupplyTimestamp
```

`_calcTotalSupply`：

```text
currTotalStableDebt = 本金 × 复利(平均稳定利率, 稳定债上次借还 → 现在)
```

`_accrueToTreasury` 要的是「储备上次结账 → 现在」的新利息。`currTotalStableDebt` 已经滚到了现在，不能拿它当「上次」：

```text
prevTotalStableDebt = 本金 × 复利(平均稳定利率, 稳定债上次借还 → 储备上次更新)
这段稳定债利息 = currTotalStableDebt − prevTotalStableDebt
```

本金乘系数得到的是上次结账时的欠款，不是利息本身。若 `prev` 直接用 `currTotalStableDebt`，相减就是 0，金库漏记。

### 两个时间不是永远相同

| 时间戳 | 谁改 |
|--------|------|
| `stableDebtLastUpdateTimestamp` | 只有稳定债 `mint` / `burn`（借入或偿还） |
| `reserve.lastUpdateTimestamp` | 每次 `updateState`，包括 `supply` |

刚发生过稳定债借还时，两者相同，系数是 1，`prev` 等于本金。中间只要有人存款、取款或借可变债，储备时间往前走，稳定债时间停住。

本金 1000、年化 10%、一年复利系数约 **1.10517**。中间不再借还稳定债：

| 时刻 | 事件 | 稳定债时间 | 储备时间 |
|------|------|------------|----------|
| 起点 | 借入 1000 | 起点 | 起点 |
| 满 1 年 | 存款 | 仍是起点 | 改成满 1 年 |
| 满 2 年 | 再存款 | 仍是起点 | 上次是满 1 年 |

满 1 年存款时，两个时间都还在起点：

```text
prev = 1000 × 复利(起点 → 起点) = 1000
curr = 1000 × 1.10517 = 1105.17
这段利息 = 105.17
```

满 2 年再存款：

```text
prev = 1000 × 复利(起点 → 满 1 年) = 1105.17
curr = 1000 × 复利(起点 → 满 2 年) = 1221.40
这段利息 = 116.23
```

存款**不**把 1105.17 写回稳定债本金。本金一直是 1000，直到下一次借入或偿还。第二年若把 1105.17 再乘一年系数，得到的是现在的总欠款（约 1221），那是 `curr`，不能当作 `prev`。

若认定两个时间永远相同、系数永远是 1，满 2 年会算出 `1221.40 − 1000 = 221.40`，第一年已经记过的 105.17 会被再记一次。

### 再借一笔时本金才叠加

满 1 年存款之后，紧接着再借 1000，利率仍是 10%，且在同一时刻：`updateState` 已结过，不再重复计息。`mint` 把已滚上的利息并进本金：

```text
新本金 = 1105.17 + 1000 = 2105.17
新平均利率 = (10% × 1105.17 + 10% × 1000) / 2105.17 = 10%
```

稳定债时间戳改成这一刻。再过一年的存款：

```text
prev = 2105.17
curr = 2105.17 × 1.10517 = 2326.56
这段利息 = 221.39
```

---

## 4. 两个稳定利率不要混

| 字段 | 是什么 | supply 结息用不用 |
|------|--------|-------------------|
| `currAvgStableBorrowRate` | 已经借出的稳定债，按本金加权的平均锁定利率 | 用。`currTotalStableDebt` 和 `prevTotalStableDebt` 都用它 |
| `currentStableBorrowRate` | 下一笔**新的**稳定借款报价 | 不用。`updateInterestRates` 会把它写进 `reserve`，等 `executeBorrow` 选择稳定利率时才读 |

单个借款人的欠款按他自己锁住的利率算，存在该用户的 `additionalData`。平均利率只给全池汇总，避免逐个用户去滚。

新借入时：

```text
新平均利率 = (旧平均利率 × 旧本金 + 这笔锁定利率 × 新借入金额) / 新本金
```

锁定利率就是当时的 `currentStableBorrowRate`。

---

## 5. validateSupply

只查这条储备能不能收钱，不看健康因子。

1. `amount != 0`
2. 从 `reserveConfiguration` 解出五个开关，存款只用三个：
   - `active` 必须为真：市场已上市
   - `frozen` 必须为假：冻结后不能再存，取款和还款还可以
   - `paused` 必须为假：暂停后用户操作都停
   - 中间两个是「能否借款」「能否借稳定利率」，这里不看
3. `getSupplyCap()` 从配置整数的第 116 到 151 位读出存款上限，单位是**整币**。0 表示不设上限。否则：

```text
现在的总供给 = (aToken 全体份额 + 金库尚未铸出的份额) × nextLiquidityIndex / RAY
加上这笔之后 = 现在的总供给 + 本次存入
上限 = supplyCap × 10^decimals
```

乘出来的是现在池子里一共有多少币，不只是利息。超过则 `SUPPLY_CAP_EXCEEDED`。

---

## 6. 三档年化从哪来

`updateInterestRates` 在转账之前调用，`liquidityAdded = amount`，`liquidityTaken = 0`。写回：

- `currentLiquidityRate`：下一时段的存款年化
- `currentStableBorrowRate`：下一笔新稳定借款的报价
- `currentVariableBorrowRate`：下一时段的可变借款年化

本笔 `updateState` 已经用旧利率推过指数。这三个新数从现在起生效，下一笔交易才拿去乘时间差。

曲线参数在部署 `DefaultReserveInterestRateStrategy` 时写进 `immutable`，`supply` 不算它们。利用率变，参数不变。一条储备用哪一套，看 `interestRateStrategyAddress`。

| 参数 | 作用 |
|------|------|
| `_baseVariableBorrowRate` | 利用率 0 时的可变借款年化 |
| `_variableRateSlope1` | 利用率从 0 到拐点，可变利率爬升的高度。稳定报价的起点也用它 |
| `_baseStableRateOffset` | 加在 `_variableRateSlope1` 上，形成稳定报价的起点 |
| `_variableRateSlope2` / `_stableRateSlope2` | 超过拐点后更陡的第二段 |
| `OPTIMAL_USAGE_RATIO` | 利用率拐点 |

没有债务时的起点：

```text
存款利率 = 0
可变借款利率 = _baseVariableBorrowRate
稳定报价 = _variableRateSlope1 + _baseStableRateOffset
```

有债务时先算比例，再套曲线。

### 有债务时先算的四个数

```text
稳定债占比 = 稳定债务 / 总债务          // 不是利率

可用现金 = underlying.balanceOf(aToken 合约) + liquidityAdded − liquidityTaken
         = aToken 合约里实际持有的 underlying + 本次存入 − 本次取出

借款利用率 U = 总债务 / (可用现金 + 总债务)

存款利用率 = 总债务 / (可用现金 + 总债务 + unbacked)
```

`balanceOf` 不是 aToken 总供应量。`supply` 时转账还没发生，所以要把本次存入加进可用现金；先转账再算会加两次。

代码里是先设起点，再 `+=` 斜率。跟源码对照时记这种写法：

```text
currentVariableBorrowRate = base
currentStableBorrowRate   = variableSlope1 + 稳定加价     // getBaseStableBorrowRate()
```

`U ≤ 拐点`：

```text
currentVariableBorrowRate += variableSlope1 × U / 拐点
currentStableBorrowRate   += stableSlope1 × U / 拐点
```

`U > 拐点`：第一段斜率一次加满，第二段按超出比例再加：

```text
excess = (U − 拐点) / (1 − 拐点)

currentVariableBorrowRate += variableSlope1 + variableSlope2 × excess
currentStableBorrowRate   += stableSlope1 + stableSlope2 × excess
```

稳定债占比若超过另一个拐点，新的稳定报价再加 `stableRateExcessOffset × 超出比例`。

两条借款年化都是**折一次的直线**，不是直线加曲线。同一利用率下，新的稳定报价高于可变借款：锁死利率的人把以后的波动留给池子，所以开价更贵。已经借到的稳定债仍按锁定利率滚；`currentStableBorrowRate` 只给下一笔新稳定借款。

存款利率不单独画曲线：

```text
整体借款年化 = (可变债务 × 刚算出的可变借款年化
              + 稳定债务 × 已有平均稳定利率)
             / 总债务

存款年化 = 整体借款年化 × 存款利用率 × (1 − reserveFactor)
```

稳定债用的是已经锁住的平均利率，不是刚算出的新报价。`supply` 不改这个平均利率。没有债务时整体借款年化按 0，存款年化是 0。

手算核对：可变债 300、可变年化 4%，稳定债 100、平均稳定利率 6%：

```text
整体借款年化 = (300 × 4% + 100 × 6%) / 400 = 4.5%
U = 40%、抽成 10% 时：存款年化 = 4.5% × 40% × 90% = 1.62%
```

`ReserveLogic.updateInterestRates` 本身不算新公式：还原可变债面值 → 调 `calculateInterestRates` → 把三档写回 `reserve` → 发事件。利率怎么来，看懂 `calculateInterestRates` 即可。

### unbacked

不是金库利息，也不是本次存款。它是桥先铸了 aToken、underlying 还没进池的差额，存在 `reserve.unbacked`。

只有 `ACLManager` 里拥有 `BRIDGE` 角色的外部合约能调 `Pool.mintUnbacked` / `backUnbacked`。桥的实现不在本仓库。普通 `supply` 不调用它。没走过桥时 `unbacked = 0`，存款利用率和借款利用率相同。

它不加进可用现金：凭空铸出的 aToken 没有对应的币。只放在存款利用率的分母里，把存款利率摊低。借款利用率仍只看真实现金和债务。

---

## 7. 转账，再铸 scaled

`updateInterestRates` 之后：

```text
underlying.safeTransferFrom(msg.sender, aToken 合约, amount)
aToken.mint(msg.sender, onBehalfOf, amount, nextLiquidityIndex)
```

池子的现金放在 aToken 合约里。`mint` 是普通外部调用，aToken 看到的 `msg.sender` 是 Pool。真正改余额在 `_mintScaled`：

```text
scaled = amount × RAY / nextLiquidityIndex
ERC20 内部余额 += scaled          // 加的是份额，不是面值
```

对外看到的面值现算，不另存利息账户：

```text
balanceOf = scaled × 当前存款指数 / RAY
```

用户上次交互时的存款指数存在 **aToken 合约** 的 `_userState[user].additionalData`。期间利息只进事件，不写进 `scaled`：

```text
期间利息 = scaled × 新指数 / RAY − scaled × additionalData / RAY
```

两笔存款示例。指数从 1 涨到 1.05：

| 时刻 | 操作 | 铸入 scaled | 总 scaled | balanceOf |
|------|------|-------------|-----------|-----------|
| 起点 | 存 1000 | 1000 / 1 = 1000 | 1000 | 1000 |
| 中间 | 不操作 | — | 1000 | 1050 |
| 再存 | 存 1000 | 1000 / 1.05 ≈ 952.38 | 1952.38 | ≈ 2050 |

第二笔存同样的 1000，因为指数已涨，得到的份额更少。事件里会把第一笔生出的 50 利息和本笔 1000 一起显示，storage 只加 952.38。

---

## 8. 首次存款才尝试标抵押

`mint` 返回铸造前 `scaled == 0` 时才进这段：

```text
validateAutomaticUseAsCollateral(...)
  通过 → userConfig.setUsingAsCollateral(reserve.id, true)
```

`LTV = 0`、隔离资产且调用者没有专用角色、用户已在隔离模式时，aToken 照样铸出，位图不置位。不是第一次存入则整段跳过。

最后 `emit Supply`。`referralCode` 只写事件。

到这里，`supply` 主链路结束：用户少了 underlying，aToken 合约多了现金，收款人多了 `scaled`，储备的指数、利率和时间戳已更新。
