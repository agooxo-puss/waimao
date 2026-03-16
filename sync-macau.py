#!/usr/bin/env python3
# sync-macau.py - Sync Macau Daily news with browser automation

import json
import urllib.request
import urllib.parse
from datetime import datetime
from playwright.sync_api import sync_playwright

SUPABASE_URL = "https://sjokgfqpyuzrhuvrnvcz.supabase.co"
SUPABASE_KEY = "sb_publishable_0shlrzPR6MoWE5td6BO3Pg_onhIIWK_"
DEFAULT_IMAGE = "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&h=500&fit=crop"

def fetch(url, method="GET", body=None):
    headers = {"Content-Type": "application/json"}
    if method == "POST":
        headers["apikey"] = SUPABASE_KEY
        headers["Authorization"] = f"Bearer {SUPABASE_KEY}"
        headers["Prefer"] = "return=representation"
    
    req = urllib.request.Request(url, data=body.encode() if body else None, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read().decode()
    except Exception as e:
        print(f"Request error: {e}")
        return None

def check_image(url):
    if not url: return False
    try:
        req = urllib.request.Request(url, method="HEAD")
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except:
        return False

def article_exists(title):
    url = f"{SUPABASE_URL}/rest/v1/articles?select=id&title=eq.{urllib.parse.quote(title)}"
    data = fetch(url)
    if data:
        try:
            return len(json.loads(data)) > 0
        except:
            pass
    return False

def create_article(title, excerpt, content, image_url):
    date = datetime.now().strftime("%Y年%m月%d日")
    body = json.dumps({
        "title": title,
        "excerpt": excerpt or title,
        "content": f"<p>{content}</p>",
        "category": "macaodaily",
        "author": "澳門日報",
        "date": date,
        "image": image_url
    })
    
    url = f"{SUPABASE_URL}/rest/v1/articles"
    return fetch(url, method="POST", body=body)

def get_news_items_from_page(page):
    """Get news titles from page - they are rendered dynamically"""
    # Get all text content and parse news
    body_text = page.evaluate('document.body.innerText')
    
    # Parse the text to find news titles
    # Format seems to be: "時間\n標題" pattern
    lines = body_text.split('\n')
    
    news_items = []
    skip_categories = ['即時', '澳門記憶', '澳日快趣', '產業多元', '社會迴響', '澳門旅遊+', 
                       '感受橫琴', '味力澳門', '心耕都更', '專題', '視頻', '藝文', '要聞',
                       '小城故事', '粵澳對話', '灣區視野', 'VR', '美圖', '科技', '直播',
                       '更多', '排行榜', '加載更多', '關注澳門日報各大平台']
    
    skip_times = ['剛剛', '1小時前', '2小時前', '3小時前', '分鐘前']
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # Check if this line is a time indicator
        if line in skip_times:
            # Next non-empty line might be the title
            i += 1
            while i < len(lines):
                title = lines[i].strip()
                # Skip category names and very short lines
                if title and title not in skip_categories and len(title) >= 6:
                    # Try to find the detail page link
                    # Use JavaScript to find element with this text and get its click handler or href
                    href = page.evaluate(f'''
                        () => {{
                            const elements = document.querySelectorAll('*');
                            for (const el of elements) {{
                                if (el.innerText && el.innerText.trim() === '{title.replace("'", "\\'")}' && el.closest('a')) {{
                                    const a = el.closest('a');
                                    return a.getAttribute('href') || a.getAttribute('ng-click') || '';
                                }}
                            }}
                            return '';
                        }}
                    ''')
                    news_items.append({"title": title, "href": href})
                    break
                i += 1
        i += 1
    
    # Remove duplicates
    seen = set()
    unique = []
    for item in news_items:
        key = item["title"].lower()
        if key not in seen and len(item["title"]) > 5:
            seen.add(key)
            unique.append(item)
    
    return unique[:10]

def get_news_detail_from_page(page, title):
    """Click on news and get detail"""
    # Find and click the element with this title
    try:
        # Click on element containing title
        page.evaluate(f'''
            () => {{
                const elements = document.querySelectorAll('*');
                for (const el of elements) {{
                    if (el.innerText && el.innerText.trim() === '{title.replace("'", "\\'")}') {{
                        el.click();
                        return;
                    }}
                }}
            }}
        ''')
        
        page.wait_for_timeout(3000)
        
        # Get current URL
        current_url = page.url
        print(f"After click, URL: {current_url}")
        
        # Extract detail from page
        content = ""
        try:
            # Get content from body text
            body_text = page.evaluate('document.body.innerText')
            lines = body_text.split('\n')
            for line in lines:
                line = line.strip()
                # Skip headers and metadata
                if line in skip_categories or line in skip_times:
                    continue
                if len(line) > 50:
                    content = line
                    break
        except:
            pass
        
        # Get image
        image_url = None
        try:
            imgs = page.query_selector_all('img[src*="/pic/"]')
            for img in imgs:
                src = img.get_attribute('src')
                if src and any(ext in src for ext in ['.jpg', '.jpeg', '.png']):
                    image_url = src
                    break
        except:
            pass
        
        # Go back
        page.go_back()
        page.wait_for_timeout(2000)
        
        return {"title": title, "content": content, "image_url": image_url}
        
    except Exception as e:
        print(f"Error getting detail: {e}")
        return {"title": title, "content": "", "image_url": None}

def main():
    print(f"=== Starting sync at {datetime.now().isoformat()} ===")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        
        try:
            # Get homepage
            print("Loading homepage...")
            page.goto('https://appimg.modaily.cn/amucsite/web/index.html#/home', wait_until='networkidle', timeout=60000)
            page.wait_for_timeout(3000)
            
            # Get news items
            print("Extracting news titles...")
            news_items = get_news_items_from_page(page)
            print(f"Found {len(news_items)} news items")
            
            added = 0
            for item in news_items[:5]:
                if added >= 3:
                    break
                
                title = item["title"]
                if article_exists(title):
                    print(f"Skipping: {title[:30]}...")
                    continue
                
                print(f"Getting detail for: {title[:30]}...")
                detail = get_news_detail_from_page(page, title)
                
                if not detail["content"]:
                    print(f"Skipping no content: {title[:30]}...")
                    continue
                
                # Use image if valid
                final_image = DEFAULT_IMAGE
                if detail["image_url"]:
                    if check_image(detail["image_url"]):
                        final_image = detail["image_url"]
                
                create_article(detail["title"], detail["content"], detail["content"], final_image)
                print(f"Added: {title[:30]}...")
                added += 1
            
            print(f"=== Sync complete: {added} new articles ===")
            
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    main()
