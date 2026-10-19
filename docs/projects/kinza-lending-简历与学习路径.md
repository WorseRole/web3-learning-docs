# KinzaFinance 借贷 · 简历定稿 & 按简历学习

> **用法**：先背「简历可直接粘贴」→ 只做「学习路径」里对应天的任务 → 勾完「达标自测」再改 PDF。  
> **代码根目录**：`/Users/liyanyan/Desktop/personal/Finance/KZA-lending`  
> **详述文档**：[KinzaFinance 多链借贷协议](./kinza-lending)  
> **源码中文注释**：`KZA-lending/contracts/protocol/README-学习注释.md`（精读文件内搜 `【学】`）

---

## 一、简历可直接粘贴（定稿版）

**项目名称**：KinzaFinance 多链借贷协议（Aave V3 架构）

**项目描述（2～3 行）**  
多链 DeFi 借贷市场，支持 kBTC/USDC 等多资产 **Reserve** 存借；用户与 **Pool 代理** 交互，业务逻辑在 **Logic 库** 中通过 delegatecall 执行；预言机定价 + **账户级健康因子（HF）** 风控，HF 低于 1 触发 **liquidationCall** 清算。

**职责与成果（4 条，面试按条展开）**

1. **借贷主流程**：梳理并实现级理解 `Pool.supply` / `Pool.borrow` 调用链：`SupplyLogic` / `BorrowLogic` → `ReserveLogic.updateState` → `ValidationLogic` → mint **aToken** / 债务 token，借款时 `aToken.transferUnderlyingTo` 出金。
2. **健康因子与借款校验**：精读 `GenericLogic.calculateUserAccountData`，掌握多抵押、多债务在 **base currency** 下的加权 **LTV / 清算阈值**；`validateBorrow` 约束 **可借额度** 与 **借后 HF ≥ 1**（HF 分子用 **liquidationThreshold**，不是 LTV）。
3. **清算逻辑**：精读 `LiquidationLogic.executeLiquidationCall`，掌握 **HF < 1** 触发、**Close Factor**（HF > 0.95 单次最多还 50% 债务，否则 100%）、清算人还 **债务资产** 换 **抵押 + ~5% bonus** 的资金路径。
4. **工程与升级**：理解 **一个 Pool 代理地址 + 多 Reserve**（每资产一套 aToken/DebtToken/`ReserveData`）；升级通过 `PoolAddressesProvider.setPoolImpl` 更换 **implementation**，用户入口地址不变（Immutable Admin Proxy，与 UUPS 练手项目对比能讲清差异）。

**技术栈**  
Solidity 0.8.10 · Aave V3 Core Fork · Hardhat · Chainlink Oracle · Pool 可升级代理

**简历上不要写（除非你真的做过）**  
KZA 代币排放、Voter/Minter、Subgraph、LayerZero、自己改生产参数部署 —— 面试追问容易穿帮；可说「了解生态有 KZA-1.0 / subgraph，本次深挖 lending 核心」。

---

## 二、你现在的进度（诚实锚点）

| 块 | 状态 | 说明 |
|----|------|------|
| Pool → Supply/Borrow → Logic 库 → aToken | 🟡 扫过 | 能画调用链，细节未闭卷 |
| 多 Reserve（kBTC、USDC 等） | ✅ | 一个 Pool，每资产一条 Reserve |
| 代理升级 | 🟡 | 知道换 impl；需能口述 `setPoolImpl` / `_updateImpl` |
| GenericLogic / HF | ⬜ | **下一优先级** |
| LiquidationLogic | ⬜ | 宏观懂，代码逐步未走完 |
| Scaled balance + index | ⬜ | 公式知道，未扣 `_mintScaled` |

**结论**：简历四条都能写，但 **第 2、3 条** 必须按下面路径学完再面试深挖；第 1、4 条补 1～2 天即可闭卷。

---

## 三、按简历倒推 · 5 天学习路径

每天 **3～4h**；完成当日「交付物」再在自测表打勾。

### Day A · 对齐简历第 1 条（借贷主流程）

