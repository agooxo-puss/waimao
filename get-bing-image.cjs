// get-bing-image.cjs
// Get relevant image from Bing based on title
const { chromium } = require('playwright');

const CACHE = {};

async function getBingImage(keyword) {
  // Check cache first
  if (CACHE[keyword]) {
    return CACHE[keyword];
  }

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
      return urls.slice(0, 3);
    });
    
    const result = images[0] || null;
    CACHE[keyword] = result;
    return result;
  } catch (e) {
    console.log('Error:', e.message);
    return null;
  } finally {
    await browser.close();
  }
}

// Test
if (require.main === module) {
  const keyword = process.argv[2] || 'hong kong city';
  getBingImage(keyword).then(url => {
    console.log('Image URL:', url);
  });
}

module.exports = { getBingImage };
