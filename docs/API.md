# VisaGo 开放接口

外部应用接入用。站点 `https://visago.noworrytourism.cn`，本机开发 `http://127.0.0.1:3900`。

## 约定

- 全部接口都是 POST + JSON（只有 `/api/visa/file` 是 GET），路径形如 `/api/visa/xxx`。
- 响应统一是 `{ "success": true, "data": {...} }`；出错是 HTTP 400 + `{ "success": false, "message": "原因" }`。
- 认证有两种：
  - **管理员**：`auth` 字段放登录后的 token。也可以放在请求头 `token` / `x-api-key` / `Authorization: Bearer <token>`。
  - **客户**：`token` 是订单的邀请 token（`/join/xxx` 里那段），`auth` 是下单时返回的 `view_key`，两者都要。
- 时间戳一律是毫秒；日期一律 `YYYY-MM-DD`。
- 图片、PDF 传 `data:image/png;base64,...` / `data:application/pdf;base64,...` 这样的 data URL。

## 登录

| 接口 | 说明 |
| --- | --- |
| `/api/auth/login` | 登录，拿管理员 token |
| `/api/auth/alive` | 校验 token 还在不在 |

```jsonc
POST /api/auth/login
{ "identify": { "email": "admin@gmail.com", "password": "..." } }

→ { "success": true, "data": { "token": "..." } }
```

## 订单

状态流转：`new` 待处理 → `locked` 已锁定 → `booking` 预约中 / `queued` 排号中 / `brushing` 刷位中 / `revising` 待修改；`cancelled` 已取消。`done` 已完成不能直接设，是挂上预约信 PDF 时自动转的。锁定满半小时也会自动转成预约中。`order-set-status` 只接受 `new`、`locked`、`booking`、`queued`、`brushing`、`revising`、`cancelled`。

### 建

| 接口 | 权限 | 说明 |
| --- | --- | --- |
| `/api/visa/create` | 公开 | 下单，返回订单和 `view_key` |

```jsonc
POST /api/visa/create
{
  "customer_email": "a@b.com",          // 邮箱，必填
  "customer_name": "张三",               // 必填
  "customer_phone": "13800138000",      // 6-15 位，可带 +，必填
  "origin_code": "CN",                  // CN / UK
  "country_code": "NO",                 // 目的地国家代码
  "travelers": 1,                       // 1-5
  "flight": false, "hotel": false,      // 机票/酒店预订单，每项加一份服务费
  "passports": [                        // 数量必须等于 travelers
    {
      "first_name": "三", "last_name": "张", "phone": "13800138000",
      "birth_date": "", "gender": "", "nationality": "", "birth_place": "",
      "passport_number": "", "issue_date": "", "expiry_date": ""   // 其余字段可空
    }
  ],
  "appointment_city": "北京",            // 必须是配置里的签证中心名
  "appointment_dates": ["2026-12-08"],  // 至少一个，且在该中心开放的日期里
  "appointment_note": "",
  "travel_date": "2027-06-01",          // 要晚于最后一个递签日期
  "trip_days": 10,                      // 1-180
  "slot_support": "deny"                // allow / maybe / deny，刷位意愿
}

→ { "success": true, "data": { "order": {...}, "view_key": "..." } }
```

### 查

| 接口 | 权限 | 说明 |
| --- | --- | --- |
| `/api/visa/orders` | 管理员 | 全部订单（不含归档） |
| `/api/visa/archived-orders` | 管理员 | 归档的订单 |
| `/api/visa/order` | 管理员，或客户 `token`+`view_key` | 单个订单，含待付收款码 |
| `/api/visa/identify` | 公开 | 按邮箱查这个客户有没有单，返回订单列表和各自的 `view_key` |

```jsonc
POST /api/visa/order
{ "token": "7bf4ba81", "auth": "<view_key>" }   // 管理员传 auth=管理员 token 也行

→ { "success": true, "data": { "order": {...}, "pay_code": {...} | null } }
```

订单对象（`VisaOrderDTO`）：

```
id, create_time, update_time,
invite_token, customer_email, customer_name, customer_phone,
origin_code, origin_label, country_code, country_name, visa,
travelers, flight, hotel,
passports: [{ first_name, last_name, phone, birth_date, gender, nationality, birth_place, passport_number, issue_date, expiry_date }],
appointment_city, appointment_dates[], appointment_note,
travel_date, trip_days, slot_support, slot_support_label,
visa_fee, service_fee, extras_fee, total,
status, locked_time, position, archived, files[],
form_filled[], revision_note
```

`files[]` 是 `{ id, name, size }`，文件本体走 `/api/visa/file?id=...`。

### 改

