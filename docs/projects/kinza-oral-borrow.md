---
aside: false
outline: false
---

# Kinza · borrow 白话口播稿

> 口语化手写详稿，方便闭卷前过一遍。  
> 对应：[Session2 结构化笔记](./kinza-session2-borrow)

<pre class="oral-notes">borrow

说一遍 borrow 借出的流程，和supply 存入有很多相似之处
都是一开始的 cache，将要借出的underlying 的reserve 从 storage 缓存到 memory中 为了 省gas费用

然后再开始进行 updateState： 同区块已updateState 直接return；
更新 nextLiquidityIndex 流动性指数 和 nextVariableBorrowIndex 可变债指数
对于 nextLiquidityIndex = factor * curLiquidityIndex
	factor = RAY + (currLiquidityRate年化率 * (now - 上次更新时间)/(365 * 24 * 60 * 60))

对于 nextVariableBorrowIndex = factor * curVariableBorrowIndex
	factor = （1 + x）^ n 	x:可变债年化利率	n:now - 上次更新时间
		   展开二项式
		   = 1 + n * x + n*(n-1)*x^2/2 + n*(n-1)*(n-2)*x^3/6

更新 nextLiquidityIndex 流动性指数 和 nextVariableBorrowIndex 可变债指数

再 计算利息 对利息进行抽成放入金库
先算 可变债的新增利息 = 当前可变债务总额（currScaledVariableDebt * nextVariableBorrowIndex） - 上一次的可变债务总额（currScaledVariableDebt * currVariableBorrowIndex）

再算 稳定债的新增利息 = 当前的稳定债务总额 - 上一次的稳定债务总额
	上一次的稳定债务总额 = 稳定债务本金 * 上一次的累计系数
	上一次的累计系数 = （1 + x）^ n   x：平均的稳定债借款年化率		n：计息时间 （储备上次更新时间 - 稳定债务上次更新时间就是债务的借还时间）
					展开二项式
				  = 1 + n * x + n*(n-1)*x^2/2 + n*(n-1)(n-2)*x^3/6

	当前的稳定债务总额 = 稳定债务本金 * 当前的累计系数
	当前的累计系数 = (1 + x) ^n 	x：平均的稳定债借款年化率 	n：计息时间（now - 稳定债务上次更新时间就是债务的借还时间）

总利息 = 可变债的新增利息 + 稳定债的新增利息

总利息 * 利息抽成 得到 要给金库转入的份额
记录时 需要用新流动性指数将实际金额换算成缩放金额后累计
accruedToTreasury += (总利息 * reserveFactor利息抽成)/nextLiquidityIndex


再进行验证 相对于 supply 的核心增量：抵押、借前 HF&gt;1、LTV可借额度、borrow cap、模式开关等。 失败则整笔回滚，不会 mint 债务也不会出金。

首先先看 市场是否启动，是否冻结，借出操作是否可以，稳定利率借款开关是否打开，用户是否允许操作。
再判断 预言机是否正常，异常则拒绝新借款
再判断借款方式为固定利率还是可变利率借款，两者只能选择其中一个

再拿到 underlying资产的精度位数 以及 该资产允许的总借款上限，以整币为单位；0表示不设上限，限制的是储备的总债务，不是用户个人额度
然后计算 当前可变总债务额度 = 当前可变总债务本金 currScaledVariableDebt * 可变债务利率 nextVariableBorrowIndex
算 总债务 = 当前稳定总债务（稳定总债务本金 * 平均利率） + 当前可变总债务额度 + 本次借出额度
判断 总债务 需要 小于 资产的总借款上限


根据 isolationModeActive 判断如果再隔离模式下	隔离模式是限制高风险资产当抵押后的可借范围和债务上限；
	检查配置 当前要借的资产是否允许借出 以及
	使用这项隔离抵押品产生的累计借款，加上本次借款后，是否超过该抵押品的 debt ceiling 债务上限

再判断 用户是否启用了 eMode 效率模式		eMode 是高相关资产用更高 LTV；priceSource 可选地让这一类资产按同一个预言机源计价。
	本次借款资产是否符合该模式的类别限制，并选择后续估值使用的价格源。


