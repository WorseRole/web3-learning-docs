# 阶段 2 · Day 12 — CounterV1 / CounterV2

> **目标**：实现布局兼容的 V1/V2，本地测试；尚未部署 Proxy。  
> 代码仓：[FoundryStudy](https://github.com/WorseRole/FoundryStudy) · 对照 [Day 11 Proxy 原理](./阶段2-Day11-Proxy原理)

---

## 1. 交付物

| 文件 | 说明 |
|------|------|
| `src/CounterV1.sol` | 与阶段 1 `Counter` 相同逻辑（`Ownable` + `number`） |
| `src/CounterV2.sol` | 与 V1 **相同 state 顺序**，新增 `reset()`、`version()` |
| `test/CounterUpgrade.t.sol` | V1/V2 行为 + V2 权限与 `version` |

原有 `Counter.sol` / `Counter.t.sol` **未改**，阶段 1 测试仍保留。

---

## 2. Storage Layout

继承 `Ownable` 时声明顺序固定：

| Slot | 变量 |
|------|------|
| 0 | `owner` |
| 1 | `number` |

V2 **不得** 在 `owner` 与 `number` 之间插入字段，**不得** 对调或改类型。  
`version()` 为 `pure`，不占新 slot。

---

## 3. V2 相对 V1 的改动

- `reset()`：`onlyOwner`，`number = 0`
- `version()`：`pure`，返回 `"2"`

V1 的 `increment`（+2）、`decrement`、`setNumber` 在 V2 中保持一致。

---

## 4. 测试要点（`CounterUpgrade.t.sol`）

| 测试 | 断言 |
|------|------|
| V1 increment / decrement / setNumber | `assertEq` 与 `CounterTest` 一致 |
| V1 revert | `number too small`、`not owner`（setNumber） |
| V2 increment / decrement | 同 V1 |
| V2 reset | 先 `increment` → 2，再 `reset` → 0 |
| V2 reset 权限 | 非 owner `expectRevert("not owner")` |
| V2 version | `assertEq(version(), "2")` |

**不测**：`new V1()` 与 `new V2()` 之间共享 storage（需 Day 13 Proxy + Day 14 升级）。

---

## 5. 命令

```bash
cd FoundryStudy
forge test --match-contract CounterUpgrade -vv
forge test
forge fmt
```

当前全仓：**30 tests passed**（含 CounterUpgrade 10 条 + 原阶段 0–1 等）。

---

## 6. Day 12 Checklist

- [x] `CounterV1.sol`
- [x] `CounterV2.sol`（layout 兼容 + `reset` / `version`）
- [x] `CounterUpgrade.t.sol` 带 `assertEq` 与 revert 测
- [x] `forge test` 全绿

**下一步（Day 13）**：`forge install OpenZeppelin/openzeppelin-contracts`，实现可升级版（`initialize` 替代 constructor），部署 `ERC1967Proxy` + V1。

---

## 与阶段 2 路线

| Day | 内容 |
|-----|------|
| 11 | Proxy 原理 ✅ |
| 12 | V1 / V2 + 本地测试 ✅ |
| 13 | OZ UUPS + Proxy 部署 |
| 14 | 升级到 V2，state 保留 |
| 15 | 阶段 2 串讲 |

FoundryStudy 镜像：[阶段2-Day12-CounterV1V2.md](https://github.com/WorseRole/FoundryStudy/blob/main/%E9%98%B6%E6%AE%B52-Day12-CounterV1V2.md)
