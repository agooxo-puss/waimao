// sync-cool3c.cjs
// 使用 RSS 從 Cool3c 同步科技新聞
const https = require('https');
const { URL } = require('url');
const { chromium } = require('playwright');

const SUPABASE_URL = 'https://sjokgfqpyuzrhuvrnvcz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_0shlrzPR6MoWE5td6BO3Pg_onhIIWK_';

const IMAGE_CACHE = {};

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => { resolve(data); });
    }).on('error', reject);
  });
}

async function getBingImage(title, author = '') {
  const cached = IMAGE_CACHE[title];
  if (cached) return cached;
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
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

function cleanContent(content) {
  if (!content) return content;
  
  const lines = content.split('\n');
  const cleanedLines = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.length < 5) continue;
    
    if (trimmed.includes('版權所有') || trimmed.includes('©') || 
        trimmed.includes('All rights reserved') || trimmed.includes('延伸閱讀') ||
        trimmed.includes('延伸推薦') || trimmed.includes('相關文章') ||
        trimmed.includes('熱門') || trimmed.includes('更多報導')) {
      break;
    }
    
    cleanedLines.push(trimmed);
  }
  
  return cleanedLines.join('\n');
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
    title,
    excerpt: excerpt || title.substring(0, 100),
    content: content ? `<p>${content.replace(/\n/g, '</p><p>')}</p>` : `<p>${title}</p>`,
    category: 'tech',
    author: 'Cool3c',
    date,
    image: imageUrl
  });
  return fetch(`${SUPABASE_URL}/rest/v1/articles`, 'POST', body);
}

function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  
  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    
    const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
    const title = titleMatch ? (titleMatch[1] || titleMatch[2] || '').trim() : '';
    
    const linkMatch = item.match(/<link>(.*?)<\/link>/);
    const link = linkMatch ? linkMatch[1].trim() : '';
    
    const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/);
    const description = descMatch ? (descMatch[1] || descMatch[2] || '').trim() : '';
    
    const contentMatch = item.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/);
    const content = contentMatch ? contentMatch[1].trim() : '';
    
    const imgMatch = item.match(/<media:content[^>]*url="([^"]+)"/);
    const image = imgMatch ? imgMatch[1] : null;
    
    const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
    const pubDate = pubDateMatch ? pubDateMatch[1] : '';
    
    if (title && link) {
      items.push({ title, link, description, content, image, pubDate });
    }
  }
  
  return items;
}

async function main() {
  console.log('=== Starting Cool3c sync at', new Date().toISOString(), '===');
  
  try {
    console.log('Fetching RSS feed...');
    const xml = await fetchText('https://www.cool3c.com/rss');
    const items = parseRSS(xml);
    
    console.log(`Found ${items.length} articles`);
    
    let count = 0;
    for (const item of items) {
      if (count >= 5) break;
      
      const exists = await articleExists(item.title);
      if (exists) {
        console.log('Skipping existing:', item.title);
        continue;
      }
      
      console.log('Processing:', item.title);
      
      let imageUrl = item.image;
      
      if (!imageUrl) {
        imageUrl = await getBingImage(item.title, 'Cool3c');
      }
      
      const cleanHtml = cleanContent(item.content);
      
      await createArticle(
        item.title,
        item.description.replace(/<[^>]*>/g, '').substring(0, 200),
        cleanHtml,
        imageUrl
      );
      
      console.log('Created:', item.title, imageUrl ? '(with image)' : '(no image)');
      count++;
    }
    
    console.log(`=== Cool3c sync complete: ${count} new articles ===`);
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
