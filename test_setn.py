import asyncio
import re
from playwright.async_api import async_playwright

async def test():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True)
        p = await b.new_page()
        
        # Try main page first
        await p.goto('https://www.setn.com')
        await p.wait_for_timeout(5000)
        print('URL:', p.url)
        print('Title:', await p.title())
        
        html = await p.content()
        print('Length:', len(html))
        
        # Find links
        links = re.findall(r'href="(https?://www\.setn\.com/[^"]+)"', html)
        print('Links found:', len(links))
        
        # Filter for news articles
        news_links = [l for l in links if 'news' in l.lower() or 'viewall' in l.lower()]
        print('News links:', news_links[:5])
        
        await b.close()

asyncio.run(test())
