# Sepolia 链上发布流程

> **代码仓**：[FoundryStudy · DEPLOY-流程.md](https://github.com/WorseRole/FoundryStudy/blob/main/DEPLOY-流程.md)  
> **环境**： [Day 6](./阶段1-Sepolia#day-6--环境配置) · **部署后调用**：[Forge/Cast 链上命令](./forge-cast-链上命令)

---

## 1. 写合约并本地测通

1. 在 **`src/`** 编写合约。
2. 在 **`test/`** 编写测试。
3. **`forge test`** 全绿后再上链。

---

## 2. 写部署脚本 `script/`

1. 新建 `script/Xxx.s.sol`，继承 **`Script`**。
2. **`run()`** 中：
   - `vm.envUint("PRIVATE_KEY")`；
   - `vm.startBroadcast(私钥)`；
   - `new Xxx()`；
   - **`console.log("Xxx deployed at:", address(xxx))`**；
   - `vm.stopBroadcast()`。

---

## 3. 模拟（不上链）

```bash
cd FoundryStudy
forge script script/Xxx.s.sol --rpc-url sepolia -vvv
```

不加 **`--broadcast`**。

---

## 4. 真部署

```bash
forge script script/Xxx.s.sol --rpc-url sepolia --broadcast --verify -vvvv
```

| 参数 | 作用 |
|------|------|
| `--broadcast` | 签名并上链 |
| `--verify` | Etherscan 源码验证 |

以 **`== Logs ==`** 中的地址写入 [部署记录](./阶段1-Sepolia#部署记录)。

---

## 5. 部署后交互

用 **`cast call` / `cast send`**，见 [Forge/Cast 链上命令](./forge-cast-链上命令)（不是 `forge script`）。

---

## 当前 Sepolia 部署

| 合约 | 地址 |
|------|------|
| Counter | [0x00E60d96…Ad2A1c](https://sepolia.etherscan.io/address/0x00E60d96e3ccbe461700bEF3FC2B8b61EfAd2A1c) |
| Vault | [0x605edB79…ad3D32](https://sepolia.etherscan.io/address/0x605edB790b07dA3809E61ba24fbd4a29b9ad3D32) |
