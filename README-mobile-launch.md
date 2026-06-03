# 旅遊小本本上線說明

這個版本已經補上 4 個正式上線需要的核心能力：

1. `Vercel` 靜態部署設定
2. `Supabase Auth` Email magic link 登入
3. `Supabase Database` 雲端同步
4. `PWA` 安裝能力與離線快取

## 你現在要做的事

### 1. 建立 Supabase 專案

1. 到 Supabase 建一個新 project
2. 打開 SQL Editor
3. 將 [supabase/setup.sql](./supabase/setup.sql) 全部貼上執行

### 2. 開啟登入方式

在 Supabase 後台：

1. 進入 `Authentication`
2. 啟用 `Email` provider
3. 將 `Site URL` 設成你正式站網址
4. 在 `Redirect URLs` 加入：
   - `http://localhost:4173`
   - 你的正式網址，例如 `https://travel-journal.vercel.app`

### 3. 填入前端設定

編輯 [supabase-config.js](./supabase-config.js)：

```js
window.VOYAGE_SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT.supabase.co",
  publishableKey: "YOUR_SUPABASE_PUBLISHABLE_KEY",
  providers: ["email"],
  appStateTable: "app_states",
  storageBucket: "travel-assets",
  siteName: "旅遊小本本"
};
```

這裡放的是 `publishable key`，不是 `service role key`。

### 4. 本機先測

在此資料夾啟一個靜態伺服器，例如：

```powershell
cd C:\Users\User\ticket_memory\travel-journal-v3
py -m http.server 4173
```

然後打開：

`http://localhost:4173`

### 5. 部署到 Vercel

最簡單做法：

1. 把這個資料夾放進 GitHub
2. 用 Vercel 匯入該 repo
3. Root directory 指到 `travel-journal-v3`
4. 直接 deploy

這個專案是純靜態站，不需要 Node server。

## 使用方式

1. 開站後右上角會出現 `登入同步`
2. 輸入 Email
3. 收到 magic link 後登入
4. 後續你在手機或電腦的修改都會同步到同一份旅遊本

## 目前這版的資料同步範圍

已同步：

- 旅程資料
- 快速速記
- 使用者名稱
- Logo 名稱
- 深淺色主題

## 這版的限制

1. 目前是單人使用者模型，不是多人共編
2. 目前旅程資料仍以整包 JSON 同步，優點是上線快，缺點是未來做多人共編比較不方便
3. 現有票券或圖片資料如果很大，之後最好再改成真正上傳到 Supabase Storage

## 建議的下一步

如果你要把它變成真正長期使用的產品，下一階段建議做：

1. `trip slug` 與分享頁
2. 圖片正式上傳 Storage
3. Google 登入
4. 旅程列表搜尋與排序
5. 備份匯出 JSON
