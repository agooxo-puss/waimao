// fix-invalid-images.cjs
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
  return new Promise((resolve) => {
    const options = new URL(url);
    const req = https.request({
      hostname: options.hostname,
      path: options.pathname + options.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', () => resolve(null));
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  console.log('=== Fixing invalid images ===');
  
  const data = await fetch(SUPABASE_URL + '/rest/v1/articles?select=id,title,image');
  const articles = JSON.parse(data);
  
  // Filter articles with invalid images (discord, unsplash that don't work)
  const invalid = articles.filter(a => a.image && (a.image.includes('discord') || a.image.includes('unsplash') || !a.image.startsWith('http')));
  
  console.log(`Found ${invalid.length} articles with invalid images`);
  
  for (const article of invalid) {
    console.log(`Fixing: ${article.title.substring(0, 30)}...`);
    
    const bingImage = await getBingImage(article.title);
    
    if (bingImage) {
      await fetch(SUPABASE_URL + '/rest/v1/articles?id=eq.' + article.id, 'PATCH', 
        JSON.stringify({ image: bingImage }));
      console.log(`  Updated with Bing image`);
    } else {
      console.log(`  No image found`);
    }
  }
  
  console.log('=== Done ===');
}

main();
