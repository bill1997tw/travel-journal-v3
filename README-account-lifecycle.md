# 帳號永久刪除後端

此版本新增兩個僅供伺服器執行的 Vercel API：

- `POST /api/account-permanent-deletion`
  - 使用目前登入者的 Supabase access token 驗證身分。
  - 只接受屬於該使用者、已進入 `deletion_pending` 的退休紀錄。
  - 保留 24 小時取消期；到期後才執行 Auth Admin 刪除與資料匿名化。
- `GET /api/account-deletion-recovery`
  - 由 Vercel Cron 每日執行。
  - 若 Auth 使用者已刪除，完成匿名化；若 Auth 使用者仍存在，安全退回待處理狀態。
  - 無法確認 Auth 狀態時不修改資料，留待下一次重試。

`account-lifecycle.js` 是給畫面層使用的瀏覽器 adapter。它只呼叫登入者可用的
Supabase RPC，並以目前 session 的 access token 呼叫永久刪除 API。UI 不應自行
複製 RPC 名稱、組合 service-role 請求或儲存 access token。

## 部署前必要條件

先套用 `travel-bill-platform` 專案截至
`202607310001_clone_cloud_trip.sql` 的 Supabase migrations，再於 Vercel
設定下列 server-only 環境變數：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

`SUPABASE_SERVICE_ROLE_KEY` 與 `CRON_SECRET` 不得放入
`supabase-config.js`、瀏覽器程式、Git 或任何公開回應。

目前 UI 尚未開放永久刪除入口；在 migrations、環境變數及端對端驗證完成前，
不可把此流程標示為正式可用。
