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

## 我负责的模块

> 以下模块按「两周可学透 + 面试高频 + 和永续清算经验重合」选定。

### 模块 1：清算逻辑（重点 ⭐⭐⭐）

**文件**：`KZA-lending/contracts/protocol/libraries/logic/LiquidationLogic.sol`

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

**文件**：`KZA-lending/contracts/protocol/libraries/logic/GenericLogic.sol`

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
| `KZA-lending` | 核心借贷合约（Aave V3 fork） |
| `KZA-1.0` | KZA 治理代币经济学 |
| `omnichain-kBTC` | 跨链 kBTC 包装 |
| `lending-subgraph` | The Graph 链上索引 |

## 相关笔记

- [知识地图 02：DeFi 经济模型](/web3/恢复基础，建立知识地图02) — LTV/HF/清算/Oracle
- [知识地图 03：合约安全](/web3/恢复基础，建立知识地图03) — 清算边界/精度/Oracle 操纵
