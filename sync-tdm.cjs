// sync-tdm.js
// 使用 Playwright 從 TDM 澳廣視同步新聞 + 完整內容
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
      const selectors = ['.article-content', '.article-body', '.content', '[class*="content"]', 'article', '.post-content', '.entry-content'];
      
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
        
        for (const line of lines) {
          if (line.match(/^\d{4}-\d{2}-\d{2}/)) continue;
          if (line.match(/^\d+$/) && line.length < 6) continue;
          if (line.length < 8) continue;
          
          if (!title) {
            title = line;
            break;
          }
        }
        
        // Try to get link
        const link = li.querySelector('a')?.href;
        
        if (title && title.length >= 10 && link) {
          items.push({ title, url: link });
        }
      });
      
      return items;
    });
    
    console.log(`Found ${articles.length} articles`);
    
    let count = 0;
    for (const article of articles) {
      if (count >= 5) break;
      
      const exists = await articleExists(article.title);
      if (exists) {
        console.log('Skipping existing:', article.title);
        continue;
      }
      
      console.log('Getting content for:', article.title);
      const content = await getArticleContent(page, article.url);
      
      const bingImage = await getBingImage(article.title);
      
      await createArticle(article.title, article.title, content || article.title, bingImage);
      console.log('Created:', article.title, '| Content length:', content?.length || 0);
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
