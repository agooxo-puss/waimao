// update-all-images.js
// 更新所有文章既圖片為關鍵字搜索圖片
const https = require('https');

const SUPABASE_URL = 'https://sjokgfqpyuzrhuvrnvcz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_0shlrzPR6MoWE5td6BO3Pg_onhIIWK_';

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

function generateKeywordImage(title, category) {
  // Extract keywords from title
  const keywords = title
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ')
    .split(' ')
    .filter(w => w.length > 1)
    .slice(0, 3)
    .join(',');
  
  // Add category context
  const categoryMap = {
    world: 'international,news',
    tech: 'technology,news',
    sports: 'sports,news',
    culture: 'culture,art',
    business: 'business,hong kong',
    macaodaily: 'macau,travel'
  };
  
  const catKeywords = categoryMap[category] || 'news';
  const allKeywords = keywords ? `${keywords},${catKeywords}` : catKeywords;
  
  return `https://source.unsplash.com/800x500/?${encodeURIComponent(allKeywords)}`;
}

async function main() {
  console.log('=== Updating all article images ===');
  
  // Fetch all articles
  const data = await fetch(`${SUPABASE_URL}/rest/v1/articles?select=id,title,category`);
  const articles = JSON.parse(data);
  
  console.log(`Found ${articles.length} articles`);
  
  let count = 0;
  for (const article of articles) {
    const newImage = generateKeywordImage(article.title, article.category);
    
    const body = JSON.stringify({ image: newImage });
    await fetch(`${SUPABASE_URL}/rest/v1/articles?id=eq.${article.id}`, 'PATCH', body);
    
    console.log(`Updated: ${article.title.substring(0, 30)}...`);
    count++;
  }
  
  console.log(`=== Updated ${count} articles ===`);
}

main();
