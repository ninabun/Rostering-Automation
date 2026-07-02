# AI Rostering Automation Demo

本機版多部門 rostering automation demo。可用瀏覽器開啟 `http://127.0.0.1:8765` 預覽。

預設由 01/07/2026 開始，一次產生 4 星期 roster。Demo 重點是展示同一個 automation engine 可以套用到不同 department。

## 已包括

- 多 department selector
- 每個 department 有獨立 staff list、request duty、criteria 和 generated roster
- 可新增 department
- 可新增 / 移除 staff
- 可編輯 staff：rank、appointment date、name、Chinese name、category
- 可輸入 department criteria
- 可加入 staff request
- 可加入 fixed assignment：training、clinic、borrowed-out、study day 等鎖定 duty
- Request log：集中查看所有 request / fixed assignment
- Roster cell 以 R / F 標示 request / fixed assignment
- Version history：每次 Generate 都會保存一個 roster version
- 切換 start date 時，如果該日期曾經 generate 過 roster，會載入最新版本
- 接近紙本 roster 的 header、department、print date、prepared by
- Rank、Appt. Date、Name、C. Name、Catg. 欄位
- 4 星期 generated roster
- Owing as of：SH、PH、O、WO
- Request duty：A、A1、D1、D2、D3、D4、D、HD1、HD4、P、N、CN、O、WO、AL、NDD、CCLV
- 每日 A core / P core / N core / Student extra 統計
- Pitch view：展示 demo flow 和商業價值
- Export CSV
- Print layout

## 現時採用規則

- A shift 核心人手可由 department criteria 設定
- P shift 核心人手可由 department criteria 設定
- N shift 核心人手可由 department criteria 設定
- 核心人手只包括 APN、RNM、RN、LocumRN 等非學生臨床同事
- Student 是 extra，不計入 A/P/N 核心人手
- Student 每個 A / P shift 最多幾多人可由 criteria 設定
- 每更是否硬性要求 APN 暫時不設為預設規則，可之後加成 criteria
- Manager 星期一至五 D1，星期六日 WO
- N / CN 前一日盡量安排 A，後翌日安排 O
- 每人每週最多 5 個工作 duty
- A / P / N 次數盡量平均
- O 盡量排埋一齊，避免 O-A-O 斷開

## Shift 時間

- A: 07:00-15:48
- A1: 07:00-14:36
- D1: 08:00-16:48
- D2: 08:00-17:30
- D3: 08:30-17:18
- D4: 09:00-17:48
- D: 08:45-17:33
- HD1: 08:30-12:30
- HD4: 08:00-14:00
- P: 13:00-21:48
- N / CN: 21:15-07:15

GitHub Pages enabled.
