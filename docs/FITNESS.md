# 健身 / 增肌追蹤

入口為底部導覽「健身」，路由 `/fitness`，分成總覽、訓練、體重、進步。沿用 TanStack Start file-based routing、AppShell、既有色彩與字型、Radix AlertDialog、Recharts、Zod 與 date-fns，沒有新增套件或 backend。

## 新增與修改的檔案

| 檔案                                        | 用途                                                       |
| ------------------------------------------- | ---------------------------------------------------------- |
| `src/routes/fitness.tsx`                    | 健身入口、四個分頁、總覽與目標設定                         |
| `src/components/fitness/WeightPanel.tsx`    | 體重新增、編輯、刪除、歷史、趨勢與期間切換                 |
| `src/components/fitness/WorkoutPanel.tsx`   | 訓練模板入口、草稿、休息日、歷史與歷史編輯                 |
| `src/components/fitness/SessionEditor.tsx`  | 每組輸入、完成動作、上次參考、結束訓練                     |
| `src/components/fitness/TemplateEditor.tsx` | 編輯模板名稱、動作、組數、次數、新增與移除動作             |
| `src/components/fitness/ProgressPanel.tsx`  | 增重進度、動作歷史與訓練量圖表                             |
| `src/components/fitness/shared.tsx`         | 共用卡片、欄位樣式、統計與確認視窗                         |
| `src/lib/fitness/model.ts`                  | 六種核心型別、預設模板、日期、統計、上次紀錄與訓練量純函式 |
| `src/lib/fitness/storage.ts`                | 版本化 localStorage repository 與 Zod 驗證                 |
| `src/hooks/use-fitness.ts`                  | 載入、即時保存、錯誤回報、跨分頁 storage event 更新        |
| `src/components/AppShell.tsx`               | 新增健身入口、可選的寬版容器、44px 導覽點擊區              |
| `src/routeTree.gen.ts`                      | 由既有 Vite/TanStack plugin 自動產生的路由                 |
| `package.json`                              | 新增 `typecheck`、`test` scripts；依賴與版本不變           |
| `tests/fitness.test.mjs`                    | 11 項資料邏輯與儲存測試                                    |
| `docs/FITNESS.md`                           | 功能、資料與驗證說明                                       |

## 資料模型與儲存

- `WeightEntry`：id、當地日期 YYYY-MM-DD、weight kg、note。每日一筆，重複日期會提示編輯現有紀錄。
- `WorkoutTemplate`：id、名稱、ExerciseTemplate 清單。
- `ExerciseTemplate`：穩定 id、名称、sets、minReps、maxReps。
- `WorkoutSession`：id、templateId、名稱快照、日期、開始/完成時間、ExerciseSession 清單。
- `ExerciseSession`：exerciseId、名稱與目標次數快照、原定組數、SetRecord 清單。
- `SetRecord`：id、weight、reps、completed；尚未輸入使用 null，徒手重量允許 0。
- `FitnessData`：version 1、goal、weights、templates、sessions、draft、restDays。

使用 `localStorage["burnlog.fitness.v1"]`，將模板、完成紀錄與進行中的草稿放在同一版本化 payload。完成訓練時以同一次寫入新增歷史並清除草稿；儲存失敗會回報，畫面不會假裝已成功儲存。遇到損毀或未知版本資料，暫停寫入並保留原始內容。

目前專案為混合 prototype：飲食、個人資料、目標使用 `burnlog.*` localStorage；體態相片頁另外呼叫 Supabase，沒有共用登入頁或共用資料 repository。這版沿用可獨立使用的本機資料流程，不更動既有相片或飲食紀錄，也不把相片頁附帶的體重自動匯入健身資料。

此版本是每個瀏覽器 origin 的裝置資料，沒有帳號隔離與雲端同步。不同裝置/網域不共用資料，清除瀏覽器網站資料會移除紀錄。健身目標獨立使用需求指定的 168 cm、起始 56 kg、目標 60 kg、增肌；不覆寫既有營養個人資料。

## 體重計算

