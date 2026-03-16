// fix-all-images.cjs
const https = require('https');

const SUPABASE_URL = 'https://sjokgfqpyuzrhuvrnvcz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_0shlrzPR6MoWE5td6BO3Pg_onhIIWK_';

const CATEGORY_IMAGES = {
  world: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&h=500&fit=crop',
  tech: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=500&fit=crop',
  sports: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&h=500&fit=crop',
  culture: 'https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=800&h=500&fit=crop',
  business: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&h=500&fit=crop',
  macaodaily: 'https://images.unsplash.com/photo-1534113414509-0eec2bfb493f?w=800&h=500&fit=crop'
};

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
  console.log('=== Fixing all images ===');
  
  for (const [cat, img] of Object.entries(CATEGORY_IMAGES)) {
    const data = await fetch(SUPABASE_URL + '/rest/v1/articles?select=id&category=eq.' + cat);
    const articles = JSON.parse(data);
    
    console.log(`${cat}: ${articles.length} articles`);
    
    for (const article of articles) {
      await fetch(SUPABASE_URL + '/rest/v1/articles?id=eq.' + article.id, 'PATCH', 
        JSON.stringify({ image: img }));
    }
  }
  
  console.log('Done!');
}

main();
