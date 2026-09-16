# Forge / Cast · 链上命令备忘

> 环境：FoundryStudy 根目录 · `set -a && source .env && set +a` · RPC 用 `foundry.toml` 别名 **`sepolia`**

**部署流程（Day 9）**：见 [Sepolia 部署流程](./Sepolia-部署流程)（合约 → script → `forge script --broadcast`）。

**调用链路（Day 7–8 已练）**：本地 **私钥** → **`cast send` / `forge script --broadcast`** → **Sepolia RPC** → Etherscan；读状态用 **`cast call`**。

---

## 1. 部署（`forge script`，上链）

模拟（Day 6/8 验收，**不花 gas**）：

```bash
forge script script/Counter.s.sol --rpc-url sepolia -vvv
forge script script/Vault.s.sol --rpc-url sepolia -vvv
```

真部署 + Etherscan 验证源码：

```bash
forge script script/Counter.s.sol --rpc-url sepolia --broadcast --verify -vvvv
forge script script/Vault.s.sol --rpc-url sepolia --broadcast --verify -vvvv
```

| 阶段 | 含义 |
|------|------|
| 无 `--broadcast` | 连 Sepolia 模拟，不发交易 |
| `--broadcast` | 私钥签名，交易上链 |
| `--verify` | 用 `ETHERSCAN_API_KEY` 提交源码验证 |

---

## 2. 只读（`cast call`，不上链、不 gas）

查 **Counter** 的 `number`：

```bash
COUNTER=0x00E60d96e3ccbe461700bEF3FC2B8b61EfAd2A1c
cast call $COUNTER "number()(uint256)" --rpc-url sepolia
```

查 **Vault** 某地址存款（`ME` 换成自己的 `0x`）：

```bash
VAULT=0x605edB790b07dA3809E61ba24fbd4a29b9ad3D32
cast call $VAULT "balances(address)(uint256)" $ME --rpc-url sepolia
```

Etherscan 等价：**Contract → Read Contract → Query**。

---

## 3. 写链上（`cast send`，要 gas + 私钥）

**Counter**

```bash
cast send $COUNTER "increment()" --rpc-url sepolia --private-key "$PRIVATE_KEY"
cast send $COUNTER "decrement()" --rpc-url sepolia --private-key "$PRIVATE_KEY"
cast send $COUNTER "setNumber(uint256)" 100 --rpc-url sepolia --private-key "$PRIVATE_KEY"  # 仅 owner
```

**Vault**（`deposit` 必须带 ETH）

```bash
cast send $VAULT "deposit()" --value 0.01ether --rpc-url sepolia --private-key "$PRIVATE_KEY"
cast send $VAULT "withdraw(uint256)" 0.005ether --rpc-url sepolia --private-key "$PRIVATE_KEY"
```

成功看 **status: 1**；改状态后再 `cast call` 读一遍。

---

## 4. 常用辅助

```bash
# .env 私钥对应地址
cast wallet address --private-key "$PRIVATE_KEY"

# Sepolia 上该地址 ETH 余额
cast balance $(cast wallet address --private-key "$PRIVATE_KEY") --rpc-url sepolia --ether

# 查某笔交易
cast tx 0x交易hash --rpc-url sepolia

# 本地测试（不上链）
forge test
```

---

## 和 Go 后端（以后）

| 终端 | 大致对应 |
|------|----------|
| `cast call` | `eth_call` / 合约 `Call` |
| `cast send` | 签名 + `eth_sendRawTransaction` |
| `forge script --broadcast` | 部署脚本；业务调用多在 Go 里 `send` |

---

## 本仓库 Sepolia 部署记录（随进度更新）

| 合约 | 地址 | Day |
|------|------|-----|
| Counter | [0x00E60d96…Ad2A1c](https://sepolia.etherscan.io/address/0x00E60d96e3ccbe461700bEF3FC2B8b61EfAd2A1c) | 7 ✅ |
| Vault | [0x605edB79…ad3D32](https://sepolia.etherscan.io/address/0x605edB790b07dA3809E61ba24fbd4a29b9ad3D32) | 8 ✅ 含 deposit |

Day 8 步骤清单见 [阶段 1 · Sepolia](./阶段1-Sepolia) 中 **Day 8** 小节。
