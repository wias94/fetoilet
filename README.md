# 巷厕 — 模拟 tick 已接最简版

后台 `/admin/sim`（admin / P@ssw0rd）。参数在 `sim_config`。tick 只跑 `sim_enabled` 的男人，写市场表，不打 App 接口。

## 1. 基本轴（排序用这些，不是 lewd/chest）

肉厕一档一个值；男人同一套。`looks = 卖点勾选数 / 5`。**关系合成一轴**（只看她的关系对应的 taste），权重可在 `/admin/sim` 吸引页调。

| 轴 | 肉厕 | 男人 | 怎么乘 |
|---|---|---|---|
| cup | 实际罩杯 | 对 B/C/D/E 各打 −1～1 | `男人[那档罩杯]`，再 `(x+1)/2` |
| personality | 实际性格 | 对 8 个性格各 −1～1 | 同上 |
| demeanor | 实际姿态 | 对 6 个姿态各 −1～1 | 同上 |
| age / height / weight | 0～1 归一 | −1～1（幼/高/瘦 对 熟/矮/胖） | `男人 × (2×肉厕−1)` 再折 0～1 |
| moan, skill, orgasm, feel, persona, condom, marriage | 程度表 0～1 | 目标 0～1 | `1 − \|男人−肉厕\|` |
| looks | 勾选/5 | 0～1 | 同上 |
| rel | 她的关系 | 对应 taste | 单轴，不再被另外 7 个 0 稀释 |

代码：`src/lib/dims.ts`。程度表可在管理台改。男人向量：`behavior_male.dims`。

经济观另 8 维（`behavior_econ`）：cash_tight, bargain, flip, hold, rent, prestige, family_liquidate, use_over_own。只调排序和买不买，系数在管理台。

## 2. 已接阈值和算法

### 空间 / 占用

| 参数 | 默认 | 影响 | 算法 |
|---|---|---|---|
| nearbyRadiusM | 3000 | 可见、可点 | 距 > 半径直接不可见 |
| locationIntervalSec | 180 | GPS 上报 | 每 3 分钟 |
| rentSessionMin | 30 | 锁货 | 点单后 busy_until；到期释放。挂牌出租先到先得必须接 |

### 抽成（周，不是厌腻）

| 参数 | 默认 | 轴 | 算法 |
|---|---|---|---|
| otherWeekCutPct / Cap | 10 / 50 | relation 非家人 | 满 n 周平台拿 min(cap, 10n)% |
| familyWeekCutPct / Cap | 20 / 80 | 母/妻/女/兄妹 | min(80, 20n)% |
| — | — | 主人自用 | 不扣钱、不抽成 |

差价进 platform 钱包。卖掉后新主人从 100% 重新计。

### 厌腻 + 自动挂转让

| 参数 | 默认 | 轴 | 算法 |
|---|---|---|---|
| satiationHalfUses | 4 | 主人自己用的次数 | sat = 1 − e^(−累计重量/4) |
| selfUseSatiation | 1.35 | 自用 vs 外人用 | 自用一次重量 1.35，外人对主人厌腻不算 |
| listKeepThreshold | 0.45 | 分成 × 厌腻 | keep = 主人分成 × (1−sat)。**已抽成**且 keep < 0.45 才挂转让 |

周只改分成。次数只改厌腻。两头都够才挂。

### 定价 / 钱包

| 参数 | 默认 | 轴 | 算法 |
|---|---|---|---|
| platformSaleFen / RentFen | 1000 / 200 | owner=platform | 一口价 C$10 / C$2 |
| wealthMeanCad / Sigma | 100 / 0.9 | 男钱包 | 对数正态，均值 x |
| marketUseNorm, MulMin, Span | 2.2, 0.72, 0.58 | 7 日用量、占用 | pressure 再乘租价 |
| rentFloorMul / CeilMul | 0.55 / 1.85 | 底价 hour_fen | 活价夹在底价×此区间 |
| earnMultiplier | 写死 | 7 日单量 | ≥6 次 1.45 … 没人用 0.48 |
| scoreWithEcon | 写死 | cash_tight, prestige, rent, hourFen | 吸引分再乘价格敏感 |

点单：扣客人钱包 → 抽成后打给主人/平台。

### 排序

`dimScore` 按轴权重平均 → `scoreWithEcon` → 近到远。hours/quota 不是轴：`enforceDailyQuota=1` 时按挂牌时段和一天一客限制。

## 3. 最简 tick（`src/lib/sim-tick.ts`）

**tick = 一轮模拟时钟。** 自动扫已关（`startSimLoop` 空转），避免打爆 Neon。只手点「跑一轮」。只动 `loc-m-*` 男人；附近真人肉厕可以被租/买。

打开 `/admin/sim` 会把没封的男人设成 `sim_enabled`。原点：男人自己的 GPS → 没有就用名下货，不写死城市。location 世界快照的第四段 `status` 写入 `user_state.loc_status`。上班 / 上学 / 通勤跳过。

每人每 `simTickSec` 最多一次：

1. 自用：`score ≥ selfUseScoreMin` 且厌腻 `< boredSwitchMin` → 免费、bump × selfUseSatiation、maybeList
2. 否则钱包 `< walletStopFen` 或日花费 ≥ dailyBudgetFen 或已有 maxConcurrentOrders → 停
3. 附近租：`score ≥ useScoreMin` → 锁 `rentSessionMin` 分钟、一口价扣钱抽成
4. 否则挂牌：`wouldBuy` 且 `score ≥ buyScoreMin` → 买下（买后 `buyCooldownHours` 内不挂）

| 参数 | 默认 | 作用 |
|---|---|---|
| simTickSec | 180 | 同一个人两次决定最短间隔 |
| autoTick | 0 | 1=自动扫（loop 现已停） |
| tickEverySec | 30 | 自动时钟间隔 |
| tickBatch | 80 | 一轮最多处理人数 |
| dailyWageFen | 3000 | 每人每天 C$30 津贴 |
| useScoreMin | 0.35 | 低于此不租别人的 |
| selfUseScoreMin | 0.4 | 用自己的也要够分 |
| buyScoreMin | 0.2 | wouldBuy 最低吸引 |
| maxConcurrentOrders | 1 | 同时锁几单 |
| dailyBudgetFen | 1500 | 当天花完停手，0=不限 |
| walletStopFen | 200 | 现金低于此不租不买（自用仍可） |
| boredSwitchMin | 0.55 | 厌腻超此先嫖别人 |
| buyCooldownHours | 24 | 刚买下不立刻再卖 |

后台 `/admin/sim` 世界页：近 1 小时 / 24 小时统计、跳过原因、近 24 轮、世界 log。自动开着时自己刷新。

套匹配、差评回流、营业配额、挂牌过期已接到 tick（限制页）。主人自用不受这四项限制。评语暂不由 tick 写。
