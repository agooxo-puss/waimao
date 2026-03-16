// fix-sports-image.cjs
const https = require('https');

const SUPABASE_URL = 'https://sjokgfqpyuzrhuvrnvcz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_0shlrzPR6MoWE5td6BO3Pg_onhIIWK_';

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
  const sportsImage = 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&h=500&fit=crop';
  
  const data = await fetch(SUPABASE_URL + '/rest/v1/articles?select=id&category=eq.sports');
  const articles = JSON.parse(data);
  
  console.log(`Fixing ${articles.length} sports articles...`);
  
  for (const article of articles) {
    await fetch(SUPABASE_URL + '/rest/v1/articles?id=eq.' + article.id, 'PATCH', 
      JSON.stringify({ image: sportsImage }));
  }
  
  console.log('Done!');
}

main();
