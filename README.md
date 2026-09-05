# 3D-Architectural-Design-CCTV-v1

昱拓弱電有限公司｜社區地下室 CCTV 3D 規劃。

## 目前版本 V1.18

### V1.18 雲端整合
- Google Sheets：`1-jy-MWBXMyx92xZ-RTnwqpB-j7cMnlOIB2i1lh2eUZg`
- API 有效端點來源固定為：`工作表1!B1`
- 前端不永久寫死 Apps Script `/exec` 網址。
- 網頁啟動時會從 Google Sheets 的 `工作表1!B1` 讀取目前有效端點。
- 「儲存到雲端」會把完整 CCTV 3D 專案 JSON 寫入 `CCTV專案資料`。
- 「讀取」會直接從 Google Sheets 還原專案。
- 「刪除」會直接刪除 Google Sheets 專案列。
- 雲端資料欄位：專案ID / 社區 / 樓層 / 專案名稱 / 資料夾 / 版本 / 更新時間 / 專案JSON。
- 瀏覽器仍保留本機備份，雲端為主要專案清單。

### 既有功能
- 樺龍潮+ 社區 B1 / B2
- 社區資料夾與樓層圖面
- 兩點實尺校正
- 鏡頭光影視域與遮擋缺角
- 連續牆體 / 柱子
- 寫實汽車 / 機車，車輛遮擋開關
- 黃色增設鏡頭＋7m 閃爍星星提示

## 部署
`1.GITHUB` 內容放 GitHub Pages。
`2.GOOGLE API/Code.gs` 貼進 Google Apps Script，重新部署後執行 `updateWebAppUrl()`，確認 `工作表1!B1` 是新的 `/exec`。
