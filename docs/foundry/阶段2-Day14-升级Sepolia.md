# 阶段 2 · Day 14 — 升级 V2 + Sepolia

> 代码：[FoundryStudy](https://github.com/WorseRole/FoundryStudy) · 前置：[Day 13 UUPS](./阶段2-Day13-UUPS-Proxy)

---

## 完成标准

- 本地：`upgradeToAndCall` + `number` 保留 + `reset` / `version` / `bump`
- Sepolia：对 **已有 Proxy** 升级，**不** 再 `new ERC1967Proxy`

---

## 流程

1. `new CounterUpgradeableV2()` → V2 impl 地址  
2. `CounterUpgradeableV1(PROXY).upgradeToAndCall(v2, data)`  
3. `data` 可为 `abi.encodeCall(CounterUpgradeableV2.initializeV2, (100))` 或 `""`

---

## Sepolia 部署记录（2026-09-20）

| 角色 | 地址 |
|------|------|
| **Counter Proxy** | [0x901D9F0d66db49226476372e1B63684bFEbE4F73](https://sepolia.etherscan.io/address/0x901D9F0d66db49226476372e1B63684bFEbE4F73) |
| V1 Implementation | [0xC2fB0cB014D76fF0beDFE4CfaB8Aafba77036550](https://sepolia.etherscan.io/address/0xC2fB0cB014D76fF0beDFE4CfaB8Aafba77036550) |
| V2 Implementation | [0x22b7144CFd9D2A7e5936EB8418C2c33cf6dd6AC1](https://sepolia.etherscan.io/address/0x22b7144CFd9D2A7e5936EB8418C2c33cf6dd6AC1) |

升级后：`number=2`，`bump=100`，`version="2"`。

---

## 与 Day 13 对比

| | Day 13 | Day 14 |
|--|--------|--------|
| 新 Proxy | ✅ | ❌ |
| 新 impl | V1 | V2 |
| 关键调用 | `new ERC1967Proxy(v1, initData)` | `upgradeToAndCall(v2, data)` |

---

## Day 14 Checklist

- [x] CounterUpgradeableV2 + 测试  
- [x] CounterUpgradeV2.s.sol  
- [x] Sepolia broadcast  
- [ ] Day 15 阶段 2 串讲

镜像：[FoundryStudy · 阶段2-Day14-升级Sepolia.md](https://github.com/WorseRole/FoundryStudy/blob/main/%E9%98%B6%E6%AE%B52-Day14-%E5%8D%87%E7%BA%A7Sepolia.md)
