# Session2 · borrow 口播与主链路

> 更新：2026-11-16。接着 [Session1 supply](./kinza-session1-supply-结息与利率)。  
> 代码：`KinzaFinance/KZA-lending/contracts/protocol/`，搜 `【学】` / `Session2`。  
> 主路径：`Pool.borrow` → `BorrowLogic.executeBorrow`

---

## 30 秒口播

> 借款和存款一样，先对**要借的那条资产** `cache`、`updateState` 结完过去的利息。  
> 然后 `validateBorrow`：账户级扫**所有已标抵押的 aToken** 和**所有债务**，算加权 LTV、清算阈值和 HF。借前 HF 必须大于 1；加上这笔后还要满足 LTV 可借。  
> 通过后按稳定或可变 **mint 债务 token**，再 `updateInterestRates(taken=amount)`，最后从 **aToken 合约**把 underlying 转给借款人。  
> **操作按资产，风控按账户。** 钱是池子里别人存的，不是凭空 mint。

---

## 和 supply 一眼对照

| | supply | borrow |
|--|--------|--------|
| 顺序要点 | 校验轻 → 利率(added) → 转入 → mint aToken | 校验重(HF/LTV) → **先 mint 债务** → 利率(taken) → **转出** |
| 凭证 | aToken（债权） | 稳定/可变债务 token（欠条） |
| 利率参数 | added=amount, taken=0 | added=0, taken=amount |
| 钱怎么走 | 用户 → aToken | aToken → 用户 |
| 模式 | 无 | STABLE=1 或 VARIABLE=2，一笔只选一个 |

---

## 完整顺序

```text
cache
updateState                         // 与 supply 同一套：旧年化推指数 + 金库抽成
validateBorrow
  市场开关 / 预言机 sentinel / 利率模式
  borrow cap（整池总债务上限）
  隔离 / eMode（面试可一句带过）
  calculateUserAccountData → 总抵押、总债务、avgLTV、avg清算阈值、HF
  抵押≠0、LTV≠0、借前 HF>1
  (已有债_base + 本次借_base) / LTV ≤ 总抵押_base
  若稳定：开启稳定借、同币套利率限制、单笔≤现金×比例
  siloed（可略）
mint 债务（稳定锁报价 / 可变铸 scaled）
首次借该资产 → setBorrowing
updateInterestRates(0, amount)      // 下一时段三档年化；利用率通常上升
aToken.transferUnderlyingTo(user)   // 现金不够则转账失败整笔回滚
emit Borrow
```

`updateState` 细节见 Session1。下面只强调 borrow 多出来的部分。

---

## validateBorrow · 账户级公式

遍历位图里「有抵押或有借款」的**每一条储备**（不是只看正在借的 USDC）：

```text
抵押_base_i = (scaled × liquidityIndex / RAY) × 价格 / 10^decimals
总抵押 = Σ 已标抵押且清算阈值≠0 的抵押_base

债务_base_j = (可变债面值 + 稳定债面值) × 价格 / 10^decimals
总债务 = Σ 位图显示在借的债务_base

avgLTV       = Σ(抵押_i × LTV_i) / 总抵押
avg清算阈值 = Σ(抵押_i × 清算阈值_i) / 总抵押

无债：HF = max
有债：HF = (总抵押 × avg清算阈值) / 总债务     // 1e18 表示 1
```

**LTV = 能借多少；清算阈值 = HF / 清算线。HF 不用 LTV。**

代码可借检查：

```text
需要抵押 = (已有债_base + 本次借_base) / avgLTV
需要抵押 ≤ 总抵押
```

等价于：`可借 ≈ 总抵押 × avgLTV − 总债务`。

可变借款一般不在校验里验「池子有没有足够 underlying」；靠最后出金失败回滚。稳定借款会限制 `amount ≤ 可用现金 × maxStableLoanPercent`。

---

## mint 债务与出金

**稳定：** 锁定当时的 `currentStableBorrowRate`；返回 `nextTotalStableDebt`、平均稳定利率。  
**可变：** `scaled = amount × RAY / nextVariableBorrowIndex`；欠款 = `scaled × index / RAY`。

首次该资产有债：`setBorrowing(reserve.id, true)`。

利率：`taken = amount`（转账前模拟现金减少）；债务用 mint 后的 `next*`。  
出金：`transferUnderlyingTo(msg.sender, amount)`；债务可记在 `onBehalfOf`。

---

## 口播易错

1. `nextLiquidityIndex = factor.rayMul(currLiquidityIndex)`（ray 下不要漏精度约定）。  
2. borrow cap 里的稳定债总额是 **已复利到现在的面值**，不是本金 × 年化。  
3. 一笔只能选稳定或可变，不是混合。  
4. 隔离 / eMode / siloed：有代码，主叙事可不展开。  
5. Kinza 一般是钱包直调 Pool；别和 MetaNode 的 Go 链路混讲。

---

## 源码入口

| 文件 | 关注 |
|------|------|
| `pool/Pool.sol` `borrow` | 入口；模式 1=稳定 2=可变 |
| `BorrowLogic.executeBorrow` | 整条编排 |
| `ValidationLogic.validateBorrow` | HF / LTV / cap |
| `GenericLogic.calculateUserAccountData` | 账户级累加 |
| `VariableDebtToken` / `StableDebtToken` `mint` | scaled vs 锁价 |
| `AToken.transferUnderlyingTo` | 出金 |
