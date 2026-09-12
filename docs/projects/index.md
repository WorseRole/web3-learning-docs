# Projects

> 两个核心项目，覆盖 DeFi 永续 + 借贷两条线，可直接用于简历和面试。

## 项目一览

| 项目 | 定位 | 技术栈 | 详情 |
|------|------|--------|------|
| [MetaNode 永续合约](./metanode-perpetual) | 链下撮合 + 链上结算 | Solidity / Go / Kafka / EIP-712 | 敲门砖项目 |
| [KinzaFinance 借贷协议](./kinza-lending) | 多链借贷 + BTC 质押 | Solidity / Aave V3 / Chainlink | 深度项目 |
| [Foundry 实操](/foundry/) | 合约热身 + 串讲 | Foundry / Sepolia | 手感恢复 |

## 简历一句话

- **MetaNode**：设计并实现链下撮合 + 链上结算的 DeFi 永续系统，涵盖合约核心库与 Go 微服务后端。
- **KinzaFinance**：参与 Aave V3 架构多链借贷协议，负责清算逻辑、健康因子计算与借贷主流程。

## 学习路线

```
Week 1
├── Day 1-2  读项目文档 + 对照源码
├── Day 3    永续：补 Foundry 测试
├── Day 4    Kinza：跑 supply → borrow → liquidation 调用链
├── Day 5-6  背面试话术（CEX.md + Kinza 三题）
└── Day 7    笔记自测

Week 2
├── Day 8-9   系统设计白板（Perp + Lending）
├── Day 10-11 Mock Interview
└── Day 12-14 投递
```
