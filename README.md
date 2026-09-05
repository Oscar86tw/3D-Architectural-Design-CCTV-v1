# 3D-Architectural-Design-CCTV-v1

昱拓弱電有限公司｜社區地下室 CCTV 3D 規劃。

## 目前版本 V1.37

### V1.37 專案儲存改版
- 右側不再長時間展開完整「專案儲存」內容，改成一個「開啟專案儲存」按鈕。
- 點擊後以浮動視窗開啟專案管理。
- 儲存分為兩種：
  - 本地儲存：目前瀏覽器 localStorage。
  - 雲端儲存：Google Sheets / Apps Script API。
- 本地與雲端都支援：
  - 新增資料夾
  - 刪除資料夾
- 每一個已儲存專案檔可個別「鎖定 / 解鎖」；鎖定後該專案不能刪除，避免誤刪。
- 雲端資料夾資料會存到 Google Sheets 的「CCTV資料夾」工作表；專案鎖定狀態則存到「CCTV專案資料」的「鎖定」欄位。
- 本地專案支援直接儲存 / 讀取 / 刪除。
- 雲端專案支援直接儲存 / 讀取 / 刪除。
- 匯出 / 匯入 `.utop3d` 保留在本地儲存分頁。
- 啟動流程訊息、錯誤訊息視窗、鏡頭顏色數量統計、兩點實尺校正、鏡頭遮擋、車輛遮擋開關等既有功能保留。

## Google API 更新
V1.37 的 `2.GOOGLE API/Code.gs` 支援雲端資料夾管理，並新增專案檔鎖定 API：
- `listFolders`
- `saveFolder`
- `deleteFolder`
- `setProjectLock`

更新 Code.gs 後必須重新部署 Web App，並執行 `updateWebAppUrl()`，讓最新 `/exec` 網址寫回 `工作表1!B1`。

### V1.37 修正
- **錯誤視窗改為獨立最高層視窗**：啟動流程仍在背景更新，但任何錯誤會立即覆蓋到最上層，不會再被載入流程擋住。
- 錯誤視窗必須按「確定」或右上角 X 才會關閉，避免錯誤資訊一閃而過。
- 保留「複製錯誤資訊」，方便直接貼回 AI 檢查。

### V1.37 修正
- 修正網站啟動 `resize is not defined` 錯誤。
- 恢復 Three.js 視窗 resize 與動畫迴圈。
- 本地 / 雲端已儲存紀錄的按鈕由「讀取」改成更直觀的「開啟」。
- 開啟雲端專案成功後會自動關閉專案儲存浮動視窗。

### V1.37 修正
- Apps Script `ping` 回傳 `apiVersion` 與 capabilities，方便確認目前 /exec 到底跑哪一版。
- 若舊 Web App 尚未支援 `listFolders`，前端不再整體報錯停止。
- 舊 API 模式仍可讀取雲端專案，暫時使用「我的專案」作為預設資料夾。
- 更新 Apps Script 後，雲端資料夾新增 / 刪除功能自動恢復。

### V1.37
- 專案儲存介面簡化為：專案名稱 → 要存去哪裡 → 新增資料夾 → 儲存。
- 移除前台「刪除資料夾」操作。
- 雲端「儲存到雲端」按鈕改為「儲存」。
- 系統啟動與資料載入不再跳大型浮動視窗，改為右上角小型狀態卡片。
- 啟動完成後小卡約 3.5 秒自動收起；若有錯誤則保留提示，真正錯誤仍使用最高優先錯誤視窗。

### V1.37
- 系統啟動與資料載入全部完成後，右上角提示卡約 0.9 秒自動收起，不持續占用操作畫面。
- 修復本地儲存「匯出專案檔」：可將目前 3D 專案下載為 `.utop3d`。
- 修復本地儲存「匯入專案檔」：選擇 `.utop3d` / `.json` 後可還原鏡頭、模組、比例、社區與樓層資料。
- 匯入失敗會使用既有最高優先錯誤視窗顯示原因。

### V1.37
- 雲端專案不再只是記錄在 Google Sheets；完整 `.utop3d` 專案檔會實際儲存到指定 Google Drive 根資料夾。
- 自訂雲端資料夾會對應為 Google Drive 根資料夾下的子資料夾。
- Google Sheets 改為專案索引與備援資料庫，新增 `Drive檔案ID` 欄位。
- 開啟雲端專案時優先從 Google Drive 讀取；Drive 異常時才使用 Sheets 備援 JSON。
- 刪除專案會將對應 Drive 檔案移至垃圾桶；鎖定專案仍禁止刪除。

### V1.37
- 雲端資料夾改以 Google Drive 實際子資料夾為準。
- 點「新增資料夾」立即在指定 Google Drive 根目錄建立子資料夾。
- 雲端儲存成功必須取得 `driveFileId`，否則視為失敗並跳錯誤。
- 雲端專案清單會驗證 Drive 檔案是否存在，顯示 `Drive 已建立 / Drive 未建立`。
- 有 Drive 檔案時提供 `Drive` 按鈕，可直接開啟該檔案確認。

### V1.37
- 修正 Apps Script `ScriptApp.getService().getUrl()` 可能回傳 `/dev`，導致 B1 寫入測試網址。
- `updateWebAppUrl()` 現在會強制將 `/dev` 正規化為 `/exec`。
- `getWebAppUrl()` 會自動修復工作表1!B1 既有 `/dev` 值。
- GitHub 前端若讀到 `/dev`，會顯示明確錯誤，不再誤用測試端點。

### V1.37
- 修正 GitHub Pages 呼叫 Apps Script `/exec` 出現 `Failed to fetch`。
- 不再使用跨網域 `fetch()` 直接呼叫 Apps Script。
- 新增隱藏 Apps Script HtmlService Bridge iframe。
- GitHub Pages → `postMessage` → Bridge → `google.script.run` → Google Drive / Sheets。
- 避免 Apps Script redirect / CORS 導致雲端功能無法使用。

### V1.37
- Google Drive 雲端儲存根目錄改由 Google Sheets `工作表1!B3` 管理。
- `B1` 保留 Apps Script `/exec`；`B3` 專門放 Google Drive 資料夾網址。
- Apps Script 每次自動解析 B3 的 Folder ID，不再把 Drive Folder ID 寫死在 `Code.gs`。
- 日後更換 Google Drive 儲存位置只需修改 B3。

### V1.37
- 強化 Apps Script Bridge 逾時錯誤說明。
- 明確檢查並拒絕 Apps Script `library` / 資料庫型網址。
- 雲端功能必須使用「網頁應用程式」部署，B1 必須為 `/exec`。
