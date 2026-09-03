# MetaNode 去中心化永续合约

> **简历定位**：链下撮合 + 链上结算的 DeFi 永续系统，Solidity 合约 + Go 微服务全链路。

## 项目背景

MetaNode 是一个去中心化永续合约系统，采用 **链下撮合 + 链上结算** 架构：

- 用户通过 EIP-712 签名订单，无需每笔交易都上链
- Go 后端负责订单簿撮合、风控校验、批量上链
- Solidity 合约负责保证金管理、仓位结算、清算执行

已在 **Sepolia 测试网** 部署（参考 `perpetual-contract`）。

## 系统架构

```
用户钱包
   │ EIP-712 签名订单
   ▼
┌─────────────────────────────────────┐
│           Go 后端 (perpetual-go)     │
│  order → matching → execution       │
│  Kafka 解耦 | 红黑树订单簿 | WAL     │
└──────────────┬──────────────────────┘
               │ Perpetual.trade()
               ▼
┌─────────────────────────────────────┐
│         链上合约 (Solidity)          │
│  MetaNodeDealer（资金 + 风控）       │
│  Perpetual × N（单市场仓位账本）     │
└─────────────────────────────────────┘
```

## 我负责的模块

### 1. Solidity 合约核心库（perpetual-new-contract）

| 模块 | 文件 | 职责 |
|------|------|------|
| 撮合结算 | `libraries/Trading.sol` | EIP-712 验签、订单匹配、paperChange/creditChange 计算 |
| 清算 | `libraries/Liquidation.sol` | MM 风控、固定折扣清算、坏账处理 |
| 资金费率 | `libraries/Funding.sol` | 存取款、fundingRate 累计更新 |
| 仓位管理 | `libraries/Position.sol` | 开平仓、持仓列表维护 |
| 单市场账本 | `Perpetual.sol` | `_settle` 核心公式、trade/liquidate 入口 |
| 外部接口 | `MetaNodeExternal.sol` | deposit/withdraw、approveTrade |

**核心公式（必须能背）：**

```
credit = paper × fundingRate + reducedCredit

新 credit = 旧 credit + creditChange
新 paper  = 旧 paper + paperChange
新 reducedCredit = 新 credit - 新 paper × fundingRate
```

### 2. Go 微服务后端（perpetual-go）

| 服务 | 职责 |
|------|------|
| `order` | HTTP 接单，Kafka 发布新订单 |
| `matching` | 红黑树订单簿撮合 + WAL 崩溃恢复 |
| `execution` | 批量调用 `Perpetual.trade()` 上链 |

**数据流：**

```
HTTP → order → Kafka(orders.new)
     → matching(红黑树) → Kafka(fills.pending)
     → execution → EVM trade() → Kafka(fills.confirmed)
```

### 3. 技术栈

Solidity 0.8.19 · Foundry · Go · Kafka · EIP-712 · Chainlink/Pyth Oracle

## 三个技术难点（面试必讲）

### 难点 1：gas 优化的仓位存储

**问题**：每个用户每个市场都有仓位，如果每次 fundingRate 更新都逐个改用户存储，gas 不可接受。

**解法**：`fundingRate` 存全局累计值，用户 `credit` 读取时动态计算：

```
credit = paper × fundingRate + reducedCredit
```

只改一个全局变量，所有用户自动生效。

### 难点 2：EIP-712 链下验签 + 链上 approveTrade

**流程**：
1. 用户签 `Order(perp, signer, paperAmount, creditAmount, info)`
2. Go 后端验签 + 撮合
3. 上链时 Dealer.`approveTrade` 再次验签
4. 返回 `[traderList, paperChangeList, creditChangeList]`
5. Perpetual `_settle` 逐个更新

**防攻击**：过期检查、nonce 防重放、防自成交、防超量成交。

### 难点 3：全仓 MM 风控 + 固定折扣清算

**安全条件**：

```
净值 netValue = Σ(仓位价值) + primaryCredit + secondaryCredit
维持保证金 MM = Σ(|paper × markPrice| × liquidationThreshold)

安全 ⟺ netValue ≥ MM
```

**清算执行**：不走订单簿，强制按 `markPrice × (1 ± 折扣)` 转让仓位。

## 面试话术（5 层结构）

### 30 秒架构

> 链下撮合 + 链上结算的永续合约。Go 后端负责撮合和链上提交，Kafka 解耦三服务；链上 MetaNodeDealer 管资金和风控，Perpetual 管单市场仓位。

### 2 分钟交易流程

> 用户 EIP-712 签订单 → Go 撮合 → 调 `Perpetual.trade()` → Dealer 验签返回变化量 → `_settle` 更新仓位 → 全员 MM 安全检查。

### 1.5 分钟清算

> 净值 < 维持保证金时触发。清算人调 `liquidate()`，按固定折扣价强制转让仓位，清算人拿奖励，资不抵债进保险基金。

## 学习清单

- [ ] 读 `perpetual-new-contract/src/libraries/Trading.sol`，理解 `_matchOrders`
- [ ] 读 `Liquidation.sol`，理解 `isSafe()` 和 `liquidate()`
- [ ] 读 `Perpetual.sol` 的 `_settle`，能手写公式
- [ ] 读 `perpetual-go/services/matching/`，理解订单簿结构
- [ ] 读 `CEX.md`，练 3 遍 5 层讲解
- [ ] 写 3 个 Foundry 测试：deposit、trade、liquidation

## 相关仓库

| 仓库 | 说明 |
|------|------|
| `perpetual-new-contract` | 自研合约（主力） |
| `perpetual-go` | Go 微服务后端 |
| `perpetual-contract` | 完整参考 + Sepolia 部署 |
| `market-match` | 现货撮合引擎参考 |

## 相关笔记

- [知识地图 01：EVM 基础](/web3/恢复基础，建立知识地图)
- [知识地图 02：DeFi 经济模型](/web3/恢复基础，建立知识地图02)
- [知识地图 03：合约安全](/web3/恢复基础，建立知识地图03)
- [知识地图 04：Foundry 工程](/web3/恢复基础，建立知识地图04)
