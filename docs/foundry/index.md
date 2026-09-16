# Foundry 实操

> 理论在 [Web3 知识地图](/web3/恢复基础，建立知识地图)；代码在 GitHub，串讲写在知识库。

## 代码仓库

**[FoundryStudy](https://github.com/WorseRole/FoundryStudy)** — Counter / Ownable / Vault / 重入演示 + 测试

本地路径（参考）：`~/Desktop/personal/liyanyan/FoundryStudy`

```bash
cd FoundryStudy
forge test    # 当前目标：20 passed
```

## 学习路线（30 天）

| 阶段 | 天数 | 内容 | 状态 |
|------|------|------|------|
| 0 | Day 1-5 | Foundry 热身 | ✅ |
| 1 | Day 6-10 | Sepolia 部署 | **进行中（Day 8）** |
| 2 | Day 11-15 | Proxy 升级 | ⬜ |
| 3 | Day 16-21 | 永续 + Kinza 深入 | ⬜ |
| 4 | Day 22-26 | 面试准备 | ⬜ |
| 5 | Day 27-30 | 简历 + 投递 | ⬜ |

详细 checklist 见仓库 [README.md](https://github.com/WorseRole/FoundryStudy/blob/main/README.md)。

## 串讲文档

| 文档 | 说明 |
|------|------|
| [阶段 0 串讲](./阶段0-串讲) | Day 1–5：Counter → Ownable → Vault → 重入（口语稿，含 📝 待填） |
| [阶段 1 · Sepolia](./阶段1-Sepolia) | Day 6–10：环境、部署、Etherscan（checklist） |

后续阶段完成后可在此追加：

- `阶段1-串讲.md`（Day 6–10 口语复盘，阶段 1 做完再写）
- `阶段2-升级串讲.md`（Day 11–15）

## 与知识地图的对应

| 实操 | 笔记 |
|------|------|
| Storage / `msg.value` | [知识地图 01](/web3/恢复基础，建立知识地图) |
| Vault 记账 | [知识地图 02](/web3/恢复基础，建立知识地图02) DeFi  supply/withdraw |
| CEI / 重入 | [知识地图 03](/web3/恢复基础，建立知识地图03) |
| `forge test` / cheatcodes | [知识地图 04](/web3/恢复基础，建立知识地图04) |

## 项目简历

实操完成后对接：

- [MetaNode 永续合约](/projects/metanode-perpetual)
- [KinzaFinance 借贷](/projects/kinza-lending)
