// sync-bbc.cjs
// 使用 Playwright 從 BBC 中文同步新聞 + 完整內容
const { chromium } = require('playwright');

const SUPABASE_URL = 'https://sjokgfqpyuzrhuvrnvcz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_0shlrzPR6MoWE5td6BO3Pg_onhIIWK_';

const https = require('https');

const IMAGE_CACHE = {};

async function getBingImage(title, author = '') {
  const cached = IMAGE_CACHE[title];
  if (cached) return cached;
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Generate multiple keyword variations
    const keywords = [
      title,
      title.substring(0, 30),
      title.split(/[，。！？]/)[0],
      author ? `${author} ${title.substring(0, 15)}` : title.substring(0, 20)
    ];
    
    for (const keyword of keywords) {
      const query = encodeURIComponent(keyword);
      await page.goto(`https://www.bing.com/images/search?q=${query}`, { 
        waitUntil: 'networkidle', 
        timeout: 20000 
      });
      await page.waitForTimeout(3000);
      
      const img = await page.evaluate(() => {
        const imgs = document.querySelectorAll('.mimg');
        for (const i of imgs) {
          if (i.src && i.src.startsWith('http') && i.src.includes('bing.net')) {
            return i.src;
          }
        }
        return null;
      });
      
      if (img) {
        IMAGE_CACHE[title] = img;
        return img;
      }
    }
    
    return null;
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
      const selectors = ['article', '.article-content', '.article-body', '.content', '[class*="content"]', '.post-content', '.entry-content'];
      
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
    category: 'world', author: 'BBC中文', date, image: imageUrl
  });
  return fetch(`${SUPABASE_URL}/rest/v1/articles`, 'POST', body);
}

async function main() {
  console.log('=== Starting BBC sync at', new Date().toISOString(), '===');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    console.log('Loading BBC Chinese homepage...');
    await page.goto('https://www.bbc.com/zhongwen/trad', { 
      waitUntil: 'domcontentloaded',
      timeout: 120000 
    });
    await page.waitForTimeout(10000);
    
    const articles = await page.evaluate(() => {
      const items = [];
      const allLinks = document.querySelectorAll('a');
      
      allLinks.forEach(link => {
        const text = link.innerText?.trim();
        const href = link.href;
        
        if (text && text.length > 20 && href && href.includes('bbc.com') && 
            (href.includes('/news/') || href.includes('/zhongwen/')) &&
            !href.includes('BBC')) {
          items.push({ title: text, url: href });
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
      if (count >= 5) break;
      
      const exists = await articleExists(article.title);
      if (exists) {
        console.log('Skipping existing:', article.title);
        continue;
      }
      
      console.log('Getting content for:', article.title);
      const content = await getArticleContent(page, article.url);
      
      const bingImage = await getBingImage(article.title, 'BBC中文');
      
      await createArticle(article.title, article.title, content || article.title, bingImage);
      console.log('Created:', article.title, '| Content length:', content?.length || 0);
      count++;
    }
    
    console.log(`=== BBC sync complete: ${count} new articles ===`);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
}

main();
