---
aside: false
outline: false
---

# Kinza · liquidation 白话口播稿

> 口语化手写详稿，方便闭卷前过一遍。  
> 对应：[Session3 结构化笔记](./kinza-session3-liquidation)

<pre class="oral-notes">liquidationCall

那我说一下清算。清算是清算人发起的，对被清算人调 Pool.liquidationCall。
入口参数要想清楚：
	collateralAsset	= 抵押 underlying 地址（清算人拿走的，比如 BTC）
	debtAsset		= 债务 underlying 地址（清算人付出的，比如 USDC）
	user			= 被清算的借款人地址（不是清算人）
	debtToCover		= 清算人愿意还的债务上限（后面还要被 Close Factor、抵押够不够截断）
	receiveAToken	= true 收 aToken；false 收 underlying（比如直接拿 BTC）

钱怎么走（资金三角）：
	清算人付债务币（USDC）→ 借款人债务减少 → 借款人抵押减少（含 bonus 多扣的那截）→ 抵押给清算人
	不是协议把 BTC 自动换成 USDC；清算人若要 USDC 得自己去市场卖 BTC。


和 supply / borrow 一样，一进来先对「债务侧」那条 Reserve 做 cache + updateState。
注意：开头结息的是 debtAsset（比如 USDC），不是抵押 BTC。
抵押侧若后面要出 underlying，会在 _burnCollateralATokens 里再对自己那条 Reserve 结一次。

cache：把债务资产的 reserve 从 storage 拷到 memory，省 gas。

updateState：同区块已结过就直接 return。
主要更新 nextLiquidityIndex（流动性指数）和 nextVariableBorrowIndex（可变债指数），再从这段利息里给金库记一笔抽成（scaled，不立刻转账）。

	nextLiquidityIndex = factor * currLiquidityIndex / RAY
	factor = RAY + currLiquidityRate * (now - 上次更新时间) / (365*24*60*60)
	← 存款侧线性

	nextVariableBorrowIndex = factor * currVariableBorrowIndex
	factor = (1 + x)^n		x = 可变债年化，n = now - 上次更新时间
		展开二项式 ≈ 1 + n*x + n(n-1)*x^2/2 + n(n-1)(n-2)*x^3/6
	← 可变债复利

总利息 = 可变债新增利息 + 稳定债新增利息
	可变债新增利息 = scaled可变债 * nextVariableBorrowIndex - scaled可变债 * currVariableBorrowIndex
	稳定债新增利息 = 当前稳定债面值 - 上次储备更新时点对应的稳定债面值
		（两个时间戳各算一次 (1+x)^n 累计系数再相减；x 是平均稳定利率）

金库记录：
	accruedToTreasury += (总利息 * reserveFactor) / nextLiquidityIndex
	存的是 scaled，不是立刻 mint/转账

口播别把名字说成 liquidationIndex / liquidationRate——是 liquidityIndex / liquidityRate。


然后算账户级 HF（和 borrow 同一套 GenericLogic.calculateUserAccountData）。
清算这里主要只要 HF，不查「可借额度 LTV」。
（LTV 是 borrow 用的；HF 分子用的是清算阈值 liquidationThreshold。）

	无债：HF = max
	有债：HF = (总抵押_base * avg清算阈值) / 总债务_base

	总抵押、总债务怎么累加：和 Session2 borrow 一样，扫位图里「有抵押或有借款」的储备，预言机折 base currency。
	标不标抵押都不影响 aToken 按指数生息；usingAsCollateral 只决定算不算进 HF/LTV。


拿到 HF 之后，用 _calculateDebt 定「这次实际清算多少债」。

Close Factor（管还多少债，不管多拿多少抵押）：
	HF &gt; 0.95	→ closeFactor = 50%
	HF ≤ 0.95	→ closeFactor = 100%

注意：作用对象是「该 debtAsset 上」借款人的稳定债+可变债总额，不是全账户所有币种的债。

	userTotalDebt = 该资产稳定债面值 + 可变债面值
	maxLiquidatableDebt = userTotalDebt * closeFactor
	actualDebtToLiquidate = min(debtToCover, maxLiquidatableDebt)

返回：(可变债面值, 该资产总债 userTotalDebt, 实际清算债额 actualDebtToLiquidate)

所以实际清算额永远 ≤ 该资产总债，不会还得比欠的还多。
Close Factor 100% 只是「最多允许还光」，不是「保证还光」——后面抵押不够还会再下调。


然后 validateLiquidationCall（对照 validateBorrow）：
	borrow：借前要求 HF &gt; 1，且查 LTV 可借
	liquidate：要求 HF &lt; 1，不查 LTV

