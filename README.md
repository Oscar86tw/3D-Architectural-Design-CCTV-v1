# 3D-Architectural-Design-CCTV-v1

昱拓弱電有限公司｜社區地下室 CCTV 3D 規劃。

## 目前版本 V1.23

### V1.23 專案儲存改版
- 右側不再長時間展開完整「專案儲存」內容，改成一個「開啟專案儲存」按鈕。
- 點擊後以浮動視窗開啟專案管理。
- 儲存分為兩種：
  - 本地儲存：目前瀏覽器 localStorage。
  - 雲端儲存：Google Sheets / Apps Script API。
- 本地與雲端都支援：
  - 新增資料夾
  - 刪除資料夾
  - 鎖住 / 解除鎖定資料夾
- 鎖定後禁止刪除該資料夾；專案刪除按鈕也會停用。
- 雲端資料夾資料會存到 Google Sheets 的「CCTV資料夾」工作表，因此跨電腦開啟仍可保留資料夾與鎖定狀態。
- 本地專案支援直接儲存 / 讀取 / 刪除。
- 雲端專案支援直接儲存 / 讀取 / 刪除。
- 匯出 / 匯入 `.utop3d` 保留在本地儲存分頁。
- 啟動流程訊息、錯誤訊息視窗、鏡頭顏色數量統計、兩點實尺校正、鏡頭遮擋、車輛遮擋開關等既有功能保留。

## Google API 更新
V1.23 的 `2.GOOGLE API/Code.gs` 新增雲端資料夾管理 API：
- `listFolders`
- `saveFolder`
- `deleteFolder`
- `setFolderLock`

更新 Code.gs 後必須重新部署 Web App，並執行 `updateWebAppUrl()`，讓最新 `/exec` 網址寫回 `工作表1!B1`。
