// sync-news.js
// Sync top news from Macau Daily to Supabase with images
// Checks image validity before adding articles

const https = require('https');
const { URL } = require('url');

const SUPABASE_URL = 'https://sjokgfqpyuzrhuvrnvcz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_0shlrzPR6MoWE5td6BO3Pg_onhIIWK_';

// Default fallback image (used when source image is broken)
const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&h=500&fit=crop';

// Helper function to make a GET request and return the response body as text
function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve(data);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Check if a URL returns a valid image (HTTP 200)
function checkImageUrl(imageUrl) {
  return new Promise((resolve) => {
    if (!imageUrl) {
      resolve(false);
      return;
    }
    https.get(imageUrl, (res) => {
      resolve(res.statusCode === 200);
    }).on('error', () => {
      resolve(false);
    });
  });
}

// Extract news items from the homepage
async function getNewsItems() {
  try {
    const html = await fetchText('https://appimg.modaily.cn/amucsite/web/index.html#/home');
    const linkRegex = /<a[^>]*href=["'](#\/detail\/\d+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    const items = [];
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      let title = match[2].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (title && href && !title.includes('更多') && !title.includes('全部') && title.length > 5) {
        items.push({ title, href });
      }
    }
    const seen = new Set();
    const unique = [];
    for (const item of items) {
      const lowerTitle = item.title.toLowerCase();
      if (!seen.has(lowerTitle)) {
        seen.add(lowerTitle);
        unique.push(item);
      }
    }
    return unique;
  } catch (err) {
    console.error('Error fetching news list:', err);
    return [];
  }
}

// Fetch the detail page for a news item and extract title, content, and image URL
async function getNewsDetail(href) {
  try {
    const baseUrl = 'https://appimg.modaily.cn/amucsite/web/index.html';
    const url = new URL(href, baseUrl).toString();
    const html = await fetchText(url);
    
    // Extract title
    const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    let title = '';
    if (titleMatch) {
      title = titleMatch[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    
    // Extract content
    let content = '';
    const contentDivMatch = html.match(/<div[^>]*class=["'][^"']*(content|article)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    if (contentDivMatch) {
      content = contentDivMatch[2];
    } else {
      const pMatches = html.match(/<p[^>]*>([\s\S]*?)<\/p>/g);
      if (pMatches) {
        for (const p of pMatches) {
          const text = p.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          if (text.length > 50) {
            content = text;
            break;
          }
        }
      }
    }
    content = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Extract image URL
    const imgMatch = html.match(/<img[^>]*src=["']([^"']*\/pic\/[^"']*\.(?:jpg|jpeg|png|webp))["'][^>]*>/i);
    let imageUrl = null;
    if (imgMatch) {
      imageUrl = imgMatch[1];
    }
    
    return { title, content, imageUrl };
  } catch (err) {
    console.error(`Error fetching news detail for ${href}:`, err);
    return { title: '', content: '', imageUrl: null };
  }
}

// Check if an article with the given title already exists in Supabase
async function articleExists(title) {
  try {
    const url = `${SUPABASE_URL}/rest/v1/articles?select=id&title=eq.${encodeURIComponent(title)}`;
    const response = await fetchText(url);
    const data = JSON.parse(response);
    return Array.isArray(data) && data.length > 0;
  } catch (err) {
    console.error('Error checking article existence:', err);
    return false;
  }
}

// Insert a new article into Supabase
async function createArticle(title, excerpt, content, imageUrl) {
  try {
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
    
    const bodyJson = JSON.stringify(body);
    
    const options = {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    };
    
    const url = `${SUPABASE_URL}/rest/v1/articles`;
    const { hostname, path } = new URL(url);
    
    return new Promise((resolve, reject) => {
      const req = https.request({ hostname, path, method: 'POST', headers: options.headers }, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (e) {
            reject(new Error(`Failed to parse response: ${e.message}`));
          }
        });
      });
      
      req.on('error', (err) => {
        reject(err);
      });
      
      req.write(bodyJson);
      req.end();
    });
  } catch (err) {
    console.error('Error creating article:', err);
    throw err;
  }
}

// Main function
async function main() {
  try {
    console.log('Starting Macau Daily news sync...');
    
    const newsItems = await getNewsItems();
    console.log(`Found ${newsItems.length} unique news items on the homepage`);
    
    let addedCount = 0;
    const maxToAdd = 2;
    
    for (const item of newsItems) {
      if (addedCount >= maxToAdd) break;
      
      try {
        const exists = await articleExists(item.title);
        if (exists) {
          console.log(`Skipping existing article: "${item.title.substring(0, 50)}..."`);
          continue;
        }
        
        console.log(`Fetching detail for: "${item.title.substring(0, 50)}..."`);
        const detail = await getNewsDetail(item.href);
        
        if (!detail.title || !detail.content) {
          console.log(`Skipping article due to missing data: "${item.title.substring(0, 50)}..."`);
          continue;
        }
        
        // Check if image is valid, use default if broken
        let finalImageUrl = detail.imageUrl;
        if (detail.imageUrl) {
          const isImageValid = await checkImageUrl(detail.imageUrl);
          if (!isImageValid) {
            console.log(`Source image is broken (404), using default image`);
            finalImageUrl = DEFAULT_IMAGE;
          }
        } else {
          console.log(`No image found, using default image`);
          finalImageUrl = DEFAULT_IMAGE;
        }
        
        console.log(`Creating article: "${item.title.substring(0, 50)}..."`);
        await createArticle(detail.title, detail.content, detail.content, finalImageUrl);
        addedCount++;
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (err) {
        console.error(`Error processing news item "${item.title.substring(0, 50)}...":`, err.message);
      }
    }
    
    console.log(`Sync completed. Added ${addedCount} new articles.`);
  } catch (err) {
    console.error('Sync failed:', err);
    process.exit(1);
  }
}

main();
