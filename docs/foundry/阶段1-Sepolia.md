# 阶段 1：Sepolia 部署（Day 6–10）

> **目标**：合约真正上链，Etherscan 可查。  
> **代码**：[FoundryStudy](https://github.com/WorseRole/FoundryStudy) · **阶段 1**：✅ 完成 → 阶段 2 Day 11  
> **笔记对照**：[知识地图 01 · 交易生命周期](/web3/恢复基础，建立知识地图)

---

## 进度

| Day | 主题 | 状态 |
|-----|------|------|
| 6 | RPC / MetaMask / `.env` | ✅ 2026-09-15 |
| 7 | 部署 Counter | ✅ 2026-09-16 |
| 8 | 部署 Vault + `deposit` / `balances` 验证 | ✅ 2026-09-16 |
| 9 | 部署流程文档化 | ✅ 见 [Sepolia 部署流程](./Sepolia-部署流程) |
| 10 | 串讲 + 对照知识地图 01 | ✅ [阶段1-串讲](./阶段1-串讲) |

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
- [x] （加练）`cast send` 调 `increment()` · tx [`0x5f3f6a93…2ebb`](https://sepolia.etherscan.io/tx/0x5f3f6a9389521a385a37b8d761bcf56568b0ddfd9413ea00b0e3f46547c42ebb)；`cast call` / Read Contract 读 `number`

> 📝 **串讲待写**：`forge script` → `--broadcast` → `--verify` 各步在干什么

---

## Day 8 — 部署 Vault ✅

> **命令全集**：[Forge/Cast 链上命令](./forge-cast-链上命令)  
> **Vault（Sepolia）**：[0x605edB790b07dA3809E61ba24fbd4a29b9ad3D32](https://sepolia.etherscan.io/address/0x605edB790b07dA3809E61ba24fbd4a29b9ad3D32)

### 进度

| 步骤 | 内容 | 状态 |
|------|------|------|
| 8.1 | 编写 `script/Vault.s.sol` + `forge build` | ✅ |
| 8.2 | 模拟：`forge script script/Vault.s.sol --rpc-url sepolia -vvv` | ✅ |
| 8.3 | 上链：`--broadcast --verify` | ✅ 2026-09-16 |
| 8.4 | `cast send` → `deposit()` + `--value 0.01ether` | ✅ |
| 8.5 | `cast call` → `balances(你的地址)` | ✅ |
| 8.6 | 部署记录（本页 + README） | ✅ |

### 实战小结（Day 7–8 链上交互）

用 **`.env` 里同一测试地址 + 私钥**（与 MetaMask Sepolia 账户一致）：

1. **`forge script --broadcast`**：部署 Counter / Vault（创建合约 tx，合约页 Transactions 最初可能为空）。  
2. **`cast send`**：对已有合约发 **写交易**（如 Counter `increment()`、Vault `deposit()` 带 `--value`）；Etherscan **Transactions** 可见 Method、tx hash。  
3. **`cast call`**：只读 storage（如 `number`、`balances`），不上链、不 gas；Etherscan **Read Contract** 同理。  

私钥只在本地签名，经 **Alchemy RPC** 广播；链上 **From** 为你的 `0xE412…6BeE`。

### 8.2 模拟（不上链）

```bash
cd FoundryStudy
set -a && source .env && set +a
forge script script/Vault.s.sol --rpc-url sepolia -vvv
```

### 8.3 部署 + 验证

```bash
forge script script/Vault.s.sol --rpc-url sepolia --broadcast --verify -vvvv
```

### 8.4–8.5 链上业务验证（与 Day 3 CEI 对应）

```bash
VAULT=0x605edB790b07dA3809E61ba24fbd4a29b9ad3D32
ME=$(cast wallet address --private-key "$PRIVATE_KEY")

cast send $VAULT "deposit()" --value 0.01ether --rpc-url sepolia --private-key "$PRIVATE_KEY"
cast call $VAULT "balances(address)(uint256)" $ME --rpc-url sepolia
```

可选：Etherscan **Contract → Write `deposit`（带 Value）→ Read `balances`**。

**Day 8 完成标准**：Sepolia 上 Vault **Verified**，且 `balances` 读出你存入的测试 ETH。

> 📝 **串讲待写**：Vault 部署 vs Counter 有何相同；`deposit` 为何必须带 `msg.value` / `--value`

---

## Day 9 — 流程文档化 ✅

> **定稿**：[Sepolia 部署流程](./Sepolia-部署流程)（与 FoundryStudy `DEPLOY-流程.md` 一致）

- [x] 合约 → test → script（`console.log` 地址）→ 模拟 → `--broadcast --verify`
- [x] 命令备忘：[Forge/Cast 链上命令](./forge-cast-链上命令)
- [x] 部署记录与 [FoundryStudy README](https://github.com/WorseRole/FoundryStudy#部署记录) 一致
- [ ] （可选）`DeployAll.s.sol` 仅模拟
- [ ] 口头串讲 1 分钟

---

## Day 10 — 阶段复盘 ✅

> **串讲全文**：[阶段 1 串讲](./阶段1-串讲)（与 FoundryStudy 同步）  
> **链上命令**：[Forge/Cast 链上命令](./forge-cast-链上命令)

- [x] Counter / Vault 可查、可交互（见下表 + cast 备忘）
- [x] 对照 [知识地图 01 · §9–15](/web3/恢复基础，建立知识地图)
- [x] 串讲稿已定稿（无 Etherscan 截图要求）

---

## 部署记录

| 合约 | 网络 | 地址 | 日期 | Etherscan |
|------|------|------|------|-----------|
| Counter | Sepolia | [0x00E60d96…Ad2A1c](https://sepolia.etherscan.io/address/0x00E60d96e3ccbe461700bEF3FC2B8b61EfAd2A1c) | 2026-09-16 | Verified |
| Vault | Sepolia | [0x605edB79…ad3D32](https://sepolia.etherscan.io/address/0x605edB790b07dA3809E61ba24fbd4a29b9ad3D32) | 2026-09-16 | Verified |

---

## 上一步 / 下一步

- 阶段 0：[阶段 0 串讲](./阶段0-串讲)（知识库口语稿，与代码 README 互补）
- 阶段 2（未开始）：Proxy 升级 · 见 [FoundryStudy README 阶段 2](https://github.com/WorseRole/FoundryStudy#阶段-2合约升级-proxyday-11-15)
