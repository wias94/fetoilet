# GPS API

巷厕位置接口。真机用浏览器定位，测试用伪 GPS。字段一样。

线上：`https://fetoilet-production.up.railway.app`  
本地：`http://localhost:8080`

完整合同也可以直接打开：`GET /api/v1`

---

## 鉴权

| 谁 | 怎么带 |
|---|---|
| 登录用户 | Cookie，或 `Authorization: Bearer <session>` |
| 管事 | 管事账号 Cookie，或请求头 `x-admin-key: <ADMIN_API_KEY>` |

未登录返回 `401`。被封的号除了 `GET /api/v1/me` 一律 `403`。

---

## 坐标格式

所有上报、改位置都用这个 JSON：

```json
{
  "lat": 31.1883,
  "lng": 121.437,
  "accuracy_m": 15,
  "heading": 0,
  "speed_mps": 0,
  "source": "fake"
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `lat` | 是 | -90 ~ 90 |
| `lng` | 是 | -180 ~ 180 |
| `accuracy_m` | 否 | 精度，米 |
| `heading` | 否 | 朝向，度 |
| `speed_mps` | 否 | 速度，米/秒 |
| `source` | 否 | `gps` / `fake` / `manual` / `ip`。不传当 `fake` |

返回：

```json
{
  "ok": true,
  "location": {
    "lat": 31.1883,
    "lng": 121.437,
    "accuracy_m": 15,
    "heading": 0,
    "speed_mps": 0,
    "source": "fake",
    "updated_at": "2026-08-23T22:14:00.000Z"
  }
}
```

没有位置时 `"location": null`。

---

## 伪 GPS（测试）

`source` 填 `fake`，坐标用下面预设或自己填。

| 区 | lat | lng |
|---|---|---|
| 徐汇 | 31.1883 | 121.437 |
| 静安 | 31.2235 | 121.4454 |
| 黄浦 | 31.2317 | 121.485 |
| 长宁 | 31.2205 | 121.424 |
| 浦东 | 31.2215 | 121.544 |

真机以后把 `source` 改成 `gps`，其它字段不用改。浏览器侧用 `navigator.geolocation.getCurrentPosition`。

---

## 用户接口

### 读自己位置

```http
GET /api/v1/location
```

### 上报 / 伪 GPS

```http
PUT /api/v1/location
Content-Type: application/json
```

有肉厕账号时，这次坐标会同步到那具货上，附近列表才能搜到。

### 附近

```http
GET /api/v1/nearby?radius_m=3000
GET /api/v1/nearby?lat=31.1883&lng=121.437&radius_m=3000
```

不传 `lat` `lng` 就用自己最后一次位置。`radius_m` 默认 3000，范围 100 ~ 20000。

```json
{
  "ok": true,
  "origin": { "lat": 31.1883, "lng": 121.437 },
  "radius_m": 3000,
  "stalls": [
    {
      "id": "t…",
      "name": "…",
      "area": "徐汇",
      "online": true,
      "hour_fen": 1500,
      "eta_min": 12,
      "image": "https://…",
      "lat": 31.189,
      "lng": 121.438,
      "distance_m": 140
    }
  ]
}
```

没报过位置又没带坐标：`400`，提示先 `PUT /api/v1/location`。

### 当前用户（含位置、是否被封）

```http
GET /api/v1/me
```

---

## 管事接口

头里带 `x-admin-key`。

### 替某个号写伪坐标

```http
PATCH /api/v1/admin/users/:id
Content-Type: application/json

{ "location": { "lat": 31.1883, "lng": 121.437, "source": "fake" } }
```

### 所有人最后位置

```http
GET /api/v1/admin/locations
```

### 封禁 + 关坑 + 改位置（可一起）

```http
PATCH /api/v1/admin/users/:id

{
  "banned": true,
  "ban_reason": "spam",
  "stall_online": false,
  "location": { "lat": 31.1883, "lng": 121.437, "source": "fake" }
}
```

---

## curl 示例

伪 GPS 报到徐汇（先登录拿到 Cookie，或管事用 admin key 改别人）：

```bash
BASE=https://fetoilet-production.up.railway.app

# 自己上报
curl -X PUT "$BASE/api/v1/location" \
  -H "Cookie: __Host-grok-auth.session_token=…" \
  -H "Content-Type: application/json" \
  -d '{"lat":31.1883,"lng":121.437,"accuracy_m":15,"source":"fake"}'

# 附近
curl "$BASE/api/v1/nearby?radius_m=3000" \
  -H "Cookie: __Host-grok-auth.session_token=…"

# 管事给某号塞坐标
curl -X PATCH "$BASE/api/v1/admin/users/USER_ID" \
  -H "x-admin-key: $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"location":{"lat":31.2235,"lng":121.4454,"source":"fake"}}'
```

---

## 浏览器真 GPS

```js
navigator.geolocation.getCurrentPosition(async (pos) => {
  await fetch("/api/v1/location", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy_m: pos.coords.accuracy,
      heading: pos.coords.heading,
      speed_mps: pos.coords.speed,
      source: "gps",
    }),
  });
});
```

必须 HTTPS。用户拒绝授权就只能走 `fake` / `manual`。接口不能替用户打开 GPS。
