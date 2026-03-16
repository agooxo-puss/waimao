#!/usr/bin/env python3
from playwright.sync_api import sync_playwright
import re

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('https://appimg.modaily.cn/amucsite/web/index.html#/home', wait_until='domcontentloaded')
    page.wait_for_timeout(4000)
    
    content = page.content()
    
    print('=== HREFs with # or detail ===')
    matches = re.findall(r'href=["\']([^"\']+)["\']', content)
    for m in matches:
        if 'detail' in m or '#/' in m:
            print(f'  {m}')
    
    print('\n=== Sample of content ===')
    # Find text that looks like titles
    titles = re.findall(r'>([^<]{10,80})<', content)
    for t in titles[:30]:
        if any(c.isalpha() for c in t):
            print(f'  {t.strip()}')
    
    browser.close()
