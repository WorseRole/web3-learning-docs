---
aside: false
outline: false
---

# Kinza · Day D 白话口播稿（Reserve + 代理升级）

> 对齐简历第 4 条：一条资产一套 Reserve；用户只碰 Pool 代理；AddressesProvider 管升级与通讯录。  
> 结构化入口：[Kinza 简历 & 学习路径](./kinza-lending-简历与学习路径) · Day D

<pre class="oral-notes">
Day D · ReserveData + Provider + Proxy / Impl + L2Pool + 对比 UUPS

————————————————————
一、ReserveData：一条资产一套账
————————————————————

Pool 里是 _reserves[underlying]，USDC 一条、BTC 一条，互不共用指数。

一条 ReserveData 里面试常点的字段：
	configuration			LTV、清算阈值、bonus、借款开关等（位压缩）
	liquidityIndex			存款流动性指数
	currentLiquidityRate		当前存款年化（供下一笔推指数）
	variableBorrowIndex		可变债指数
	currentVariableBorrowRate	当前可变借款年化
	currentStableBorrowRate		当前稳定报价（不是「抢断」）
	lastUpdateTimestamp		上次 updateState 时间
	id				在活跃储备列表里的位置
	aTokenAddress			存款凭证（如 aUSDC）
	stableDebtTokenAddress		稳定债 token
	variableDebtTokenAddress	可变债 token
	interestRateStrategyAddress	算三档年化的策略合约
	accruedToTreasury		金库应得利息的 scaled 记账（不是立刻装满钱的金库）
	unbacked			跨链未备兑 aToken（面试可略）
	isolationModeTotalDebt		隔离模式下靠此抵押借出的累计债（面试可略）

关键字段怎么用：
	liquidityIndex + currentLiquidityRate + Δt  → 推 nextLiquidityIndex
	variableBorrowIndex + currentVariableBorrowRate + Δt → 推 nextVariableBorrowIndex
	三档年化算完写回 current* 字段

口播一句：一个 Pool 地址，多条 Reserve；每条资产自己的 index + aToken + 债 token。


————————————————————
二、三个角色：Provider / Proxy / Impl
————————————————————

① Pool.sol / L2Pool.sol（Implementation）
	= 写 supply/borrow/liquidation 的逻辑代码
	= setPoolImpl 换掉的就是这个

② Pool 代理（Proxy）
	= 用户真正 approve / 调用的地址
	= getPool() 返回的地址
	= storage（_reserves 等）在这里
	= DELEGATECALL 执行 ① 的代码（不是再外部 call 到 impl）

③ PoolAddressesProvider
	= 另一份合约：通讯录 + 升级开关
	= 不是 Pool，也不执行存借
	= constructor 里的 provider / ADDRESSES_PROVIDER 指的是它自己，不是 Pool 代理

关系：
	用户 ──调用──► Pool 代理
	                  │ DELEGATECALL
	                  ▼
	            Pool 或 L2Pool 实现

	Pool 里的 ADDRESSES_PROVIDER ──► PoolAddressesProvider
	                                    ├─ getPool() → 代理地址（给外人查入口）
	                                    ├─ setPoolImpl() → 换实现
	                                    ├─ getPriceOracle() / getACLManager() …
	                                    └─ Pool 自己不调 getPool()：它已经在代理上下文里


————————————————————
三、getPool / setPoolImpl
————————————————————

getPool()
	返回 Pool 代理地址；前端、脚本、别的合约用它知道该 approve / 调谁。

setPoolImpl(newImpl)（onlyOwner）
	内部 _updateImpl：
		若还没有代理 → new InitializableImmutableAdminUpgradeabilityProxy，再 initialize
		若已有代理 → upgradeToAndCall(newImpl, initialize(provider))
	代理地址不变，只换背后 implementation。
	用户钱包里的 Pool 地址不用改。

Pool 文件头（Pool.sol 约 22～36 行，contract 正上方 NatSpec）：
	用户入口是存款/借款/清算等；
	合约由代理托管，AddressesProvider 管理地址和权限。

constructor(provider) 写在 impl 上，ADDRESSES_PROVIDER immutable；
initialize 由代理部署/升级后调用。


————————————————————
四、L2Pool 是什么、怎么升级
————————————————————

L2Pool 继承 Pool，给 L2 省 calldata：
	多 supply(bytes32) 等压缩入口 → CalldataLogic 解包 → 再调继承来的 supply(asset,…)
	业务仍是同一套；不是「代理先到 L2Pool 再调另一个已部署的 Pool」。

某个市场代理的 impl：
	L2 常见挂 L2Pool；
	L1 风格常见挂 Pool。
	查 implementation() 或升级事件可知当前是谁。

升级 L2Pool：和升 Pool 同一条路
	部署新的 L2Pool 实现 → setPoolImpl(新地址) → 代理 upgradeToAndCall
	入口仍是同一个 getPool() 代理。

改 supply 业务（SupplyLogic）：
	不能只改源文件指望链上变；
	library 地址写在 impl 字节码里；
	要重新部署新 library（若有）+ 新 Pool/L2Pool impl，再 setPoolImpl。


————————————————————
五、代理模式对比（透明 / UUPS / Kinza）
————————————————————

注意：不要说成「UUPS 透明代理」——那是两个词粘在一起。面试分开说。

1) 透明代理（Transparent Proxy）
	升级权在代理 / ProxyAdmin 一侧。
	管理员调代理的升级接口；
	普通用户调业务函数时走 fallback → DELEGATECALL 到 impl。
	同一函数名：靠 msg.sender == admin 分流——
		admin 调到代理管理逻辑；
		用户调到 impl。
	代理相对「厚」一点，升级逻辑不写在业务 impl 里。

2) UUPS
	升级函数写在实现合约里（upgradeTo / _authorizeUpgrade）。
	代理极简，几乎只做 DELEGATECALL。
	升级时：对【代理地址】调 upgradeTo，但执行的是【当前 impl 里】的升级代码（DELEGATECALL 进 impl）。
	换 impl 后，新 impl 也必须继续带好升级逻辑，否则可能失去升级能力。

3) Kinza / Aave（Immutable Admin Proxy）
	更接近「代理侧升级」，不是 UUPS。
	代理：InitializableImmutableAdminUpgradeabilityProxy
	admin 固定为 PoolAddressesProvider（immutable）
	升级：provider.setPoolImpl → 代理 upgradeToAndCall
	Pool / L2Pool 业务 impl 里没有 upgradeTo
	用户永远只碰 proxy；Provider 当通讯录 + 唯一升级入口

30 秒口播：
	透明代理 / Aave：谁能升级在代理或 admin；业务 impl 专心 supply/borrow。
	UUPS：升级逻辑在 impl 里；代理更瘦，新 impl 仍要能升级。
	Kinza 是 AddressesProvider 当 admin 调 setPoolImpl，用户地址不变——
	和 Foundry 练的 UUPS 对比，就是升级入口在管家不在 Pool 业务代码里。


————————————————————
六、今日收口
————————————————————

Provider 是通讯录和升级入口；
用户只碰 proxy；
impl 可换成 Pool 或 L2Pool；
一条资产一套 ReserveData（index + aToken + 债 token）；
升级换 impl 不换用户地址。
</pre>