校验顺序白话版：
	1) 抵押侧、债务侧市场都要 active，且没 pause
	2) 预言机哨兵（有配置时）：
		三个条件或：没配哨兵 OR HF &lt; 0.95 OR 哨兵说允许清算
		作用：L2 排序器宕机/grace 时，拦住「半危仓」被乱清算；
		HF 已经 &lt; 0.95 则旁路强制允许（坏账风险更大）。
		0.95 这个数和 Close Factor 阈值相同，含义不同，别混。
		面试主叙事可一句带过。
	3) HF 必须 &lt; 1（HEALTH_FACTOR_LIQUIDATION_THRESHOLD = 1e18）
	4) 只能清算「已启用抵押」的资产：清算阈值 ≠ 0 且位图 usingAsCollateral
	   只存未勾抵押的 aToken 不能被拿去偿债
	5) 该 debtAsset 上用户真的有债：稳定+可变合计 ≠ 0

失败整笔回滚，不会 burn、不会转账。


校验过了，取 liquidationBonus（配置里一般约 10500 = 105%，多拿约 5% 抵押）。
eMode 可能覆盖 bonus/价格源——面试不展开，按普通模式讲。

读借款人该抵押 aToken 余额：
	userCollateralBalance = aToken.balanceOf(借款人)
	这是「含息后面值」≈ scaled * liquidityIndex / RAY
	不是当初存入本金裸数，也不是 scaled 本身。


然后 _calculateAvailableCollateralToLiquidate：按 oracle 把「还这么多债」换成「应拿走多少抵押（含 bonus）」。

口算（BTC 抵押 / USDC 债 举例）：
	假设 actualDebt = 5000 USDC，USDC=$1，BTC=$50000，bonus=105%

	1) 裸覆盖（无 bonus）
		baseCollateral = 债额 * 债价 / 抵押价
					   = 5000 * 1 / 50000 = 0.1 BTC

	2) 乘 bonus
		max抵押 = 0.1 * 105% = 0.105 BTC
		多出来的 0.005 BTC ≈ 5% 奖励，从借款人抵押里扣，不是协议增发

	3a) 抵押够（比如有 1 BTC）
		清算人付 5000 USDC，拿 0.105 BTC（协议费=0 时）
		借款人：USDC 债 -5000，BTC 抵押 -0.105

	3b) 有协议费 liquidationProtocolFee（配置比例，不一定是 10%，那只是举例）
		bonus段 = 总拿走抵押 - 总拿走抵押 / bonus
				= 0.105 - 0.105/1.05 = 0.005 BTC
		协议费 = bonus段 * 协议费比例（比如 10% → 0.0005 BTC）
		清算人实得 = 0.105 - 0.0005 = 0.1045 BTC
		还债仍是 5000

	3c) 抵押不够（只剩 0.08 BTC &lt; 0.105）
		拿走全部 0.08 BTC
		反算还债：debtAmountNeeded = (抵押价值换算成债) / bonus
				≈ (0.08 * 50000) / 1 / 1.05 ≈ 3810 USDC
		actualDebtToLiquidate 下调到约 3810
		不能「付 5000 却只拿得到 0.08」
		同样从「全部抵押」里拆出 bonus 段，再抽协议费给金库

口播一句：先按债算该拿多少抵押（×bonus）；抵押不够就减债，不硬拿。
bonus 和协议费都从借款人被扣的抵押里出。


位图可能清两处（各自独立）：
	若 userTotalDebt == actualDebtToLiquidate
		→ 该债务资产债清光 → setBorrowing(debtReserve.id, false)
	若 actualCollateral + 协议费 == 借款人该 aToken 余额
		→ 该抵押扣光 → setUsingAsCollateral(collateralReserve.id, false)

什么时候能还光债？常见是 HF≤0.95 且 Close Factor=100%，debtToCover 够大、抵押也够。
若 Close Factor 只有 50%，单次最多一半，到不了清光。
若抵押不够只还了 3810、总债还是 5000：剩债还挂着，borrowing 不清；
	还有别的已启用抵押可以再清算；抵押都没了债还在就是坏账风险，面试一句带过。


然后 _burnDebtTokens：烧的是借款人的债务 token（欠条），不是清算人的。
真钱 USDC 还没进池，先改账。

	若 actualDebtToLiquidate ≤ 可变债面值
		只烧可变，烧 actual 那么多
	若 actualDebtToLiquidate &gt; 可变债面值
		先烧光可变，再烧稳定：actual - 可变

burn 后把 nextScaledVariableDebt / nextTotalStableDebt 等写回 cache，供后面改利率。


债务侧 updateInterestRates(added=实际清算额, taken=0)
	还债 ≈ supply：现金将回流，利用率通常下降
	和 borrow 对称：borrow 是 added=0, taken=借出额

