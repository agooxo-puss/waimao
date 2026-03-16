// fix-images.cjs
// Fix all images with working URLs
const https = require('https');

const SUPABASE_URL = 'https://sjokgfqpyuzrhuvrnvcz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_0shlrzPR6MoWE5td6BO3Pg_onhIIWK_';

// Working image URLs for each category
const CATEGORY_IMAGES = {
  world: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&h=500&fit=crop',
  tech: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=500&fit=crop',
  sports: 'https://images.unsplash.com/photo-1461896836934- voices-4f2d5f7d1e3b?w=800&h=500&fit=crop',
  culture: 'https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=800&h=500&fit=crop',
  business: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&h=500&fit=crop',
  macaodaily: 'https://images.unsplash.com/photo-1566603582824-1366035c4b49?w=800&h=500&fit=crop'
};

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

async function main() {
  console.log('=== Fixing all article images ===');
  
  const data = await fetch(`${SUPABASE_URL}/rest/v1/articles?select=id,category`);
  const articles = JSON.parse(data);
  
  console.log(`Found ${articles.length} articles`);
  
  let count = 0;
  for (const article of articles) {
    const imageUrl = CATEGORY_IMAGES[article.category] || CATEGORY_IMAGES.world;
    
    const body = JSON.stringify({ image: imageUrl });
    await fetch(`${SUPABASE_URL}/rest/v1/articles?id=eq.${article.id}`, 'PATCH', body);
    
    count++;
  }
  
  console.log(`=== Fixed ${count} articles ===`);
}

main();
