# 巷厕 — 明天从这里接

后台 `/admin/sim`（admin / P@ssw0rd）。参数在 `sim_config`。模拟进程还没打 API，和 App 隔离。

## 1. 基本轴（排序用这些，不是 lewd/chest）

肉厕一档一个值；男人同一套。`looks = 卖点勾选数 / 5`。

| 轴 | 肉厕 | 男人 | 怎么乘 |
|---|---|---|---|
| cup | 实际罩杯 one-hot | 对 B/C/D/E 各打 −1～1，可多项为正 | `男人[那档罩杯]`，再 `(x+1)/2` |
| personality | 实际性格 one-hot | 对 8 个性格各 −1～1 | 同上 |
| demeanor | 实际姿态 one-hot | 对 6 个姿态各 −1～1 | 同上 |
| age / height / weight | 0～1 归一 | −1～1（幼/高/瘦 对 熟/矮/胖） | `男人 × (2×肉厕−1)` 再折 0～1 |
| moan, skill, orgasm, feel, persona, condom, marriage | 程度表 0～1 | 目标 0～1 | `1 − \|男人−肉厕\|` |
| looks | 勾选/5 | 0～1 | 同上 |
| rel_母亲…路人 | 关系 one-hot | taste 0～1 | 点乘 |

代码：`src/lib/dims.ts`。程度表：`text_scale`（轴名=字段名）。男人向量：`behavior_male.dims`。

经济观另 8 维（`behavior_econ`）：cash_tight, bargain, flip, hold, rent, prestige, family_liquidate, use_over_own。只调排序和买不买，不是吸引轴。

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

`dimScore` 平均各轴 → `scoreWithEcon` → 近到远。hours/quota **不是轴**，是营业限制（配额还没执行）。

## 3. 未接（已写进 /admin/sim，模拟进程未打）

| 参数 | 默认 | 用途 |
|---|---|---|
| simTickSec | 180 | 多久醒来做一次决定 |
| useScoreMin | 0.35 | 低于此不租 |
| selfUseScoreMin | 0.4 | 用自己的也要够分 |
| buyScoreMin | 0.2 | wouldBuy 最低吸引（函数在 `econ.ts`，无人调用） |
| listStaleDays | 7 | 挂了没人买 → 改价/撤 |
| dailyBudgetFen | 1500 | 一天最多花 |
| maxConcurrentOrders | 1 | 同时锁几单 |
| condomMatchMin | 0.25 | 套偏好对不上不点 |
| enforceDailyQuota | 1 | 一天一客等是否真限制 |
| buyCooldownHours | 24 | 刚买下不立刻再卖 |
| reviewReturnMin | 3 | 低于此评分不再点这具 |
| walletStopFen | 200 | 现金低于此停手 |
| boredSwitchMin | 0.55 | 厌了先娼别人，还是挂自己的 |

接模拟时读 `loadSimConfig()`，不要写死。

## 明天建议顺序

1. 模拟 tick：附近 → dimScore → useScoreMin → 锁 30 分钟 → 扣钱抽成 → bump 厌腻 → maybeList  
2. wouldBuy 接 buyScoreMin，转让成交  
3. 日预算 / 停手 / 同时一单  
4. 配额、套匹配  

GPS 节奏先不要做细。主程序别塞模拟字段。
