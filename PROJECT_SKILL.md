# Kimaki/Waimao 新聞網站項目文檔

## 項目概覽

**網站名稱**: 歪貓娛樂 / Kimaki  
**網址**: https://kimaki.vercel.app  
**備用網址**: https://waimao-ebon.vercel.app  
**技術棧**: React + Vite + Supabase + Vercel  
**GitHub**: https://github.com/agooxo-puss/waimao (私有)

## 目錄結構

```
waimao/
├── src/
│   ├── App.jsx          # 主要React組件（首頁、文章頁、管理後台）
│   └── App.css          # 樣式文件
├── sync-*.cjs           # 新聞同步腳本
├── sync-wrapper.sh       # 定時任務執行器
└── vercel.json          # Vercel路由配置
```

## 數據庫

**Supabase 項目**: sjokgfqpyuzrhuvrnvcz  
**表名**: articles

### 欄位結構
| 欄位 | 類型 | 說明 |
|------|------|------|
| id | integer | 主鍵 |
| title | text | 文章標題 |
| excerpt | text | 文章摘要 |
| content | text | 完整內容 (HTML格式) |
| category | text | 分類 (world/tech/sports/culture/business/macaodaily) |
| author | text | 來源 (BBC中文/am730/澳門日報/澳廣視/Cool3c) |
| date | text | 發布日期 |
| image | text | 圖片URL |
| created_at | timestamp | 創建時間 |

## 新聞來源

| 來源 | 分類 | 同步腳本 | RSS/網站 |
|------|------|----------|----------|
| BBC中文 | 國際 (world) | sync-bbc.cjs | https://www.bbc.com/zhongwen |
| am730 | 香港 (business) | sync-am730.cjs | https://www.am730.com.hk |
| 澳廣視/TDM | 澳門 (macaodaily) | sync-tdm.cjs | https://www.tdm.com.mo |
| 澳門日報 | 澳門 (macaodaily) | sync-playwright.cjs | https://appimg.modaily.cn |
| Cool3c | 科技 (tech) | sync-cool3c.cjs | https://www.cool3c.com/rss |

## 管理後台

**登入**: 
- 用戶名: waimao
- 密碼: waimao123

**功能**:
- 發布新文章（支援HTML內容）
- 編輯現有文章
- 刪除文章

## 同步腳本使用

```bash
# 進入項目目錄
cd /Users/whypuss/.kimaki/projects/kimaki/waimao

# 單獨執行某個來源同步
node sync-bbc.cjs      # BBC中文
node sync-am730.cjs    # am730
node sync-tdm.cjs      # TDM
node sync-cool3c.cjs   # Cool3c
node sync-playwright.cjs  # 澳門日報

# 執行所有同步
./sync-wrapper.sh
```

## 圖片搜尋邏輯

所有 sync 腳本使用 Bing Image Search 獲取相關圖片：
1. 嘗試完整標題
2. 嘗試標題前30字
3. 嘗試標題第一句
4. 嘗試「作者 + 標題前15字」

**重要**: 找不到圖片時設為 `null`，不使用 fallback 圖片。

## 內容清理邏輯

每個 sync 腳本都有 `cleanContent` 或類似函數，會過濾：
- 廣告內容 (ADVERTISEMENT, APP推廣等)
- 網站導航元素
- 版權資訊
- 相關文章列表
- 視頻播放器控制項

## 部署流程

```bash
# 1. 修改代碼後提交
git add -A
git commit -m "描述"
git push

# 2. Vercel 自動部署 (main分支)
# 或手動部署:
npx vercel --prod
```

## 常見任務

### 1. 修復缺失圖片的文章
```bash
# 方法一：使用同步腳本重新抓取
node sync-bbc.cjs

# 方法二：手動修復
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://sjokgfqpyuzrhuvrnvcz.supabase.co', 'sb_publishable_0shlrzPR6MoWE5td6BO3Pg_onhIIWK_');

// 找出沒有圖片的文章
supabase.from('articles').select('id,title').is('image', null)
  .then(({ data }) => console.log(data));
"
```

### 2. 刪除問題文章
```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://sjokgfqpyuzrhuvrnvcz.supabase.co', 'sb_publishable_0shlrzPR6MoWE5td6BO3Pg_onhIIWK_');

// 刪除ID為123的文章
supabase.from('articles').delete().eq('id', 123);
"
```

### 3. 添加新的新聞來源
1. 創建新的 sync-xxx.cjs 腳本
2. 参考現有腳本的結構
3. 確保有圖片搜尋和內容清理邏輯
4. 更新 sync-wrapper.sh 添加新腳本
5. 提交並部署

## 前端路由

- `/` - 首頁 (全部)
- `/category/:category` - 分類頁
- `/article/:id` - 文章詳情

## 已知問題

1. 澳門日報內容不完整 - 網站是SPA，只能抓取標題
2. 部分標題太特殊 Bing 搜不到圖片

## 維護提示

- 同步腳本使用 Playwright 處理動態內容
- RSS 來源更穩定 (如 Cool3c)
- 定期檢查文章數量和質量
- 監控 Vercel 部署日誌