三档年化（和 supply/borrow 同一套 calculateInterestRates）：
	先算可变借款年化、稳定报价，再算存款年化。

	借款利用率 U = 总债务 / (可用现金 + 总债务)
	总债务 = 可变债总额 + 稳定债总额
	稳定债占比 = 稳定债总额 / 总债务
	可用现金 = 合约里 underlying 余额 + added - taken
		清算这里 added=还债额，taken=0（按「钱即将进来」模拟；真正 transferFrom 在最后）

	U ≤ 拐点：
		可变年化 = base + variableSlope1 * (U/拐点)
		稳定报价 = (variableSlope1 + 稳定加价) + stableSlope1 * (U/拐点)
	U &gt; 拐点：
		excess = (U - 拐点) / (1 - 拐点)
		可变年化 = base + variableSlope1 + variableSlope2 * excess
		稳定报价 = (variableSlope1 + 稳定加价) + stableSlope1 + stableSlope2 * excess

	若稳定债占比 &gt; 稳定债最优占比：
		excessStable = (稳定债占比 - 最优占比) / (1 - 最优占比)
		稳定报价 += stableRateExcessOffset * excessStable
		← 这是利率策略构造时配的「稳定债过多额外加价」，不是位运算偏移

	存款年化 = 整体借款年化 * 存款利用率 * (1 - reserveFactor)
	整体借款年化 = (可变债总额 * 新可变年化 + 稳定债总额 * 平均稳定利率) / 总债务
		注意：乘稳定债用的是平均稳定利率，不是稳定报价
	unbacked=0 时存款利用率 ≈ 借款利用率（跨链未备兑面试可略）


隔离模式 isolationModeTotalDebt 回退：
	隔离抵押时协议记「靠这抵押借出了多少」，清算还债就减去占用。
	面试不讲。


清算人拿抵押两种形态：

	receiveAToken = false（不要 aToken，要币）：
		对「抵押侧」Reserve：cache + updateState + updateInterestRates(taken=抵押量)
		再 burn 借款人 aToken，把 underlying（BTC）转给清算人 msg.sender
		出金前结息能理解；updateState 管「时间→指数」，updateInterestRates 管「现金少了→新利率」
		开头已经结过的是债务侧另一条 Reserve；抵押是 BTC 就各算各的时间戳。
		只有抵押和债务同一资产时，开头已把该 Reserve 推到现在，这里再 updateState 可能 Δt=0，
		但 taken 改利率仍然要做。

	receiveAToken = true（收 aToken）：
		aToken 从借款人转到清算人，池子 underlying 不出
		清算人拿到生息凭证，不是立刻提现的 BTC
		仅当清算人转账前该 aToken 余额为 0（第一次拿到）才可能自动勾抵押：
			validateAutomaticUseAsCollateral
			隔离资产 / 清算人已在隔离 / LTV=0 → 一般不自动勾
			通过才 setUsingAsCollateral 写清算人自己的位图
		不通过就只生息，不算进 HF；以后要抵押自己再调 setUserUseReserveAsCollateral


清算协议费（若配置了）：
	从 bonus 段抽，aToken 从借款人 transferOnLiquidation 到金库地址
	不是 burn 成 underlying

	为啥要 / liquidityIndex 成 scaled：
		协议费是面值，用户账是 scaled，直接比容易 1 wei 对不齐
		fee_scaled 和 user_scaled 比：
		若 fee_scaled &gt; user_scaled → 面值改成 user_scaled * index（最多抽光剩余）
		然后再按调整后面值转给金库


最后一步：清算人把债务 underlying（USDC） safeTransferFrom 进债务 aToken 合约
	= 池子现金回来
	再 handleRepayment
	顺序上：burn 债、扣抵押在前，付钱在后；任一步失败整笔回滚，清算人不会白白付钱

emit LiquidationCall


和 MetaNode 永续对比（面试加分，四点）：
	触发：Kinza 是 HF &lt; 1；MetaNode 是 netValue &lt; MM
	执行：Kinza 按「抵押资产+债务资产」分笔 + Close Factor；永续常整笔强平
	激励：Kinza 多拿约 5% 抵押（数量 bonus）；永续常折扣价接盘
	账户粒度：两边都是账户级风控指标


30 秒收口：
	清算人调 liquidationCall，指定抵押币、债务币、借款人。
	债务侧先结息，算账户 HF；HF&lt;1 才能清。
	Close Factor 限制单次最多还该债务资产 50% 或 100%；bonus 让清算人多拿一点抵押。
	烧借款人债务，把抵押（aToken 或 underlying）给清算人，最后清算人把债务币打进池子。
	操作按资产对，风控按账户。


易错：
	1. liquidityIndex ≠ liquidationIndex；liquidityRate ≠ liquidationRate
	2. Close Factor 管债；liquidationBonus 管多拿抵押——两件事
	3. 清算不查 LTV 可借，只查 HF &lt; 1
	4. 实际清算额 ≤ 该资产总债；抵押不够再下调，剩债可继续挂着
	5. 标抵押仍生息；burn 债务只是改账，钱最后才 transferFrom
	6. 隔离 / eMode / 哨兵：有代码，主叙事可不展开</pre>
