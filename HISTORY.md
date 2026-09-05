# 持久化历史

从部署迁移 0039 开始记录，不补造过去记录。历史归档独立运行；自动模拟是否执行由现有 autoTick 配置控制。

- `history_changes`：人物资料、厕所、当前位置、行为参数、订单、钱包、账本、事件及模拟记录的 INSERT / UPDATE / DELETE，包含时间和变更前后 JSON。与业务写入同事务，失败一起回滚；完全相同的 UPDATE 不重复记录。不记录认证 account/session/token 表。
- `history_daily`：按 America/Toronto 日期，每天首次成功检查时保存人物、厕所、位置和行为参数等 9 类状态。每天每类一次。JSON 是当时状态，不是精确日终状态。
- `scripts/history-worker.mjs`：Docker 启动后独立运行，每 60 秒检查一次；数据库暂时不可用或迁移尚未完成时重试。
- `sim_log`：取消原来的 3 天 / 4000 条自动清理，现有事件和模拟记录会继续保存。
- 数据放在现有 PostgreSQL 持久卷；没有自动删除策略。磁盘占用会持续增长，容器卷不是异机备份。
- 停机期间没有快照；启动后只记录当天，不伪造缺失天数。历史仅从功能启用时开始。

只读查询示例：

```sql
SELECT recorded_at, source, operation, entity_id, before_data, after_data
FROM history_changes
WHERE source = 'stalls' AND entity_id = '目标ID'
ORDER BY recorded_at, id;

SELECT day, source, recorded_at, data
FROM history_daily
WHERE day = DATE '2026-09-05';
```

历史包含应用业务资料，应使用现有管理员数据库权限查询，不公开发布查询接口。
