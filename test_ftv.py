import asyncio
import re
from playwright.async_api import async_playwright

async def test():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True)
        p = await b.new_page()
        await p.goto('https://www.ftvnews.com.tw/')
        await p.wait_for_timeout(5000)
        print('URL:', p.url)
        print('Title:', await p.title())
        html = await p.content()
        print('Length:', len(html))
        
        # Find links
        links = re.findall(r'href="(https?://[^"]+ftvnews[^"]+)"', html, re.IGNORECASE)
        print('FTV links:', len(links))
        print('Sample:', links[:5])
        
        await b.close()

asyncio.run(test())
