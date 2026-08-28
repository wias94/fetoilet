# 巷厕 — 模拟已接

后台 `/admin/sim`（admin / P@ssw0rd）。参数在 `sim_config`。模拟只跑 `sim_enabled` 的男人，不打 App 接口。

## 隔离

- tick：`src/lib/sim-tick.ts` / `sim-world.ts`，只从后台「跑一轮」进
- 性格门槛（醒来、时段、选厕、写评、捂货）只 tick 读
- 真用户页面不展示 `sim_enabled` / 性格轴
- 市场事实表 `stalls / inquiries / wallets / reviews` 共用，人少时 NPC 填附近

样例账号密码统一 `P@ssw0rd`。GPS 节奏先不要做细。主程序别塞模拟字段。
