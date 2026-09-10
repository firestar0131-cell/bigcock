# Nutri Snap

「請幫我建立一個專為手機瀏覽設計的 AI 飲食與熱量紀錄網站（類似 Calog App），使用繁體中文。

核心功能需求：

飲食輸入區：

支援『拍照/上傳食物照片』與『文字輸入（如：雞胸肉100g配生菜沙拉）』。

送出時，呼叫 Google Gemini API（gemini-2.5-flash）進行影像或文字分析。

讓我在設定頁面輸入並儲存我的 Gemini API Key。

AI 分析結果卡片：

每次辨識需拆解食材清單，標註每項食材的估算熱量（kcal）、蛋白質（g）、脂肪（g）、碳水化合物（g）。

給出當餐的總熱量、PFC 圓餅圖，以及一段 50 字以內的『AI 營養教練簡評』。

點擊『確認記錄』按鈕後存入歷史清單。

今日儀表板（首頁）：

頂部顯示今日總熱量進度條（預設每日目標 2000 kcal，可在設定中修改）。

顯示今日累積的蛋白質、脂肪、碳水化合物克數。

下方列出今日已記錄的餐點清單，支援刪除與展開細節。

UI 風格：

極簡、現代、乾淨的健身 App 風格，適合手機全螢幕瀏覽。」

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a759a2f9-5323-41e5-8cac-2343938de17e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