- 總覽「最近 7 天」：含今天，今天往前 6 天至今天。
- 「前 7 天」：今天往前 13 天至往前 7 天。两个區間皆以本地日期計算，互不重疊。
- 平均為區間內有效量測總和除以有效筆數。3–4 筆也直接計算，不補 0、不插值。
- Weekly change = 最近 7 天平均 − 前 7 天平均。任何一側沒有資料，差值與狀態顯示資料不足。
- `GAIN_RATE` 集中定義：期望 +0.15–0.25 kg/week；低於 +0.10 為 below，+0.10–0.30（含邊界）為 within，大於 +0.30 為 above。差值保留 4 位小數後判定，避免浮點誤差將 +0.10/+0.30 誤分類。
- 圖表週平均依週一到週日分組，與總覽滾動區間明確區別。本週可能未完整；空白週不連線，只有一筆則只有量測點，不預測未來。
- 支援 4 週、3 個月、全部，使用真實日期時間軸。X 軸日期、Y 軸 kg。週平均表格列出每週筆數，可補充圖表閱讀。

## 訓練、上次紀錄與進步

LEG DAY、CHEST DAY、BACK DAY 依需求提供全部動作與組數/次數。模板可編輯，建立訓練時複製成快照，日後修改模板不改寫歷史。

`previousExercise` 以 exerciseId 在已完成 session 裡查找；先依訓練日期、再依開始時間排序，排除目前這次及日期/開始時間在其後的紀錄。跨模板也能參考相同 exerciseId，重新命名不丟失歷史。不同動作應新增，而不是把舊動作改名冒用識別碼。

上次表現只列有效且勾選完成的組。「帶入上次紀錄至空白組」只填 weight、reps 皆為 null 且未完成的整組，不覆蓋部分輸入、不自動勾選完成。動作頁與歷史訓練皆能查看每組重量、次數；歷史可編輯，儲存後所有統計重新計算。

Volume = sum(weight × reps)，只計有效完成組。0 kg 徒手動作不含使用者體重；未填與未完成組不计入。至少一次有效完成組才能結束訓練，可提早結束並保留其他組為未完成。訓練時長為開始至完成的牆鐘時間，包含重新整理與暫停時間。

Rest Day 只儲存日期，不建立假訓練。完成訓練時會移除同日休息標記；已有完成訓練的日期不能再標為休息。

## UX 與驗證

數字輸入為 48px 高，重量使用 decimal inputMode、次數使用 numeric；完成按鈕 48×48px。小螢幕四欄組數保持可用，健身頁 desktop 容器最多 760px，既有頁面維持原 430px 寬度。刪除、放棄與 Finish Workout 以既有 Radix dialog 確認；每组輸入不跳視窗。分頁支援方向鍵、Home、End。

已在本機瀏覽器檢查 320px、390px、1440px 視窗，確認沒有水平溢出。實際操作驗證體重新增/修改、重複日期阻擋、模板保存、休息標記、開始訓練、重新整理恢復、上次帶入、不覆蓋部分輸入、額外組增刪、完成、歷史修改與進步統計。原今日/歷史/個人/設定頁路由仍正常載入；沒有呼叫需 API Key 的 AI 分析，也沒有提交體態照片到雲端。

開發測試使用 Node 24.19。`test` 直接讀取 TypeScript，需支援內建 type stripping 的 Node 22.18+ / 24+。

```sh
npm run build
npm run typecheck
npm test
npm run lint
```

- 11 項測試通過（稀疏平均、空資料、精確界線、閏年/跨年、模板快照、上次紀錄排序、保護部分輸入、volume、草稿 round-trip、損毀與儲存失敗）。
- 型別檢查及新增/修改的手寫 TypeScript、測試檔 lint 通過。
- Production build 成功；保留既有工具鏈警告，Recharts 所在的健身 chunk 超過 500 kB，後續可再細分載入。
- 全專案 lint 有 188 errors、6 warnings；與修改前獨立 baseline 逐一比對相同，來自既有檔案。未為清除此類問題重構原功能。
- 未提供原有 test script，因此新增 Node 內建測試，不增加測試套件依賴。

## 第二階段候選（尚未實作）

1. 整合既有 Supabase 登入與 RLS，提供帳號隔離、離線同步與衝突處理。
2. 資料匯出/匯入與備份；視需求銜接體態照片的體重資料。
3. 選用休息計時器、模板排序與跨模板共用動作選擇器。
4. 依實際資料量調整圖表分段載入與長期歷史效能。

未新增飲食/熱量追蹤、AI 訓練建議、體脂估算、1RM、社群或成就功能。
