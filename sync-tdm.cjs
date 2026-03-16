// sync-tdm.js
// 使用 Playwright 從 TDM 澳廣視同步新聞 + Bing Image Search
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
    title, excerpt: excerpt || title,
    content: `<p>${content}</p>`,
    category: 'macaodaily', author: '澳廣視', date, image: imageUrl
  });
  return fetch(`${SUPABASE_URL}/rest/v1/articles`, 'POST', body);
}

async function main() {
  console.log('=== Starting TDM sync at', new Date().toISOString(), '===');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    console.log('Loading TDM news page...');
    await page.goto('https://www.tdm.com.mo/zh-hant/news-list?type=image&category=27&page=1', { 
      waitUntil: 'networkidle',
      timeout: 60000 
    });
    await page.waitForTimeout(5000);
    
    const articles = await page.evaluate(() => {
      const items = [];
      const allLis = document.querySelectorAll('li');
      
      allLis.forEach(li => {
        const text = li.innerText?.trim();
        if (!text || text.length < 30) return;
        
        if (!text.match(/\d{4}-\d{2}-\d{2}/)) return;
        if (text.includes('首頁') && text.length < 50) return;
        if (text.includes('電台') && text.length < 50) return;
        
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        if (lines.length < 2) return;
        
        let title = '';
        let description = '';
        
        for (const line of lines) {
          if (line.match(/^\d{4}-\d{2}-\d{2}/)) continue;
          if (line.match(/^\d+$/) && line.length < 6) continue;
          if (line.length < 8) continue;
          
          if (!title) {
            title = line;
          } else {
            description = line;
            break;
          }
        }
        
        const img = li.querySelector('img')?.src;
        
        if (title && title.length >= 10) {
          items.push({ title, description: description || title, image: img });
        }
      });
      
      return items;
    });
    
    console.log(`Found ${articles.length} articles`);
    
    let count = 0;
    for (const article of articles) {
      if (count >= 15) break;
      
      const exists = await articleExists(article.title);
      if (exists) {
        console.log('Skipping existing:', article.title);
        continue;
      }
      
      console.log('Searching Bing for:', article.title);
      const bingImage = await getBingImage(article.title);
      
      await createArticle(article.title, article.description, article.description || article.title, bingImage);
      console.log('Created:', article.title, bingImage ? '(with Bing image)' : '(no image)');
      count++;
    }
    
    console.log(`=== TDM sync complete: ${count} new articles ===`);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
}

main();
