const fetch = require('node-fetch');
const { URL } = require('url');

const SUPABASE_URL = 'https://sjokgfqpyuzrhuvrnvcz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_0shlrzPR6MoWE5td6BO3Pg_onhIIWK_';

async function fetchPage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return await res.text();
}

async function getNewsList() {
  const html = await fetchPage('https://appimg.modaily.cn/amucsite/web/index.html#/home');
  // Extract news items: each item is in a list item with link to detail
  const items = [];
  const detailLinkRegex = /<a[^>]*href=["'](#\/detail\/\d+)["'][^>]*>([\s\S]*?)<\/a>/g;
  let match;
  while ((match = detailLinkRegex.exec(html)) !== null) {
    const href = match[1];
    const titleText = match[2].replace(/<[^>]*>/g, '').trim();
    if (titleText && href) {
      items.push({ title: titleText, href });
    }
  }
  // Deduplicate by title
  const seen = new Set();
  const unique = [];
  for (const item of items) {
    if (!seen.has(item.title)) {
      seen.add(item.title);
      unique.push(item);
    }
  }
  return unique.slice(0, 20); // limit
}

async function getNewsDetail(href) {
  const fullUrl = new URL(href, 'https://appimg.modaily.cn/amucsite/web/index.html').toString();
  const html = await fetchPage(fullUrl);
  
  // Extract title
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';
  
  // Extract content (first paragraph or div with class containing content)
  const contentMatch = html.match(/<div[^>]*class=["']([^"]*content[^"]*)["'][\s\S]*?>([\s\S]*?)<\/\/div>/i) ||
                       html.match(/<p[^>]*>([\s\S]*?)<\/p>/);
  let content = '';
  if (contentMatch) {
    content = contentMatch[2] || contentMatch[1];
    content = content.replace(/<[^>]*>/g, '').trim();
  }
  
  // Extract image URL
  const imgMatch = html.match(/<img[^>]*src=["']([^"']*\.(?:jpg|jpeg|png|webp))["'][^>]*>/i);
  const imageUrl = imgMatch ? imgMatch[1] : null;
  
  return { title, content, imageUrl };
}

async function articleExists(title) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/articles?select=id&title=eq.${encodeURIComponent(title)}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  if (!res.ok) return false;
  const data = await res.json();
  return data.length > 0;
}

async function createArticle(title, excerpt, content, imageUrl, category = 'macaodaily', author = '澳門日報') {
  const date = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
  const body = {
    title,
    excerpt: excerpt || title,
    content: `<p>${content.replace(/\n/g, '<br>')}</p>`,
    category,
    author,
    date,
    image: imageUrl
  };
  
  const res = await fetch(`${SUPABASE_URL}/rest/v1/articles`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(body)
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create article: ${res.status} ${err}`);
  }
  return await res.json();
}

async function main() {
  console.log('Starting Macau Daily news sync with images...');
  try {
    const newsList = await getNewsList();
    console.log(`Found ${newsList.length} news items on homepage`);
    
    let added = 0;
    let skipped = 0;
    for (const item of newsList) {
      try {
        const exists = await articleExists(item.title);
        if (exists) {
          console.log(`Skipping existing: ${item.title.substring(0,30)}...`);
          skipped++;
          continue;
        }
        
        console.log(`Fetching detail for: ${item.title.substring(0,30)}...`);
        const detail = await getNewsDetail(item.href);
        if (!detail.imageUrl) {
          console.log(`Skipping (no image): ${detail.title.substring(0,30)}...`);
          skipped++;
          continue;
        }
        
        console.log(`Adding: ${detail.title.substring(0,30)}...`);
        await createArticle(detail.title, detail.content, detail.content, detail.imageUrl);
        added++;
        // Be nice to the server
        await new Promise(r => setTimeout(r, 1000));
      } catch (err) {
        console.error(`Error processing ${item.title}:`, err.message);
      }
    }
    
    console.log(`Sync complete. Added: ${added}, Skipped: ${skipped}`);
  } catch (err) {
    console.error('Sync failed:', err);
    process.exit(1);
  }
}

main();
