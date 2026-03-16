#!/usr/bin/env python3
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    # Navigate and wait for network to settle
    page.goto('https://appimg.modaily.cn/amucsite/web/index.html#/home', wait_until='networkidle', timeout=60000)
    page.wait_for_timeout(5000)
    
    # Get full HTML
    content = page.content()
    print('HTML length:', len(content))
    
    # Check for specific content
    if '澳日' in content:
        print('Found: 澳日')
    if 'news' in content.lower():
        print('Found: news')
    
    # Get all text from body
    body_text = page.evaluate('document.body.innerText')
    print('\n=== Body text (first 2000 chars) ===')
    print(body_text[:2000])
    
    browser.close()
