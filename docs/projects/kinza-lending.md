# KinzaFinance 多链借贷协议

> **简历定位**：Aave V3 架构 fork 的多链借贷协议，负责清算逻辑、健康因子计算与借贷主流程。

## 项目背景

Kinza Finance 是以 **BTC 质押收益 + 多链借贷** 为核心的 DeFi 协议：

```
用户存入 BTC
    ↓
Babylon 质押 → 铸造 kBTC（1:1 包装）
    ↓
kBTC 作为抵押资产上架 KZA-lending
    ↓
赚取：Babylon 质押奖励 + 借贷利息 + KZA 治理代币激励
```

**已部署链**：BSC · Ethereum · Mantle · opBNB

## 系统架构

```
┌─────────────────────────────────────────┐
│              KZA-lending                 │
│  Pool → Logic Libraries → Token → Oracle │
├─────────────────────────────────────────┤
│  SupplyLogic  BorrowLogic  LiquidationLogic │
│  GenericLogic  ReserveLogic  ValidationLogic │
├─────────────────────────────────────────┤
│  aToken / StableDebtToken / VariableDebtToken │
│  AaveOracle (Chainlink)                  │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│              KZA-1.0 治理                │
│  KZA → xKZA → Voter → Minter → 排放分配  │
└─────────────────────────────────────────┘
```

## 工程架构 · 用户时序 · 代理（Day 19）

> **本地 monorepo**：`~/Desktop/personal/liyanyan/KinzaFinance/KZA-lending`

### 工具链