| 顺序 | 读什么 | 关注什么 |
|------|--------|----------|
| 1 | `contracts/protocol/pool/Pool.sol` | `supply` / `borrow` / `getUserAccountData` 仅看签名与 delegate |
| 2 | `libraries/logic/SupplyLogic.sol` → `executeSupply` | `updateState` → 转 underlying 到 aToken → `mint` |
| 3 | `libraries/logic/BorrowLogic.sol` → `executeBorrow` | `validateBorrow` 入口 → mint debt → `transferUnderlyingTo` |
| 4 | `libraries/logic/ReserveLogic.sol` → `updateState` | 同 block 跳过；否则 `_updateIndexes` |
| 5 | `tokenization/AToken.sol` | `mint` / `burn` 与 Pool 的关系 |

**当日交付**：白板 **supply + borrow 各 8 步**（不看代码）；口述「存款不等于抵押，要 `setUserUseReserveAsCollateral`」。

---

### Day A+ · `cache` / `updateState` / index / 利率（supply 必读）

> 源码中文注释：`KZA-lending/contracts/protocol/libraries/logic/ReserveLogic.sol`、`types/DataTypes.sol`（搜 `【学`）。

#### 要不要看 `_updateIndexes` / `_accrueToTreasury`？

| 方法 | 优先级 | 说明 |
|------|--------|------|
| `_updateIndexes` | ★★★★ 必背 | `liquidityIndex`（存款）、`variableBorrowIndex`（浮动债）怎么随时间涨 |
| `_accrueToTreasury` | ★★☆ 了解 | `reserveFactor` 协议抽成 → `accruedToTreasury` |
| `updateInterestRates` | ★★★★ 概念 | 按利用率算**下一时段**三档 rate；**不**代替 `_updateIndexes` |

#### 为何 `cache()`？（SLOAD）

- `ReserveData` 在 **storage**，重复读贵；`ReserveCache` 在 **memory**，一笔 tx 内 snapshot。
- `cache()` 一次读出：configuration、两个 index、两个 rate、timestamp、token 地址 + variable/stable 全池债务 view。
- **`curr*` = 本笔开始时的值；`next*` 初值相同**，`updateState` / borrow mint 后 `next*` 会变；aToken.mint 用 **`nextLiquidityIndex`**。

#### `executeSupply` 里 Reserve 相关顺序

```text
reservesData[asset] → cache() → updateState → validateSupply
→ updateInterestRates(asset, liquidityAdded=amount, taken=0)
→ transferFrom → aToken.mint(..., nextLiquidityIndex)
```

#### `updateState` 三步

```text
若 lastUpdateTimestamp == block.timestamp → return（同 block 只积息一次）
① _updateIndexes
② _accrueToTreasury（reserveFactor=0 则跳过）
③ lastUpdateTimestamp = now
```

#### 存款指数 `liquidityIndex`（线性）

条件：`currLiquidityRate != 0`。

```text
Δt = now - reserveLastUpdateTimestamp
factor = RAY + currLiquidityRate × Δt / SECONDS_PER_YEAR    // calculateLinearInterest
nextLiquidityIndex = factor × currLiquidityIndex
aToken 余额 = scaledBalance × liquidityIndex / RAY
```

#### 浮动借款指数 `variableBorrowIndex`（复利近似）

条件：`currScaledVariableDebt != 0`（池里无 variable 债则不涨 index）。

```text
factor = calculateCompoundedInterest(currVariableBorrowRate, lastUpdate)  // 二项式近似 (1+x)^n
nextVariableBorrowIndex = factor × currVariableBorrowIndex
```

#### `updateInterestRates` vs `_updateIndexes`

| | `_updateIndexes` | `updateInterestRates` |
|--|------------------|------------------------|
| 作用 | 用**当前 storage 里的 rate**，把**过去 Δt** 积到 index | 用**本笔操作后**池子状态，算**将来**用的 rate |
| 调用时机 | `updateState` 内 | supply/borrow 等改流动性**之后** |
| 实现 | `MathUtils` | `DefaultReserveInterestRateStrategy`（双斜率利用率） |

