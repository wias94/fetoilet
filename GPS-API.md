# GPS API

男性 / 女性位置。每 **3 分钟** 报一次，附近固定 **3 公里**。不要报速度、朝向。

线上：`https://fetoilet-production.up.railway.app`

---

## 鉴权

登录用户：Cookie 或 `Authorization: Bearer <session>`  
管理员：`x-admin-key: <ADMIN_API_KEY>`

---

## 上报位置

```http
PUT /api/v1/location
```

```json
{ "lat": 31.1883, "lng": 121.437, "source": "fake" }
```

`source`：`gps`（真机）/ `fake`（测试）。只要 `lat`、`lng`。

真机 `gps` 3 分钟内重复上报会被跳过，返回 `updated: false` 和 `retry_after_s`。`fake` 不限次数。

女性上报后，坐标写到她的资料上，男性才能搜到。

```json
{
  "ok": true,
  "updated": true,
  "retry_after_s": 180,
  "location": {
    "lat": 31.1883,
    "lng": 121.437,
    "source": "fake",
    "updated_at": "2026-08-23T22:14:00.000Z"
  }
}
```

读自己：`GET /api/v1/location`

---

## 附近女性（3km）

```http
GET /api/v1/nearby
```

用自己最后一次坐标。也可以 `?lat=31.1883&lng=121.437`。半径写死 3000 米，没有别的参数。

`stalls` 就是 3 公里内的女性，带 `distance_m`。

---

## 伪 GPS 测试点（上海）

| 区 | lat | lng |
|---|---|---|
| 徐汇 | 31.1883 | 121.437 |
| 静安 | 31.2235 | 121.4454 |
| 黄浦 | 31.2317 | 121.485 |
| 长宁 | 31.2205 | 121.424 |
| 浦东 | 31.2215 | 121.544 |

管理员给某用户写坐标（不限 3 分钟）：

```http
PATCH /api/v1/admin/users/:id
{ "location": { "lat": 31.1883, "lng": 121.437, "source": "fake" } }
```

---

## curl

```bash
BASE=https://fetoilet-production.up.railway.app

curl -X PUT "$BASE/api/v1/location" \
  -H "Cookie: …" -H "Content-Type: application/json" \
  -d '{"lat":31.1883,"lng":121.437,"source":"fake"}'

curl "$BASE/api/v1/nearby" -H "Cookie: …"
```

真机每 3 分钟 `PUT` 一次，`source: "gps"`。必须 HTTPS。