| 项 | 说明 |
|----|------|
| 合约来源 | **Aave V3 Core fork**（`package.json`：`@aave/core-v3`） |
| 编译 / 测试 | **Hardhat** + TS（`npm run test` → `test-suites/*.spec.ts`） |
| Foundry | **本仓无** `foundry.toml`；练手用 **FoundryStudy**；读 Kinza 以 **contracts/** 为主 |
| Solidity | **0.8.10** |

### 链上拓扑（用户 vs 管理员）

```
前端/钱包
    │ approve(underlying) + 交易
    ▼
Pool 代理地址  ←── PoolAddressesProvider.getPool()  （地址不变）
    │ delegatecall
    ▼
Pool / L2Pool 实现合约  →  SupplyLogic / BorrowLogic / LiquidationLogic
    │                      ReserveLogic / ValidationLogic / GenericLogic
    ▼
每 Reserve：aToken + Stable/Variable DebtToken + ReserveData
    ▼
AaveOracle（ADDRESSES_PROVIDER.getPriceOracle()）

管理员（非普通用户）：PoolConfigurator 改 LTV / 清算阈值 / bonus 等
```

**Logic 库不对用户暴露**；只有 **Pool 代理地址**是业务入口。

### 代理与升级（≠ FoundryStudy UUPS）

| | Kinza / Aave Pool | FoundryStudy Counter |
|--|-------------------|----------------------|
| 代理类型 | **InitializableImmutableAdminUpgradeabilityProxy** | **ERC1967Proxy + UUPS** |
| 代理合约文件 | `protocol/libraries/aave-upgradeability/InitializableImmutableAdminUpgradeabilityProxy.sol` | `FoundryStudy` 内 OpenZeppelin |
| 谁升级 | **PoolAddressesProvider owner / 治理** → `setPoolImpl(newImpl)` | **Owner** 对 Proxy 调 impl 上 **`upgradeToAndCall`** |
| 用户地址 | 始终 **Pool 代理地址** | 始终 **Proxy 地址** |
| Pool 构造函数 | `constructor(IPoolAddressesProvider provider)` 写在 **实现合约**上；链上实例通过 **`initialize(address)`** 初始化 | impl `constructor` + Proxy `initialize` |

**首次部署 / 升级**（`PoolAddressesProvider._updateImpl`）：

- 尚无 proxy → `new InitializableImmutableAdminUpgradeabilityProxy` → `initialize(implementation, initialize(provider))`
- 已有 proxy → **`upgradeToAndCall(newImplementation, …)`**（`setPoolImpl`）

**L2Pool**：`contract L2Pool is Pool`，增加 `supply(bytes32 args)` 等 **压缩 calldata** 入口，内部仍调 **`supply(asset, amount, …)`**。L2 链常 **直接以 L2Pool 为 impl** 或治理 **升级 impl 到 L2Pool**；不是改用户 URL，须 **storage layout 兼容 + 治理**。主网不必为「扩展」随意升 L2Pool。

**面试 30s：** 用户对 **AddressesProvider 注册的 Pool 代理** 交互；升级换 **implementation**，不换 **Pool 代理地址**；Kinza 用 **Immutable Admin Proxy**，与 Sepolia 练的 **UUPS** 升级权限位置不同。

### 用户时序（函数级）

**前提**：对 underlying **`approve(Pool, amount)`** 或 **`supplyWithPermit`**。

| 场景 | 用户调用（Pool） | 核心 Logic |
|------|------------------|------------|
| 存款 | **`supply(asset, amount, onBehalfOf, referralCode)`** | `SupplyLogic.executeSupply` → `updateState` → mint **aToken** |
| 借款 | **`borrow(asset, amount, rateMode, referral, onBehalfOf)`** | `BorrowLogic.executeBorrow` → **`validateBorrow`**（含 **GenericLogic**）→ mint 债务 → **`aToken.transferUnderlyingTo`** |
| 还款 | **`repay(...)`** | `BorrowLogic.executeRepay` |
| 取款 | **`withdraw(...)`** | `SupplyLogic.executeWithdraw`（有债时仍看 HF） |
| 开/关抵押 | **`setUserUseReserveAsCollateral`** | 影响 HF 分子 |
| 清算 | **`liquidationCall(collateral, debt, user, debtToCover, receiveAToken)`** | `LiquidationLogic.executeLiquidationCall` |
| 只读账户 | **`getUserAccountData(user)`** | `PoolLogic` → **GenericLogic** |

**宏观调用链（不必严格线性，但面试可画）：**

```
Pool → XxxLogic → ReserveLogic.updateState
              → ValidationLogic.validate*
              → GenericLogic.calculateUserAccountData（borrow / liquidate / 视图）
              → AToken / DebtToken + ERC20 转账
```

### 合约目录（读代码顺序）

```
KinzaFinance/KZA-lending/contracts/protocol/
├── pool/Pool.sol              # 用户 API
├── pool/L2Pool.sol            # L2 压缩 calldata（可选）
├── configuration/
│   PoolAddressesProvider.sol  # 代理注册表 + setPoolImpl
│   PoolConfigurator.sol       # 管理员参数
├── libraries/logic/           # 业务库
├── tokenization/AToken.sol, VariableDebtToken.sol, base/ScaledBalanceTokenBase.sol
```

### Day 19+ 精读顺序（按时序）

1. `Pool.sol`：`supply` / `borrow` / `liquidationCall` 签名  
2. `SupplyLogic.executeSupply` · `BorrowLogic.executeBorrow`  
3. **`GenericLogic.calculateUserAccountData`**（HF）  
4. `ValidationLogic.validateBorrow`（HF>1 + LTV）  
5. `LiquidationLogic.executeLiquidationCall`  
6. `ScaledBalanceTokenBase._mintScaled`

---

## 我负责的模块

> 以下模块按「两周可学透 + 面试高频 + 和永续清算经验重合」选定。

### 模块 1：清算逻辑（重点 ⭐⭐⭐）

**文件**：`KinzaFinance/KZA-lending/contracts/protocol/libraries/logic/LiquidationLogic.sol`

| 职责 | 说明 |
|------|------|
| 触发条件 | HF < 1.0 |
| 清算执行 | 清算人偿还债务，获得抵押品 + bonus（默认 5%） |
| Close Factor | 单次最多清算 50% 债务（HF 极低时 100%） |
| 边界处理 | 清算后 HF 仍 < 1 时可继续清算 |

**调用链**：

```
Pool.liquidationCall(collateral, debt, user, debtToCover, receiveAToken)
  └─ LiquidationLogic.executeLiquidationCall()
       ├─ GenericLogic.calculateUserAccountData()  // 算 HF
       ├─ ValidationLogic.validateLiquidationCall()
       ├─ 计算清算数量、bonus
       ├─ burn 债务 token
       └─ transfer 抵押品给清算人
```

**和永续清算的对比（面试加分）**：

| | Kinza (Aave) | MetaNode (Perp) |
|---|---|---|
| 触发 | HF < 1 | netValue < MM |
| 执行 | 还债务换抵押品 | 强制按折扣价转让仓位 |
| 奖励 | liquidation bonus 5% | 固定折扣价 |
| 坏账 | 协议 reserve 兜底 | 保险基金 handleBadDebt |

### 模块 2：健康因子计算（重点 ⭐⭐⭐）

**文件**：`KinzaFinance/KZA-lending/contracts/protocol/libraries/logic/GenericLogic.sol`

**核心公式（必须能背）**：

```
总抵押价值 = Σ (aToken余额 × 预言机价格)   [仅标记为抵押的资产]

总债务价值 = Σ (稳定+可变债务 × 预言机价格)

加权平均 LTV = 各抵押资产 LTV 按价值加权

最大可借 = 总抵押 × avgLTV − 总债务

健康因子 HF = (总抵押 × avgLiquidationThreshold) / 总债务
```

**关键认知**：
- LTV = 能借多少（借款上限）
- 清算阈值 = 能撑到多危险（清算线）
- HF = 当前安全程度（1.0 是临界点）

### 模块 3：借贷主流程（次要 ⭐⭐）

**文件**：`SupplyLogic.sol` + `BorrowLogic.sol`

**Supply 流程**：

```
Pool.supply(asset, amount, onBehalfOf)
  └─ SupplyLogic.executeSupply()
       ├─ ReserveLogic.updateState()        // 更新利息指数
       ├─ ValidationLogic.validateSupply()
       ├─ ReserveLogic.updateInterestRates()
       ├─ transfer underlying → aToken 合约
       └─ AToken.mint() → scaledBalance
```

**Borrow 流程**：

```
Pool.borrow(asset, amount, rateMode, onBehalfOf)
  └─ BorrowLogic.executeBorrow()
       ├─ ReserveLogic.updateState()
       ├─ ValidationLogic.validateBorrow()
       │    └─ GenericLogic.calculateUserAccountData()  // HF 必须 ≥ 1
       ├─ mint debtToken (stable or variable)
       └─ aToken.transferUnderlyingTo(borrower)
```

### 模块 4：Scaled Balance 计息机制（理解 ⭐⭐）

**文件**：`ScaledBalanceTokenBase.sol` + `ReserveLogic.sol`

```
实际余额 = scaledBalance × liquidityIndex / 1e27

每次交互时 updateState()：
  liquidityIndex *= (1 + liquidityRate × Δt)
  variableBorrowIndex *= (1 + variableBorrowRate × Δt)
```

**为什么用 scaled balance**：避免每次计息都遍历所有用户，O(1) 更新全局 index。

### 模块 5：风险参数配置（了解 ⭐）

**文件**：`PoolConfigurator.sol`

管理员可配置：
- LTV（贷款价值比）
- liquidationThreshold（清算阈值）
- liquidationBonus（清算奖励）
- reserveFactor（协议抽成比例）
- borrowingEnabled / isActive / isFrozen

## 技术栈

Solidity 0.8.10 · Hardhat · Foundry · Chainlink Oracle · The Graph · LayerZero

## 三个技术难点（面试必讲）

### 难点 1：Scaled Balance + Index 计息

**问题**：如果每个 block 都给所有 aToken 持有者加利息，gas 不可接受。

**解法**：全局 `liquidityIndex` 只增不减，用户 `scaledBalance` 不变，实际余额 = scaled × index。

### 难点 2：HF 计算的边界

**问题**：多资产抵押 + 多资产借款，如何算加权 LTV 和 HF？

**解法**：`GenericLogic.calculateUserAccountData()` 遍历用户所有 reserve，按预言机价格换算到 base currency，加权平均。

**面试陷阱**：HF 公式里用的是 **liquidationThreshold**，不是 LTV。

### 难点 3：清算的 Close Factor

**问题**：为什么不能一次清算全部债务？

**解法**：
- 正常：Close Factor = 50%，防止清算人一次性拿走所有抵押品
- HF < 0.95：Close Factor = 100%，加速恢复协议健康

## 面试必背 3 题

### Q1：scaled balance 怎么计息？

> aToken 用 scaledBalance 存储，全局 liquidityIndex 每次交互时按 liquidityRate 递增。实际余额 = scaledBalance × index / 1e27。用户不交互也能自动增值。

### Q2：清算触发条件和执行流程？

> HF < 1 时触发。清算人调 `liquidationCall`，偿还部分债务（Close Factor 限制），获得抵押品 + 5% bonus。如果清算后 HF 仍 < 1，可继续清算。

### Q3：LTV 和清算阈值的区别？

> LTV 决定能借多少（借款上限），清算阈值决定多危险会被清算（安全线）。LTV < liquidationThreshold，中间差值是缓冲带。HF 用的是 liquidationThreshold，不是 LTV。

---

## Day 18 · 宏观 + 清算（2026-10-15）

> **本地 monorepo**：`~/Desktop/personal/liyanyan/KinzaFinance` · 合约深挖 **`KZA-lending/`**（与文档中的 `KZA-lending` 同仓）。

### 用户路径（宏观）

| 路径 | 用户做什么 | 系统做什么 |
|------|------------|------------|
| **只存不借** | `Pool.supply` → 拿 **aToken**（如 aUSDC） | underlying 进池；**liquidityIndex** 计息（**浮动存款利率**，非「稳定存息」） |
| **抵押 + 借款** | 某资产 aToken **标为 collateral** → `borrow` 其他/同资产 | `updateState` → **可借额度（avgLTV）** + **借后 HF≥1** → mint **债务 token**，池子转出 underlying |
| **退出** | `repay` / `withdraw` | burn 债务 / aToken；有债时 withdraw 须 **HF 仍安全** |
| **被清算** | 被动 | **HF&lt;1** 时清算人 `liquidationCall` |

**存款 vs 抵押**：supply 必得 aToken；是否计入 HF 取决于 **该 Reserve 是否 `usingAsCollateral`**。可「USDC 只存不吃抵押 + BTC 作抵押借 USDC」。同一 Reserve 通常 **整笔余额要么算抵押要么不算**，不是同一 aToken 里切 50% 抵押。

### 架构一句话

```
用户 → Pool.sol → Supply/Borrow/Liquidation Logic → 每资产一条 Reserve
                → aToken / Stable|Variable DebtToken → Oracle（base currency）
```

- **aBTC、aUSDC**：不同 **Reserve** 的不同 aToken 合约，机制相同；**一个 Pool 地址，多 Reserve**。
- **协议收入**：主要是 **reserve factor**（从借款利息抽成）+ 可选 **liquidation protocol fee**；不是 CEX 式「每笔交易费」。

### 账户级 HF（与永续对齐）

- **Kinza**：同一 Pool 下，用户 **所有作抵押的 aToken + 所有债务 token**，预言机换算后 → **一个 HF**。
- **MetaNode 永续**：用户 **各市场仓位** 合成 → **netValue vs MM**。
- **共同点**：指标都是 **账户级**；**不同点**：借贷清算按 **`collateralAsset + debtAsset` 分笔** + Close Factor；永续常 **整笔 trade / 强平 bundle**。

```text
HF = (总抵押_base × avgLiquidationThreshold) / 总债务_base   // 无债时 HF = max
可借 ≈ 总抵押_base × avgLTV − 总债务_base                    // borrow 校验用 LTV + 借后 HF
```

### 清算（口播定稿）

**条件**：**HF &lt; 1**（账户级）。清算人 **无需 supply/抵押**，用 **债务 underlying**（如 USDC）替借款人还款。

| 参数 | 作用对象 | 规则 |
|------|----------|------|
| **Close Factor 50%** | **债务** | HF **&gt; 0.95** 时，单次最多还该资产债务的 **50%** |
| **Close Factor 100%** | **债务** | HF **≤ 0.95** 时，单次最多 **100%** |
| **liquidationBonus ~105%** | **抵押** | 按 oracle 换算「刚够覆盖本次还款」的抵押量，再 **多约 5%** |

**资金流向**：

1. 清算人 `transferFrom` **USDC** → 债务 Reserve 的 **aToken 合约** + `handleRepayment` → **burn 借款人债务**。
2. 从借款人 **作抵押的 aBTC** 扣减（burn 或 `transferOnLiquidation`）→ 清算人拿 **underlying BTC**（`receiveAToken=false`）或 **aBTC**（`true`）。
3. **Bonus 从借款人抵押里扣**，不是协议增发；借款人 **债务减少 + 抵押多减 bonus 那一段**。

**口算例题（示意）**：HF=0.98 → 最多还 **50% 债务**；付 5000 USDC 可拿约 **值 5250 USD 的 BTC**（105%，扣协议费前）。多次清算直到 HF≥1 或抵押/债务清空。

**清算人盈亏**：链上 bonus 是 **多拿抵押**；**立刻按市价卖掉**且价接近 oracle 时 **直接受益**；若 **抵押跌价 / 滑点 / gas / oracle 与市价偏离** 则可能不赚钱。Bot 通常 **收到即对冲**。

### vs MetaNode 清算（简表）

| | Kinza 借贷 | MetaNode 永续 |
|--|------------|---------------|
| 触发 | HF &lt; 1 | netValue &lt; MM |
| 激励形式 | **多拿 ~5% 抵押**（quantity bonus） | **折扣价接盘仓位**（price） |
| 清算人付出 | **债务资产**（USDC） | 保证金/按规则接盘 |
| 可清算范围 | 仅 **已标记抵押** 的 Reserve 余额 | 账户下相关仓位 |

### Day 18–19 进度

- [x] 宏观：supply / 抵押 / borrow / HF 账户级 / aToken per Reserve
- [x] 清算：Close Factor vs bonus、清算人角色、aToken 在清算中的动账
- [x] 与永续对比：账户级指标 + 执行粒度
- [x] Pool → Logic 时序扫读；文档 § **工程架构 · 用户时序 · 代理**
- [ ] 代码走读：`GenericLogic.calculateUserAccountData`（HF 实现）
- [ ] 代码走读：`LiquidationLogic.executeLiquidationCall` 逐步
- [ ] `SupplyLogic` / `BorrowLogic` + scaled balance

## 学习清单

### Week 1 前半（配合文档阅读）

- [ ] 读 `项目文档/KinzaFinance 完整借贷流程.md` 全文
- [ ] 读 `GenericLogic.sol` 的 `calculateUserAccountData()`，理解 HF 计算
- [ ] 读 `LiquidationLogic.sol` 的 `executeLiquidationCall()`，逐步跟踪
- [ ] 读 `SupplyLogic.sol` + `BorrowLogic.sol`，理解 supply/borrow 调用链
- [ ] 读 `ScaledBalanceTokenBase.sol`，理解 scaled balance 机制

### Week 1 后半（动手验证）

- [ ] 本地 fork BSC mainnet，调 `Pool.supply()` + `Pool.borrow()`
- [ ] 写 Foundry fork test：模拟 HF < 1 触发清算
- [ ] 对比 Kinza 清算 vs MetaNode 清算，整理异同表

### Week 2（面试准备）

- [ ] 练 15 分钟白板：设计 Lending + Liquidation 系统
- [ ] Mock：「如果 ETH 暴跌 50%，Kinza 会发生什么？」
- [ ] Mock：「scaled balance 和 Compound 的 cToken 有什么区别？」

## 相关仓库

| 仓库 | 说明 |
|------|------|
| `KinzaFinance/KZA-lending` | 核心借贷合约（Aave V3 fork） |
| `KZA-1.0` | KZA 治理代币经济学 |
| `omnichain-kBTC` | 跨链 kBTC 包装 |
| `lending-subgraph` | The Graph 链上索引 |

## 相关笔记

- [知识地图 02：DeFi 经济模型](/web3/恢复基础，建立知识地图02) — LTV/HF/清算/Oracle
- [知识地图 03：合约安全](/web3/恢复基础，建立知识地图03) — 清算边界/精度/Oracle 操纵
