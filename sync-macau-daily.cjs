// sync-macau-daily.cjs
// Fetches top news from Macau Daily and inserts into Supabase with images

const fetch = require('node-fetch');

const SUPABASE_URL = 'https://sjokgfqpyuzrhuvrnvcz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_0shlrzPR6MoWE5td6BO3Pg_onhIIWK_';

// Helper to fetch a URL and return text
async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

// Extract news list items from homepage
async function getNewsItems() {
  const html = await fetchText('https://appimg.modaily.cn/amucsite/web/index.html#/home');
  // Find all links that point to detail pages
  const linkRegex = /<a[^>]*href=["'](#\/detail\/\d+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const items = [];
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    // Extract text content, stripping HTML tags
    let title = match[2].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (title && href && !title.includes('更多') && !title.includes('全部') && title.length > 5) {
      items.push({ title, href });
    }
  }
  // Remove duplicates by title
  const seen = new Set();
  const unique = [];
  for (const item of items) {
    if (!seen.has(item.title)) {
      seen.add(item.title);
      unique.push(item);
    }
  }
  return unique;
}

// Fetch detail page and extract title, content, image
async function getNewsDetail(href) {
  const url = new URL(href, 'https://appimg.modaily.cn/amucsite/web/index.html').toString();
  const html = await fetchText(url);
  
  // Extract title: look for h1
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  let title = '';
  if (titleMatch) {
    title = titleMatch[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  
  // Extract content: look for the main content area, fallback to first paragraph
  let content = '';
  // Try to find a div with class containing 'content' or 'article'
  const contentDivMatch = html.match(/<div[^>]*class=["'][^"']*(content|article)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (contentDivMatch) {
    content = contentDivMatch[2];
  } else {
    // Fallback to first p tag
    const pMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (pMatch) {
      content = pMatch[1];
    }
  }
  // Clean content: remove HTML tags, replace newlines with spaces
  content = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Extract image URL: look for img with src containing 'pic'
  const imgMatch = html.match(/<img[^>]*src=["']([^"']*\/pic\/[^"']*\.(?:jpg|jpeg|png|webp))["'][^>]*>/i);
  let imageUrl = null;
  if (imgMatch) {
    imageUrl = imgMatch[1];
  }
  
  return { title, content, imageUrl };
}

// Check if article already exists in Supabase by title
async function articleExists(title) {
  const url = `${SUPABASE_URL}/rest/v1/articles?select=id&title=eq.${encodeURIComponent(title)}`;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  if (!res.ok) return false;
  const data = await res.json();
  return data.length > 0;
}

// Insert article into Supabase
async function createArticle(title, excerpt, content, imageUrl) {
  const date = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
  const body = {
    title,
    excerpt: excerpt || title,
    content: `<p>${content.replace(/\n/g, '<br>')}</p>`,
    category: 'macaodaily',
    author: '澳門日報',
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

// Main function
async function main() {
  try {
    console.log('Fetching news list...');
    const newsItems = await getNewsItems();
    console.log(`Found ${newsItems.length} unique news items`);
    
    let added = 0;
    let skipped = 0;
    
    // Process each news item until we have added 2 articles with images
    for (const item of newsItems) {
      if (added >= 2) break; // We only want the top two
      
      try {
        // Check if already exists
        const exists = await articleExists(item.title);
        if (exists) {
          console.log(`Skipping existing: ${item.title.substring(0, 30)}...`);
          skipped++;
          continue;
        }
        
        // Fetch detail
        console.log(`Fetching detail for: ${item.title.substring(0, 30)}...`);
        const detail = await getNewsDetail(item.href);
        
        // Validate we have title, content, and image
        if (!detail.title || !detail.content || !detail.imageUrl) {
          console.log(`Skipping incomplete article: ${item.title.substring(0, 30)}... (title: ${!!detail.title}, content: ${!!detail.content}, image: ${!!detail.imageUrl})`);
          skipped++;
          continue;
        }
        
        // Create article
        console.log(`Adding article: ${detail.title.substring(0, 30)}...`);
        await createArticle(detail.title, detail.content, detail.content, detail.imageUrl);
        added++;
        
        // Be nice to the server
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (err) {
        console.error(`Error processing item ${item.title}:`, err.message);
        skipped++;
      }
    }
    
    console.log(`Sync complete. Added: ${added}, Skipped: ${skipped}`);
    process.exit(0);
  } catch (err) {
    console.error('Sync failed:', err);
    process.exit(1);
  }
}

main();
