# Session3 · liquidation 口播与主链路

> 更新：2026-11-18。接着 [Session2 borrow](./kinza-session2-borrow)。  
> 白话手写稿：[docs/web3/liquidationCall.txt](../web3/liquidationCall.txt)  
> 代码：`KinzaFinance/KZA-lending/contracts/protocol/`，搜 `【学】` / `Session3`。  
> 主路径：`Pool.liquidationCall` → `LiquidationLogic.executeLiquidationCall`

---

## 1.5 分钟口播（面试版）

> 清算是清算人调 `liquidationCall`，指定抵押资产、债务资产、借款人。  
> 比如用 BTC 抵押借了 USDC，HF 掉到 1 以下：清算人付 USDC，拿走 BTC（或 aBTC），多拿大约 5% 的 bonus。  
> 流程上先对**债务侧** cache、updateState 结息，再用 GenericLogic 算**账户级 HF**。HF 必须小于 1 才能清，不查 LTV。  
> Close Factor 限制单次最多还**该债务资产**多少债：HF 还大于 0.95 最多 50%，小于等于 0.95 可以 100%。这和 bonus 不是一回事。  
> 然后按预言机把还债额换成应扣抵押，乘上约 105% bonus；抵押不够就反过来少还一点债。  
> 接着 burn 借款人债务 token，把抵押转给清算人（要币就 burn aToken 出 underlying，要凭证就转 aToken），最后清算人把债务 underlying 打进债务 aToken 合约。  
> 前面任一步失败整笔回滚。操作按资产对，风控按账户。和 MetaNode 比：两边都是账户级指标，但借贷是还债换抵押加 Close Factor，永续是净值和维持保证金、常整笔强平。

---

## 30 秒收口

> HF&lt;1 触发。清算人还债务币、拿抵押加 bonus。Close Factor 限还债比例，bonus 是多拿抵押。钱最后进池，中间先改账。

---

## 和 supply / borrow 对照

| | supply | borrow | liquidate |
|--|--------|--------|-----------|
| 先结息 | 该资产 | 该资产 | **债务侧**先；抵押出金时再结抵押侧 |
| 校验 | 市场/上限 | HF&gt;1 + LTV | **HF&lt;1**，不查 LTV |
| 利率 | added | taken | 债务侧 **added=还债**；抵押出金 **taken** |
| 钱 | 用户→池 | 池→用户 | 清算人债务币→池；抵押→清算人 |

---

## 完整顺序

```text
债务侧 cache + updateState
算账户 HF
Close Factor → actualDebtToLiquidate = min(debtToCover, 总债×50%或100%)
validate：市场开关、哨兵(可略)、HF<1、抵押已启用、该币有债
读 bonus ≈105%，算应扣抵押（不够则减债）
可能清 borrowing / usingAsCollateral 位图
burn 债务（先可变后稳定）
债务侧 updateInterestRates(added)
receiveAToken? 转 aToken : 抵押侧结息+taken+burn 出 underlying
协议费 aToken → 金库（若有）
清算人 transferFrom 债务 underlying → 债务 aToken
emit LiquidationCall
```

细节与例题见 `docs/web3/liquidationCall.txt`。

---

## 易错

1. Close Factor ≠ bonus  
2. 实际清算额 ≤ 该资产总债；100% Close Factor 不保证还光  
3. 标抵押仍生息  
4. burn 债在前，付钱在后  
5. 隔离 / eMode / 哨兵主叙事可略  

---

## 源码入口

| 文件 | 关注 |
|------|------|
| `Pool.sol` `liquidationCall` | 入口参数 |
| `LiquidationLogic.executeLiquidationCall` | 整条编排 |
| `_calculateDebt` / `_calculateAvailableCollateralToLiquidate` | Close Factor / bonus |
| `ValidationLogic.validateLiquidationCall` | HF&lt;1 |
| `_burnDebtTokens` / `_burnCollateralATokens` / `_liquidateATokens` | 动账 |
