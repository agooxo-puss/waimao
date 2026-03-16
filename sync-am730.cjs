// sync-am730.js
// 使用 Playwright 從 am730 香港同步新聞 + Bing Image Search
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
      return urls.slice(0, 3);
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
    category: 'business', author: 'am730', date, image: imageUrl
  });
  return fetch(`${SUPABASE_URL}/rest/v1/articles`, 'POST', body);
}

async function main() {
  console.log('=== Starting am730 sync at', new Date().toISOString(), '===');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    console.log('Loading am730 homepage...');
    await page.goto('https://www.am730.com.hk/', { 
      waitUntil: 'domcontentloaded',
      timeout: 120000 
    });
    await page.waitForTimeout(8000);
    
    const articles = await page.evaluate(() => {
      const items = [];
      const allAnchors = document.querySelectorAll('a');
      
      allAnchors.forEach(anchor => {
        const text = anchor.innerText?.trim();
        const href = anchor.href;
        
        if (text && text.length > 15 && href && href.includes('am730.com.hk') && 
            (href.includes('/article/') || href.includes('/column/'))) {
          const img = anchor.querySelector('img')?.src;
          items.push({ title: text, href, image: img });
        }
      });
      
      const seen = new Set();
      const unique = [];
      for (const item of items) {
        if (seen.has(item.title)) continue;
        seen.add(item.title);
        unique.push(item);
      }
      return unique;
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
      
      // Get relevant image from Bing
      console.log('Searching Bing for:', article.title);
      const bingImage = await getBingImage(article.title);
      
      const imageUrl = bingImage;
      await createArticle(article.title, article.title, article.title, imageUrl);
      console.log('Created:', article.title, bingImage ? '(with Bing image)' : '(no image)');
      count++;
    }
    
    console.log(`=== am730 sync complete: ${count} new articles ===`);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
}

main();
