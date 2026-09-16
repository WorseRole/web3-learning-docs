# 阶段 2 · Day 11 — Proxy 升级原理

> **阶段 2 目标**：UUPS Proxy，Counter V1 → V2，storage 不丢。  
> **Day 11**：只读原理，不写链上代码。  
> 对照 [知识地图 01 · Delegatecall / Proxy / Storage Layout](/web3/恢复基础，建立知识地图)  
> 代码仓：[FoundryStudy · 阶段2-Day11-Proxy原理.md](https://github.com/WorseRole/FoundryStudy/blob/main/%E9%98%B6%E6%AE%B52-Day11-Proxy%E5%8E%9F%E7%90%86.md)

---

## 1. 一句话模型

**用户永远调 Proxy 地址；业务状态写在 Proxy 的 storage；逻辑代码在 Implementation，通过 `delegatecall` 执行；升级 = 把 Proxy 里存的 `implementation` 指针从 V1 换成 V2。**

---

## 2. A / B / C 对照标准术语

| 口语 | 标准名 | 说明 |
|------|--------|------|
| 逻辑合约 A | **Implementation V1** | 只提供 bytecode，用户不直接调它的地址（升级场景下） |
| 代理 B | **Proxy** | 用户认的地址；fallback 里 `delegatecall` 到 implementation |
| 升级版 C | **Implementation V2** | 新部署；Proxy 内指针 A → C |

**常见误区：**

- 不是「把 A **放进** B 里」，而是 B **delegatecall** A 的代码。
- **数据在 Proxy（B）**，不在 A/C 自己的 storage 里（实现合约上的 storage 在 proxy 模式下不参与业务状态）。

与知识地图一致：`delegatecall` = **用 B 的代码、改 A 的 storage**；在 Proxy 模式里 **A = Proxy，B = Logic**。

---

## 3. 升级流程（ mental model ）

```text
部署 V1 (implementation)
部署 Proxy，constructor 写入 V1 地址 + initialize
用户 → Proxy.increment() → delegatecall → V1 代码改 Proxy 的 number

升级：
部署 V2 (implementation)
admin → Proxy → delegatecall → V2.upgradeToAndCall(V2, data)
  → 在 Proxy 的 context 里更新 ERC1967 implementation slot
用户仍调同一 Proxy 地址 → 现在跑 V2 代码，number 仍在 Proxy storage
```

---

## 4. 升级必须注意的三件事

| 点 | 说明 |
|----|------|
| **Storage Layout** | V2 与 V1 **已有变量顺序、类型不能改**；只能在 **末尾追加**。乱序会导致 **升级后运行** 读错 slot（数据错乱 / 安全问题），通常 **不是** V2 部署失败。 |
| **初始化** | 用户调 Proxy 时 **不会** 再跑 implementation 的 `constructor`。V2 若需新状态，用 **`initializer`** 或 `upgradeToAndCall` 里带一次初始化。 |
| **谁有权升级** | UUPS：实现合约里 `upgradeTo` + `_authorizeUpgrade`；未授权升级是常见事故面。 |

---

## 5. Transparent Proxy vs UUPS

两种都是 **ERC1967 Proxy + delegatecall**，差别在 **升级入口** 和 **selector 冲突** 怎么处理。

### Transparent Proxy（透明代理）

- Proxy 合约带 **Admin 逻辑**。
- **Admin** 调 Proxy → 走 **Proxy 自己的管理函数**（改 implementation、改 admin），**不** delegatecall 进实现。
- **普通用户** 调 Proxy → **一律** delegatecall 到 Implementation。
- **「透明」**：对 Admin 而言，即使 Implementation 里有同名函数，也不会误 delegatecall 进去。

### UUPS（本计划 Day 13–14 使用）

- Proxy **很薄**：fallback + delegatecall。
- **升级函数写在 Implementation**（如 `upgradeToAndCall`）；仍对用户暴露 **Proxy 地址**，调用经 delegatecall 在 **Proxy context** 里改 ERC1967 的 `implementation` 指针。
- 风险：若实现里 **删掉** 升级逻辑，Proxy 可能 **无法再起升级**（变砖）；OZ 要求保留 UUPS 与权限检查。

| | Transparent | UUPS |
|--|-------------|------|
| 升级写在哪 | Proxy Admin | Implementation |
| Proxy 体积 | 较大 | 较小 |
| 典型 OZ | `TransparentUpgradeableProxy` | `UUPSUpgradeable` + `ERC1967Proxy` |

---

## 6. Day 11 自测三题（口播版）

### Q1：升级后用户地址为什么不变？

用户只和 **Proxy 地址** 交互。升级只是在 Proxy 存储里把 **implementation** 从 V1 换成 V2；**Proxy 地址不变**，**Proxy 上已有 storage 不变**，所以不用换地址。

### Q2：为什么不能调换 V1 里两个 state 变量的顺序？

Proxy 上的数据已按 V1 的 **slot 布局** 写入。V2 必须 **兼容同一布局**（只能追加变量）。若对调两个变量，V2 以为 slot0 是字段 A，实际存的是 V1 的 B → **升级成功后运行即错乱**，不是简单的编译/部署报错。

### Q3：UUPS 和 Transparent 差在哪？

- **UUPS**：升级逻辑在 **Implementation**；调 **Proxy**，经 **delegatecall** 在 Proxy 的 context 里更新 ERC1967 **implementation** 指针。
- **Transparent**：升级在 **Proxy 的 Admin 侧**；Admin 改指针 **不** delegatecall；用户调用才 delegatecall 到实现，避免 Admin 与实现的 **函数选择器冲突**。

---

## 7. 30 秒极简版（面试自测）

Proxy 用 **delegatecall** 跑 Implementation 的代码，但 **state 在 Proxy 的 slot** 里。升级只换 **implementation 地址**，Proxy 地址和 storage 不变。V2 必须 **storage 布局兼容** V1。我们后面用 **UUPS**：升级写在实现合约里，Proxy 只负责转发；Transparent 则是 Admin 在 Proxy 层改指针、用户才 delegatecall。

---

## 8. Day 11 Checklist

- [x] 读知识地图 01：Delegatecall、Proxy、Storage Layout
- [ ] 可选：扫一眼业务项目里的 Proxy 设计 / [OZ Upgradeable 文档](https://docs.openzeppelin.com/contracts/4.x/upgradeable)
- [x] 能口头答上面三题

**下一步（Day 12）**：自写 `CounterV1` / `CounterV2`（layout 兼容，只加 `reset()` 或 `version()`）。

---

## 与后续天数

| Day | 内容 |
|-----|------|
| 11 | 原理（本文） |
| 12 | CounterV1 / CounterV2 |
| 13 | OZ UUPS + ERC1967Proxy 部署 |
| 14 | `upgradeToAndCall`，验证 state + 新函数 |
| 15 | 测试 + 阶段 2 串讲 |

完整 checklist：[FoundryStudy README](https://github.com/WorseRole/FoundryStudy/blob/main/README.md)。