**Day A+ 交付**：能白板画出 `cache → updateState → updateInterestRates → mint`；口述 linear vs compound 各用在哪一侧。

---

### Day B · 对齐简历第 2 条（HF + 校验）

| 顺序 | 读什么 | 关注什么 |
|------|--------|----------|
| 1 | `GenericLogic.sol` → `calculateUserAccountData` | 遍历 `userConfig`；只统计 **usingAsCollateral** 的 aToken；债务加总；**avgLtv / avgLiquidationThreshold** 加权 |
| 2 | `ValidationLogic.sol` → `validateBorrow` | 可借 vs LTV；模拟借后 HF；常量 `HEALTH_FACTOR_LIQUIDATION_THRESHOLD = 1e18` |
| 3 | `Pool.sol` → `getUserAccountData` | 返回值与 GenericLogic 对应关系 |

**必背公式**：

```text
实际 aToken 余额 = scaledBalance × liquidityIndex / 1e27
HF = (总抵押_base × avgLiquidationThreshold) / 总债务_base
可借_base ≈ 总抵押_base × avgLTV − 总债务_base
```

**当日交付**：闭卷答 **Q3（LTV vs 清算阈值）** + 手算 1 个双资产账户 HF（文档 [kinza-lending § Day 18](./kinza-lending#day-18-宏观--清算2026-10-15)）。

---

### Day C · 对齐简历第 3 条（清算）

| 顺序 | 读什么 | 关注什么 |
|------|--------|----------|
| 1 | `LiquidationLogic.sol` → `executeLiquidationCall` | 先算 HF → `validateLiquidationCall` |
| 2 | 同文件常量 | `DEFAULT_LIQUIDATION_CLOSE_FACTOR = 0.5e4`；`CLOSE_FACTOR_HF_THRESHOLD = 0.95e18` |
| 3 | 资金动账 | 清算人 USDC 进池；burn 债务；抵押转清算人（bonus） |

**当日交付**：**1.5 分钟清算口播**（见下文）；与 MetaNode 对比 **4 点**（触发 / 执行 / 激励 / 账户粒度）。

---

### Day D · 对齐简历第 4 条（Reserve + 升级）

| 顺序 | 读什么 | 关注什么 |
|------|--------|----------|
| 1 | `libraries/types/DataTypes.sol` → `ReserveData` | `liquidityIndex`、configuration 里 LTV/阈值 |
| 2 | `configuration/PoolAddressesProvider.sol` | `getPool` / `setPoolImpl` / `_updateImpl` |
| 3 | `pool/Pool.sol` 文件头注释 | `VersionedInitializable`；**constructor 在 impl**；用户只调代理 |
| 4 | 可选 | `ScaledBalanceTokenBase.sol` → `_mintScaled`（扣住 index） |

**当日交付**：30 秒讲 **Kinza 代理 vs FoundryStudy UUPS**（谁升级、用户地址变不变）。

---

### Day E · 面试闭环

| 任务 | 说明 |
|------|------|
| 30s 架构 × 3 遍 | 见 § 五 |
| 2min 存借 × 2 遍 | 见 § 五 |
| 1.5min 清算 × 2 遍 | 见 § 五 |
| 15 题里 Kinza 5 题 | [国庆面试一页纸](/interview/国庆面试一页纸) |
| Mock 一题 | 「ETH 跌 50% 会发生什么？」→ 预言机 → HF 批量 < 1 → 清算 bot → Close Factor |

---

## 四、达标自测（勾完再投简历深挖）

**简历第 1 条**

- [ ] 能不看代码说出 `executeSupply` / `executeBorrow` 各至少 5 步
- [ ] 能解释 borrow 的钱从哪来（aToken 合约 underlying，不是 magically mint）

**简历第 2 条**

- [ ] HF 公式手写正确，且说明用的是 **liquidationThreshold**
- [ ] 能解释「无债务时 HF = type(uint256).max」在代码哪返回

**简历第 3 条**

- [ ] Close Factor 50% / 100% 的分界 **0.95** 能脱口而出
- [ ] 能画清算三角：清算人付债务 → 借款人债务减 → 抵押减（含 bonus）

**简历第 4 条**

- [ ] 一个 Pool 地址 vs 多个 Reserve 能举例 aUSDC / akBTC
- [ ] 升级换 impl 不换 Pool 代理地址

**加分（非必须）**

- [ ] `Finance/docs/kza-learning/03-day4-5-risk-liquidation.md` 扫一遍
- [ ] Hardhat 跑通一条 supply 测试或 fork 只读 `getUserAccountData`

---

## 五、面试话术（与 MetaNode 成对背）

### 30 秒架构

> Kinza 是 Aave V3 类的多链借贷。用户只对 **Pool 代理** 调 `supply`、`borrow`、`liquidationCall`；Pool delegatecall 到 **Supply/Borrow/Liquidation Logic**，每条资产是一个 **Reserve**，有独立的 aToken 和债务 token。价格和风控在 **GenericLogic** 里算 **账户级 HF**，借款和取款都要保证 HF 安全；HF 低于 1 走清算，清算人还债务拿抵押加 bonus。

### 2 分钟存借

> 存款前 approve underlying 到 Pool。`supply` 先对该 Reserve **updateState** 更新 **liquidityIndex**，校验通过后把 underlying 转到 **aToken 合约**，给用户 mint **scaledBalance** 的 aToken。若要借出别的资产，还要把某 Reserve 的 aToken **标为 collateral**。`borrow` 同样先 updateState，**validateBorrow** 里用 **GenericLogic** 算全账户抵押和债务，检查 **LTV 可借额度** 和 **借后 HF ≥ 1**。通过后 mint **variable 或 stable debt token**，再由 aToken **transferUnderlyingTo** 把池里现金转给借款人。利息不靠遍历用户，靠 **index × scaledBalance** 复利。

### 1.5 分钟清算

> 当预言机更新或价格下跌，**HF = 抵押×加权清算阈值 / 债务** 可能低于 1。清算人调 **liquidationCall**，指定 **抵押资产、债务资产、借款人、还多少债务**。协议先验证 HF 确实小于 1，再按 **Close Factor** 限制单次最多还多少债务：HF 还高于 0.95 时最多 **50%**，否则可以 **100%**。清算人把 **债务 underlying** 打进池子，burn 借款人债务；再从借款人 **已标记抵押** 的 aToken 里扣，转给清算人 **略多于** 债务 oracle 价值的抵押，多出来的就是 **liquidation bonus**。和永续不同，这里是 **还债换抵押**，不是订单簿成交；和 MetaNode 一样都是 **账户级风控**，但借贷按 **资产对 + Close Factor** 分批清。

### 双项目 30 秒（和 MetaNode 一起）

> 一个项目 **MetaNode 永续**：链下 Kafka + 红黑树撮合，链上 **netValue vs MM**。一个 **Kinza 借贷**：链上 Pool，**HF vs 1**，scaled index 计息。两个都涉及 **账户级风控和清算**，但触发公式和执行路径不同，我可以对比讲。

---

## 六、与 MetaNode 简历的分工建议

| 维度 | MetaNode（主项目 · 全栈） | Kinza（第二项目 · 合约深挖） |
|------|---------------------------|------------------------------|
| 亮点 | Go 微服务 + EIP-712 + 链上结算 | Aave 架构 + HF + 清算 + index 计息 |
| 风控 | netValue ≥ MM | HF ≥ 1 |
| 后端 | 必讲 Kafka / matching | 不讲或一句「链上为主，subgraph 了解」 |
| 升级 | 按你实际练的 UUPS | Immutable Admin Proxy + AddressesProvider |

---

## 七、路径速查

| 资源 | 路径 |
|------|------|
| 本地合约 | `/Users/liyanyan/Desktop/personal/Finance/KZA-lending/contracts/protocol/` |
| 结构化 14 天（可选） | `/Users/liyanyan/Desktop/personal/Finance/docs/kza-learning/` |
| 本库详述 | [kinza-lending.md](./kinza-lending.md) |
| 永续对照 | [metanode-perpetual.md](./metanode-perpetual.md) |

*创建：2026-10-20 · 配合简历双项目（MetaNode + Kinza）*
