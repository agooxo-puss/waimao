// sync-playwright.cjs
// 使用 Playwright 從澳門日報同步新聞 + 完整內容
const { chromium } = require('playwright');

const SUPABASE_URL = 'https://sjokgfqpyuzrhuvrnvcz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_0shlrzPR6MoWE5td6BO3Pg_onhIIWK_';

const https = require('https');

const IMAGE_CACHE = {};

async function getBingImage(keyword) {
  if (IMAGE_CACHE[keyword]) return IMAGE_CACHE[keyword];
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    const query = encodeURIComponent(keyword);
    await page.goto(`https://www.bing.com/images/search?q=${query}`, { 
      waitUntil: 'domcontentloaded', 
      timeout: 15000 
    });
    await page.waitForTimeout(2000);
    
    const images = await page.evaluate(() => {
      const imgs = document.querySelectorAll('.mimg');
      const urls = [];
      imgs.forEach(img => {
        if (img.src && img.src.startsWith('http') && img.src.includes('bing.net')) {
          urls.push(img.src);
        }
      });
      return urls.slice(0, 1);
    });
    
    const result = images[0] || null;
    IMAGE_CACHE[keyword] = result;
    return result;
  } catch (e) {
    return null;
  } finally {
    await browser.close();
  }
}

async function getArticleContent(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    const content = await page.evaluate(() => {
      const selectors = ['article', '.article-content', '.article-body', '.content', '[class*="content"]', '.post-content', '.entry-content', '.news-content'];
      
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.innerText.length > 100) {
          return el.innerText;
        }
      }
      
      const paras = Array.from(document.querySelectorAll('p'))
        .map(p => p.innerText)
        .filter(t => t.length > 20)
        .join('\n\n');
      
      return paras || document.body.innerText.substring(0, 2000);
    });
    
    return content;
  } catch (e) {
    return null;
  }
}

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

async function articleExists(title) {
  const data = await fetch(`${SUPABASE_URL}/rest/v1/articles?select=id&title=eq.${encodeURIComponent(title)}`);
  try { return JSON.parse(data).length > 0; } catch { return false; }
}

async function createArticle(title, excerpt, content, imageUrl) {
  const date = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
  const body = JSON.stringify({
    title, excerpt: excerpt || title.substring(0, 100),
    content: content ? `<p>${content.replace(/\n/g, '</p><p>')}</p>` : `<p>${title}</p>`,
    category: 'macaodaily', author: '澳門日報', date, image: imageUrl
  });
  return fetch(`${SUPABASE_URL}/rest/v1/articles`, 'POST', body);
}

async function main() {
  console.log('=== Starting Macau Daily sync at', new Date().toISOString(), '===');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    console.log('Loading homepage...');
    await page.goto('https://appimg.modaily.cn/amucsite/web/index.html#/home', { 
      waitUntil: 'networkidle',
      timeout: 60000 
    });
    await page.waitForTimeout(5000);
    
    const bodyText = await page.evaluate(() => document.body.innerText);
    const lines = bodyText.split('\n');
    
    const skipCategories = ['即時', '澳門記憶', '澳日快趣', '產業多元', '社會迴響', '澳門旅遊+', 
      '感受橫琴', '味力澳門', '心耕都更', '專題', '視頻', '藝文', '要聞',
      '小城故事', '粵澳對話', '灣區視野', 'VR', '美圖', '科技', '直播',
      '更多', '排行榜', '加載更多', '首頁', '新聞', '電台'];
    
    const titles = [];
    for (const line of lines) {
      if (line.length < 10) continue;
      if (skipCategories.some(cat => line.includes(cat))) continue;
      if (line.match(/^\d+$/)) continue;
      if (line.match(/\d{4}-\d{2}-\d{2}/)) continue;
      if (line.match(/^[A-Za-z]/)) continue;
      
      const cleaned = line.trim();
      if (cleaned.length >= 10 && cleaned.length <= 60) {
        titles.push(cleaned);
      }
    }
    
    const uniqueTitles = [...new Set(titles)].slice(0, 20);
    
    console.log(`Found ${uniqueTitles.length} titles`);
    
    let added = 0;
    for (const title of uniqueTitles) {
      if (added >= 5) break;
      
      const exists = await articleExists(title);
      if (exists) {
        console.log('Skipping existing:', title);
        continue;
      }
      
      console.log('Searching Bing for:', title);
      const bingImage = await getBingImage(title);
      
      await createArticle(title, title, title, bingImage);
      console.log('Created:', title, bingImage ? '(with image)' : '(no image)');
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
