# 阶段 1：Sepolia 部署（Day 6–10）

> **目标**：合约真正上链，Etherscan 可查。  
> **代码**：[FoundryStudy](https://github.com/WorseRole/FoundryStudy) · **当前**：Day 8 部署 Vault  
> **笔记对照**：[知识地图 01 · 交易生命周期](/web3/恢复基础，建立知识地图)

---

## 进度

| Day | 主题 | 状态 |
|-----|------|------|
| 6 | RPC / MetaMask / `.env` | ✅ 2026-09-15 |
| 7 | 部署 Counter | ✅ 2026-09-16 |
| 8 | 部署 Vault + Etherscan 交互 | ⬜ |
| 9 | 部署脚本整理 + README 部署记录 | ⬜ |
| 10 | 复盘 + 截图存档 | ⬜ |

**完成标准**：独立完成一次 testnet 部署 + Etherscan 验证。

---

## Day 6 — 环境配置

> 代码仓逐步说明：[FoundryStudy · DAY6-环境配置.md](https://github.com/WorseRole/FoundryStudy/blob/main/DAY6-环境配置.md)（push 后链接生效）

- [x] [Alchemy](https://www.alchemy.com/) 或 Infura：Sepolia RPC URL → `SEPOLIA_RPC_URL`
- [x] [MetaMask](https://metamask.io/)：Sepolia（Chain ID `11155111`）
- [x] 领 Sepolia ETH
- [x] `.env` 三变量（**不要 commit**）
- [x] **验收**（在 FoundryStudy 根目录）：

```bash
forge test
forge script script/Counter.s.sol --rpc-url sepolia -vvv
```

第二条应打印 `Counter deployed at: 0x...` 且 **不要** 加 `--broadcast`（Day 6 只模拟）。

**三变量分工（详见 [DAY6 §0](https://github.com/WorseRole/FoundryStudy/blob/main/DAY6-环境配置.md#0-三个-env-变量各干什么foundry-怎么用)）**

| 变量 | 作用 |
|------|------|
| `SEPOLIA_RPC_URL` | Alchemy：连 Sepolia，读状态 / 广播交易 |
| `PRIVATE_KEY` | 测试钱包私钥：本地签名，与 MetaMask 同账户 |
| `ETHERSCAN_API_KEY` | `--verify` 时提交源码；网页查交易不用 Key |

> 📝 **串讲待写**：用自己的话复述上表 + testnet 与 mainnet 区别（3–5 句）

---

## Day 7 — 部署 Counter ✅

- [x] `script/Counter.s.sol` 部署脚本
- [x] 模拟 + `--broadcast --verify`（Sepolia）
- [x] 部署记录见下表 · [Etherscan Verified](https://sepolia.etherscan.io/address/0x00E60d96e3ccbe461700bEF3FC2B8b61EfAd2A1c)

> 📝 **串讲待写**：`forge script` → `--broadcast` → `--verify` 各步在干什么

---

## Day 8 — 部署 Vault

- [ ] 写 `script/Vault.s.sol`
- [ ] 部署 Vault 到 Sepolia
- [ ] Etherscan 上手动 `deposit()`（例如 0.01 ETH）
- [ ] Etherscan 读 `balances(yourAddress)`

---

## Day 9 — 流程文档化

- [ ] 整理 deploy 流程（可选 `DeployAll.s.sol`）
- [ ] [FoundryStudy README](https://github.com/WorseRole/FoundryStudy) 补「部署记录」表
- [ ] 本页下方「部署记录」与 README 保持一致

---

## Day 10 — 复盘

- [ ] Counter + Vault 在 Sepolia 可查、可交互
- [ ] Etherscan 截图存档（简历/面试用）
- [ ] 对照知识地图：calldata、nonce、gas、交易生命周期

> 📝 **阶段 1 串讲**（完成后新建 `阶段1-串讲.md` 或在本节写 1 分钟总览）

---

## 部署记录

| 合约 | 网络 | 地址 | 日期 | Etherscan |
|------|------|------|------|-----------|
| Counter | Sepolia | [0x00E60d96…Ad2A1c](https://sepolia.etherscan.io/address/0x00E60d96e3ccbe461700bEF3FC2B8b61EfAd2A1c) | 2026-09-16 | Verified |
| Vault | Sepolia | | | |

---

## 上一步 / 下一步

- 阶段 0：[阶段 0 串讲](./阶段0-串讲)（知识库口语稿，与代码 README 互补）
- 阶段 2（未开始）：Proxy 升级 · 见 [FoundryStudy README 阶段 2](https://github.com/WorseRole/FoundryStudy#阶段-2合约升级-proxyday-11-15)
