// sync-macau.cjs
// Sync Macau Daily news to Supabase - runs every 30 minutes
const https = require('https');
const { URL } = require('url');

const SUPABASE_URL = 'https://sjokgfqpyuzrhuvrnvcz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_0shlrzPR6MoWE5td6BO3Pg_onhIIWK_';

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => { resolve(data); });
    }).on('error', reject);
  });
}

function checkImage(url) {
  return new Promise((resolve) => {
    if (!url) { resolve(false); return; }
    https.get(url, (res) => { resolve(res.statusCode === 200); })
      .on('error', () => resolve(false));
  });
}

async function getNewsItems() {
  const html = await fetchText('https://appimg.modaily.cn/amucsite/web/index.html#/home');
  const linkRegex = /<a[^>]*href=["'](#\/detail\/\d+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const items = [];
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    let title = match[2].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (title && match[1] && !title.includes('更多') && !title.includes('全部') && title.length > 5) {
      items.push({ title, href: match[1] });
    }
  }
  const seen = new Set();
  return items.filter(item => {
    if (seen.has(item.title.toLowerCase())) return false;
    seen.add(item.title.toLowerCase());
    return true;
  });
}

async function getNewsDetail(href) {
  const url = new URL(href, 'https://appimg.modaily.cn/amucsite/web/index.html').toString();
  const html = await fetchText(url);
  
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  let title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
  
  let content = '';
  const pMatches = html.match(/<p[^>]*>([\s\S]*?)<\/p>/g);
  if (pMatches) {
    for (const p of pMatches) {
      const text = p.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text.length > 50) { content = text; break; }
    }
  }
  
  const imgMatch = html.match(/<img[^>]*src=["']([^"']*\/pic\/[^"']*\.(?:jpg|jpeg|png|webp))["'][^>]*>/i);
  const imageUrl = imgMatch ? imgMatch[1] : null;
  
  return { title, content, imageUrl };
}

async function articleExists(title) {
  const url = `${SUPABASE_URL}/rest/v1/articles?select=id&title=eq.${encodeURIComponent(title)}`;
  const data = await fetchText(url);
  try { return JSON.parse(data).length > 0; } catch { return false; }
}

async function createArticle(title, excerpt, content, imageUrl) {
  const date = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
  const body = {
    title, excerpt: excerpt || title,
    content: `<p>${content.replace(/\n/g, '<br>')}</p>`,
    category: 'macaodaily', author: '澳門日報', date, image: imageUrl
  };
  
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const options = {
      hostname: new URL(SUPABASE_URL).hostname,
      path: '/rest/v1/articles', method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json', 'Prefer': 'return=representation',
        'Content-Length': postData.length
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('=== Starting sync at', new Date().toISOString(), '===');
  
  try {
    const newsItems = await getNewsItems();
    console.log(`Found ${newsItems.length} news items`);
    
    let added = 0;
    for (const item of newsItems) {
      if (added >= 3) break;
      
      const exists = await articleExists(item.title);
      if (exists) continue;
      
      const detail = await getNewsDetail(item.href);
      if (!detail.title || !detail.content) continue;
      
      let finalImage = null;
      if (detail.imageUrl) {
        const isValid = await checkImage(detail.imageUrl);
        if (isValid) finalImage = detail.imageUrl;
      }
      
      await createArticle(detail.title, detail.content, detail.content, finalImage);
      console.log(`Added: ${detail.title.substring(0, 40)}`);
      added++;
      
      await new Promise(r => setTimeout(r, 1500));
    }
    
    console.log(`=== Sync complete: ${added} new articles ===`);
  } catch (err) {
    console.error('Sync error:', err.message);
  }
}

main();