| 接口 | 权限 | 说明 |
| --- | --- | --- |
| `/api/visa/order-update` | 客户 `token`+`view_key` | 改出行日期、天数、机票、酒店、备注、刷位意愿；`locked`/`cancelled` 之后不可改 |
| `/api/visa/order-set-status` | 管理员 | 改状态，`{ id, status }` |
| `/api/visa/order-position` | 管理员 | 预约到的位置，`{ id, position }` |
| `/api/visa/order-note` | 管理员 | 给客户的备注，`{ id, appointment_note }`（≤300 字） |
| `/api/visa/order-dates` | 管理员 | 递签日期，`{ id, appointment_dates: [...] }`，至少一个、早于出行日期 |
| `/api/visa/order-form` | 管理员 | 勾「表单已填」，`{ id, form_filled: [0, 2] }`（出行人下标） |
| `/api/visa/order-revision` | 管理员 | 设成待修改，`{ id, revision_note }`，必填 |
| `/api/visa/add-traveler` | 客户 | 加一位出行人，`{ token, auth }`，上限 5 人 |
| `/api/visa/remove-traveler` | 客户 | 删一位出行人，`{ token, auth, index }` |
| `/api/visa/passport-scan` | 客户 | 拍护照写回某个位置，`{ token, auth, index, image }` |

### 删

没有物理删除。归档和取消分开：

| 接口 | 权限 | 说明 |
| --- | --- | --- |
| `/api/visa/order-set-status` | 管理员 | `status: "cancelled"` 取消订单 |
| `/api/visa/order-archive` | 管理员 | 归档，只有已取消的订单可以归档 |
| `/api/visa/order-restore` | 管理员 | 从归档里恢复 |

## 同行人补录

给同行人的链接用的，凭 `token` 就能读写：

| 接口 | 说明 |
| --- | --- |
| `/api/visa/invite` | 查同行人清单，`{ token, slot_keys? }` |
| `/api/visa/invite-submit` | 提交一位的护照信息，`{ token, index?, passport, slot_key? }` |
| `/api/visa/invite-slot-remove` | 清掉一位填的信息，`{ token, index, slot_key }` |

## 配置

| 接口 | 权限 | 说明 |
| --- | --- | --- |
| `/api/visa/settings` | 公开 | 读配置：材料组排期、通知、每个出发地 × 目的地的价格和签证中心日期 |
| `/api/visa/save-settings` | 管理员 | 整份替换配置，`{ settings }` |

配置里每个签证中心有 `dates`（正常）和 `cautionDates`（拥挤），都是 `YYYY-MM-DD` 列表。

## 收款码

| 接口 | 权限 | 说明 |
| --- | --- | --- |
| `/api/visa/pay-code-list` | 管理员 | 列表 |
| `/api/visa/pay-code-save` | 管理员 | 新增/修改。`{ id?, amount, currency, label?, fallback?, image? }`，`image` 只在新增或换图时带 data URL |
| `/api/visa/pay-code-remove` | 管理员 | 删除，`{ id }` |
| `/api/visa/pay-code-reorder` | 管理员 | 排序，`{ ids: [...] }` |

金额命中规则：币种相同的码里找金额相等的（四舍五入到元），找不到就用同币种里 `fallback: true` 那张；英国订单先按当前汇率折成人民币再找。收款码只支持 CNY 和 GBP 两种币种。

## 文件

| 接口 | 说明 |
| --- | --- |
| `/api/visa/file?id=<file_id>` | GET，直接返回 PDF/图片字节，id 是随机串 |

## 识别与排期

| 接口 | 权限 | 说明 |
| --- | --- | --- |
| `/api/visa/ocr-passport` | 公开 | 只识别不落库，`{ image }` → `{ passport }` |
| `/api/visa/passport-photos` | 管理员 | 某订单的护照照片，`{ id }` → `{ photos: [{ index, url }] }` |
| `/api/visa/letter-dates` | 管理员 | 从预约信 PDF 认出日期，`{ id }` → `{ dates }` |
| `/api/visa/order-attach` | 管理员 | 挂预约信 PDF，`{ id, name, data }`；上传后订单变已完成 |
| `/api/visa/calendar-scan` | 管理员 | 档期截图 OCR，`{ image }` → `{ words }` |
| `/api/visa/vfs-scan` | 管理员 | 粘 VFS 排期 JSON，`{ text }` → `{ vfs: { country_code, city, months, dates, cautionDates } }`；重复日期 2-4 次算拥挤，5 次以上算正常 |

## 汇率与通知

| 接口 | 权限 | 说明 |
| --- | --- | --- |
| `/api/visa/fx` | 公开 | 1 英镑 = 多少人民币，`{ fx: { rate, date, source } | null }` |
| `/api/visa/notify-test` | 管理员 | 按当前配置发一条测试消息到机器人 |

## 备份

| 接口 | 权限 | 说明 |
| --- | --- | --- |
| `/api/visa/export` | 管理员 | 整库导出：订单、客户、收款码、配置、文件（文件在 `files` 里按文件名存 base64） |
| `/api/visa/import` | 管理员 | 整库替换，`{ backup }`；导入即覆盖，没有合并 |

## 调用例子

```bash
# 登录
TOKEN=$(curl -s https://visago.noworrytourism.cn/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"identify":{"email":"admin@gmail.com","password":"..."}}' | jq -r .data.token)

# 列出全部订单
curl -s https://visago.noworrytourism.cn/api/visa/orders \
  -H 'content-type: application/json' \
  -d "{\"auth\":\"$TOKEN\"}"

# 把订单设成待修改
curl -s https://visago.noworrytourism.cn/api/visa/order-revision \
  -H 'content-type: application/json' \
  -d "{\"id\":\"ABCDE1\",\"revision_note\":\"护照首页反光，重新拍一张\",\"auth\":\"$TOKEN\"}"
```
