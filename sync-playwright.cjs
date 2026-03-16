// sync-playwright.js
// 使用 Playwright 從澳門日報同步新聞
const { chromium } = require('playwright');

const SUPABASE_URL = 'https://sjokgfqpyuzrhuvrnvcz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_0shlrzPR6MoWE5td6BO3Pg_onhIIWK_';
const DEFAULT_IMAGE = 'https://cdn.discordapp.com/attachments/1482661602204582019/1482981824048402462/MobileMacau_Tourist_Info_Hero_Banner.jpg?ex=69b8edf3&is=69b79c73&hm=e222a8a366f5b8a4632cb2a7f85c85455990fae57203da73eeb249474896f57d&';

const https = require('https');

function fetch(url, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = new URL(url);
    const req = https.request({
      hostname: options.hostname,
      path: options.pathname + options.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function checkImage(url) {
  return new Promise((resolve) => {
    if (!url) { resolve(false); return; }
    https.get(url, (res) => { resolve(res.statusCode === 200); })
      .on('error', () => resolve(false));
  });
}

async function articleExists(title) {
  const data = await fetch(`${SUPABASE_URL}/rest/v1/articles?select=id&title=eq.${encodeURIComponent(title)}`);
  try { return JSON.parse(data).length > 0; } catch { return false; }
}

async function createArticle(title, excerpt, content, imageUrl) {
  const date = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
  const body = JSON.stringify({
    title, excerpt: excerpt || title,
    content: `<p>${content}</p>`,
    category: 'macaodaily', author: '澳門日報', date, image: imageUrl
  });
  return fetch(`${SUPABASE_URL}/rest/v1/articles`, 'POST', body);
}

async function main() {
  console.log('=== Starting sync at', new Date().toISOString(), '===');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // 訪問首頁
    console.log('Loading homepage...');
    await page.goto('https://appimg.modaily.cn/amucsite/web/index.html#/home', { 
      waitUntil: 'networkidle',
      timeout: 60000 
    });
    await page.waitForTimeout(3000);
    
    // 獲取頁面文本
    const bodyText = await page.evaluate(() => document.body.innerText);
    const lines = bodyText.split('\n');
    
    // 解析新聞標題
    const skipCategories = ['即時', '澳門記憶', '澳日快趣', '產業多元', '社會迴響', '澳門旅遊+', 
      '感受橫琴', '味力澳門', '心耕都更', '專題', '視頻', '藝文', '要聞',
      '小城故事', '粵澳對話', '灣區視野', 'VR', '美圖', '科技', '直播',
      '更多', '排行榜', '加載更多'];
    const skipTimes = ['剛剛', '1小時前', '2小時前', '3小時前', '分鐘前'];
    
    const titles = [];
    for (const line of lines) {
      const trimmed = line.trim();
      // 是時間標記，則下一行是標題
      if (skipTimes.includes(trimmed)) continue;
      // 是分類則跳過
      if (skipCategories.includes(trimmed)) continue;
      // 太短跳過
      if (trimmed.length < 8) continue;
      // 包含數字可能是日期
      if (/^\d+-\d+/.test(trimmed)) continue;
      // 不是標題
      if (!/[^\u0000-\u007F]/.test(trimmed)) continue; // 需要中文
      
      titles.push(trimmed);
    }
    
    // 去重
    const uniqueTitles = [...new Set(titles)].slice(0, 5);
    console.log(`Found ${uniqueTitles.length} news titles`);
    
    let added = 0;
    for (const title of uniqueTitles) {
      if (added >= 2) break;
      
      if (await articleExists(title)) {
        console.log(`Skipping: ${title.substring(0, 30)}...`);
        continue;
      }
      
      // 嘗試獲取詳情 - 通過點擊導航
      // 由於動態加載，我們直接用默認圖片
      console.log(`Adding: ${title.substring(0, 30)}...`);
      
      await createArticle(title, title, title, DEFAULT_IMAGE);
      added++;
      
      await new Promise(r => setTimeout(r, 1000));
    }
    
    console.log(`=== Sync complete: ${added} new articles ===`);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
}

main();
