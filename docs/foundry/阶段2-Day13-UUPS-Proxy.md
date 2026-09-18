# 阶段 2 · Day 13 — UUPS + ERC1967Proxy

> 代码：[FoundryStudy](https://github.com/WorseRole/FoundryStudy) · 前置：[Day 11 Proxy](./阶段2-Day11-Proxy原理) · [Day 12 V1/V2](./阶段2-Day12-CounterV1V2)

---

## 完成标准

- `CounterUpgradeableV1`：`initialize` + UUPS + 与 Counter 相同业务逻辑
- `new ERC1967Proxy(impl, abi.encodeCall(initialize, (owner)))`
- 测试通过 **Proxy 地址** 调 `increment()` → `number == 2`

---

## 四个关键 API（通俗）

| 名称 | 作用 |
|------|------|
| **ERC1967Proxy** | 用户用的 Proxy 地址；内部存 impl 指针并 delegatecall |
| **abi.encodeCall(initialize, …)** | Proxy 创建时 delegatecall 的 init calldata，给 Proxy 设 owner |
| **__Ownable_init** | 在 Proxy storage 写 owner（替代 constructor） |
| **_disableInitializers** | impl 部署时锁 impl 本址，防对 impl 调 initialize 抢权 |

---

## 部署顺序（Sepolia）

1. `new CounterUpgradeableV1()` → Implementation  
2. `new ERC1967Proxy(v1, initData)` → **Counter Proxy**（用户只认此地址）  
3. 可选 script：`script/CounterUpgradeable.s.sol`

```bash
forge script script/CounterUpgradeable.s.sol --rpc-url sepolia -vvvv
forge script script/CounterUpgradeable.s.sol --rpc-url sepolia --broadcast --verify -vvvv
```

---

## Day 14 预告

owner 对 **Proxy** 调 `upgradeToAndCall(v2Impl, data)`，不换 Proxy 地址，storage 保留。

---

FoundryStudy 镜像见仓库 README · Day 13 checklist。