然后 账户级： 开始统计 已标抵押的 aToken；债务加总；加权 LTV / 清算阈值；HF
	validateBorrow、withdraw、清算前都会用到
		只统计位图里已标抵押的 aToken 进总抵押；已标借款的进总债务
		HF = (总抵押 * avg清算阈值)/总债务 		&lt;- - 用清算阈值，不是LTV
		可借 = 总抵押 * avgLTV - 总债务 		&lt;- - 能借多少用 LTV


		先看抵押测怎么计算 
		循环内：按reserve id 扫一遍，跳过「既不当抵押也不借款」和列表空洞，再读配置、取价，然后分别累加抵押和债务
			对满足「清算阈值 不等于 0 且 已标抵押」 的每一条资产
			总抵押 += 抵押_base_i
			抵押 = aToken 面值_i * 价格_i / 10^decimals
			aToken面值 = scaled_i * liquidityIndex_i / RAY

			用于加权的LTV / 清算阈值：若该资产在用户同一 eMode 类，用 eMode 的参数；否则用本资产配置。
			LTV_i_有效 = eMode内 ? eModeLtv : ltv_i
			清算阈值_i_有效 = eMode内 ? eModeLiqThreshold : liquidationThreshold_i

			累加分子（循环里的 avgLtv / avgLiquidationThreshold 此时还是「未除尽的分子」）
			若 LTV_i_有效 不等于 0
				avgLtv分子 += 抵押_base_i * LTV_i_有效
			否则：
				hasZeroLtvCollateral = true 	这笔抵押不贡献可借额度

			avg清算阈值分子 += 抵押_base_i * 清算阈值_i_有效

		出循环后做加权平均：
			avgLTV = avgLtv分子 / 总抵押_base
			avg清算阈值 = avg清算阈值分子 / 总抵押_base
			(万分比，如 8000 = 80%)


			仍在循环内：
			计算债务侧：
				只要位图显示在借资产 j （与是否抵押无关）
					可变债面值_j = scaledVariable_j * variableBorrowIndex_j / RAY
					稳定债面值_j = StableDebtToken.balanceOf(user)  已含复利
					债务_base_j = (可变债面值_j + 稳定债面值_j) * 价格_j / 10^decimals_j

					总债务_base += 债务_base_j


		最后计算HF
			无债务：HF = max
			有债务：HF = （总抵押_base * avg清算阈值）/ 总债务_base

			和借款校验的关系：
				能借多少用 avgLTV： 		可借 = 总抵押 * avgLTV - 总债务
				安不安全用 avg清算阈值：	HF = 总抵押 * avg清算阈值 / 总债务

判断 HF &gt; 1 确保健康
再对本次借款折成 base = （预言机价格 * amount / 10^decimals）

(已有债_base + 本次借_base) / LTV &lt;= 总抵押_base

判断用户是否为稳定利率借款 如果是：
	校验市场开启了稳定借款
	不能 用同币抵押再借同币稳定利率 套利率（除非借的比自己该资产aToken余额还多等例外）
	amount &lt;= 池内可用现金 * maxStableLoanPercent(例如最多借现金的25%)

判断如果是否为仓位隔离借款 如果是：
	若已经在借某种siloed资产，就只能继续借同一种
	若这次要借的资产本身是 siloed，不能同时还欠着别的资产

可变借款一般不会在这里验 池子有没有足够的underlying 那是最后 transferUnderlyingTo 的事情


validateBorrow通过之后，判断借款是哪个利率来进行 对用户 mint债务
	若 为稳定 STABLE：
		currentStableRate = reserve.currentStableBorrowRate	// 此刻的稳定报价
		StableDebtToken.mint(user, onBehalfOf, amount, currentStableRate)
		把这个利率锁进借款人 之后利用率变了也不改这笔债的锁定利率
		返回并写入cache：nextTotalStableDebt、nextAvgStableBorrowRate
		供后面算三档利率用
	若 为可变 VARIABLE：
		VariableDebtToken.mint(..., amount, nextVariableBorrowIndex) -&gt; scaled = amount * RAY / nextVariableBorrowIndex
		实际欠款 = scaled * index / RAY
		返回全池 scaledTotalSupply -&gt; 写入 nextScaledVariableDebt


首次借这条资产
	isFirstBorrowing -&gt; userConfig.setBorrowing(reserve.id, true)
	位图偶数位置为1，表示这个人在借这个资产

updateInterestRates(added=0, taken=amount) 有借还 -&gt; 更新三档年化
	转账还没发生，taken = amount 表示现金马上要少
	债务已用mint 后的next*，利用率通常上升
	写出下一时段的存款年化、稳定报价、可变借款年化
	和supply 对称：supply是 added=amount，taken=0

出金
	aToken.transferUnderlyingTo(params.user, amount)
	从aToken 合约转 underlying 给发起借款的人(msg.sender)
	债务可以记在 onBehalfOf名下；钱默认给 user
	余额不够则转账失败，整笔回滚

emit Borrow
	稳定：事件里的利率是锁定的 currentStableRate
	可变：是刚更新后的 currentVariableBorrowRate</pre>
