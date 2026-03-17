#!/usr/bin/env python3
"""
================================================================
  KIMAKI - All-in-One News Sync & Monitor
================================================================
  Location: /Users/whypuss/.kimaki/projects/kimaki/waimao/kimaki.py
  
  Usage:
    python kimaki.py --help                    # Show help
    python kimaki.py --sync                    # Sync news
    python kimaki.py --monitor                  # Start web monitor on port 5000
    python kimaki.py --test https://example.com # Test a website
    python kimaki.py --screenshot               # Screenshot kimaki.vercel.app
================================================================
"""

import asyncio
import os
import sys
import re
import json
import argparse
import requests
from datetime import datetime
from urllib.parse import urljoin
from flask import Flask, render_template_string, jsonify, request

# ============================================================
# CONFIGURATION
# ============================================================
SUPABASE_URL = "https://sjokgfqpyuzrhuvrnvcz.supabase.co"
SUPABASE_KEY = "sb_publishable_0shlrzPR6MoWE5td6BO3Pg_onhIIWK_"

ADMIN_USER = "waimao"
ADMIN_PASS = "waimao123"

CATEGORY_NAMES = {
    "world": "國際",
    "tech": "科技",
    "sports": "體育",
    "culture": "文化",
    "business": "香港",
    "macaodaily": "澳門"
}

# ============================================================
# BROWSER AUTOMATION (puss.py)
# ============================================================
try:
    from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout
    HAS_PLAYWRIGHT = True
except ImportError:
    HAS_PLAYWRIGHT = False

class Browser:
    """Simple browser automation"""
    
    def __init__(self, headless=True):
        self.headless = headless
        self.page = None
        self.browser = None
        self.console = []
        self.requests = []
        
    async def __aenter__(self):
        await self.start()
        return self
        
    async def __aexit__(self, *args):
        await self.close()
        
    async def start(self):
        if HAS_PLAYWRIGHT:
            pw = await async_playwright().start()
            self.browser = await pw.chromium.launch(headless=self.headless)
            self.page = await self.browser.new_page()
            self.page.on("console", lambda m: self.console.append({"type": m.type, "text": m.text}))
            self.page.on("request", lambda r: self.requests.append({"url": r.url, "method": r.method}))
    
    async def goto(self, url, timeout=30000):
        if self.page:
            await self.page.goto(url, timeout=timeout)
    
    async def wait(self, ms):
        if self.page:
            await self.page.wait_for_timeout(ms)
    
    async def screenshot(self, path="screenshot.png"):
        if self.page:
            await self.page.screenshot(path=path)
            return True
        return False
    
    async def content(self):
        if self.page:
            return await self.page.content()
        return ""
    
    async def title(self):
        if self.page:
            return await self.page.title()
        return ""
    
    async def url(self):
        if self.page:
            return self.page.url
        return ""
    
    async def click(self, selector):
        if self.page:
            await self.page.click(selector)
    
    async def fill(self, selector, text):
        if self.page:
            await self.page.fill(selector, text)
    
    async def eval(self, script):
        if self.page:
            return await self.page.evaluate(script)
        return None
    
    async def close(self):
        if self.page:
            await self.page.close()
        if self.browser:
            await self.browser.close()


# ============================================================
# DATA SYNC FUNCTIONS
# ============================================================
def clean_html(html):
    """Clean HTML content"""
    if not html:
        return ""
    html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r'<(nav|footer|header|aside)[^>]*>.*?</\1>', '', html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r'<p>\s*</p>', '', html)
    return html

def get_date_str():
    return f"{datetime.now().year}年{datetime.now().month}月{datetime.now().day}日"

def article_exists(title):
    """Check if article already exists"""
    try:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/articles?title=eq.{title}",
            headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
        )
        return bool(r.json())
    except:
        return False

def save_article(title, excerpt, content, category, author, image):
    """Save article to Supabase"""
    data = {
        "title": title[:500] if title else "",
        "excerpt": excerpt[:1000] if excerpt else "",
        "content": content[:50000] if content else "",
        "category": category,
        "author": author,
        "date": get_date_str(),
        "image": image if image else None
    }
    try:
        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/articles",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            },
            json=data
        )
        return r.status_code in [200, 201]
    except Exception as e:
        print(f"Error saving: {e}")
        return False

async def sync_bbc():
    """Sync BBC Chinese news"""
    print("🔄 Syncing BBC Chinese...")
    
    async with Browser(headless=True) as b:
        await b.goto("https://www.bbc.com/zhongwen/simp")
        await b.wait(3000)
        
        # Get article links
        html = await b.content()
        
        # Simple pattern matching for BBC articles
        import re
        links = re.findall(r'href="(https?://[^"]+bbc[^"]+/articles/[^"]+)"', html)
        links = list(set(links))[:10]
        
        print(f"Found {len(links)} articles")
        
        for i, link in enumerate(links):
            try:
                await b.goto(link)
                await b.wait(2000)
                
                title = await b.eval("document.querySelector('h1')?.textContent") or ""
                if not title:
                    continue
                    
                if article_exists(title):
                    print(f"  ⏭️  Skip: {title[:40]}...")
                    continue
                
                # Get content
                content = await b.eval("document.querySelector('article')?.innerHTML") or ""
                content = clean_html(content)
                
                # Get image
                image = await b.eval("document.querySelector('meta[property=\"og:image\"]')?.content") or ""
                
                # Get excerpt
                excerpt = await b.eval("document.querySelector('meta[name=\"description\"]')?.content") or ""
                if not excerpt and content:
                    import bs4
                    excerpt = bs4.BeautifulSoup(content, 'lxml').get_text()[:200]
                
                category = "world"
                if "tech" in link or "science" in link:
                    category = "tech"
                elif "business" in link:
                    category = "business"
                elif "culture" in link:
                    category = "culture"
                
                if save_article(title, excerpt, content, category, "BBC中文", image):
                    print(f"  ✅ Saved: {title[:40]}...")
                else:
                    print(f"  ❌ Failed: {title[:40]}...")
                    
            except Exception as e:
                print(f"  ❌ Error: {e}")
                continue
    
    print("✅ BBC sync complete!")

async def sync_all():
    """Sync all sources"""
    print("=" * 50)
    print(f"🕐 Starting sync - {get_date_str()}")
    print("=" * 50)
    
    await sync_bbc()
    # Add more sources here...
    
    print("=" * 50)
    print("✅ All sync complete!")
    print("=" * 50)


# ============================================================
# WEB MONITOR
# ============================================================
def get_articles(limit=20):
    try:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/articles?order=created_at.desc&limit={limit}",
            headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
        )
        return r.json() if r.status_code == 200 else []
    except:
        return []

def get_stats():
    articles = get_articles(100)
    stats = {"total": len(articles), "categories": {}, "sources": {}}
    for a in articles:
        cat = a.get("category", "unknown")
        stats["categories"][cat] = stats["categories"].get(cat, 0) + 1
        author = a.get("author", "unknown")
        stats["sources"][author] = stats["sources"].get(author, 0) + 1
    return stats

HTML = """
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>歪貓娛樂 - Monitor</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f5f5f5; }
        .header { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 20px; text-align: center; }
        .header h1 { font-size: 24px; }
        .container { max-width: 1000px; margin: 0 auto; padding: 20px; }
        .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; }
        .stat { background: white; padding: 20px; border-radius: 10px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .stat h3 { font-size: 14px; color: #666; }
        .stat .value { font-size: 32px; font-weight: bold; color: #667eea; }
        .section { background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .section h2 { font-size: 18px; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
        .article { display: flex; gap: 15px; padding: 15px; border: 1px solid #eee; border-radius: 8px; margin-bottom: 10px; }
        .article img { width: 100px; height: 70px; object-fit: cover; border-radius: 6px; }
        .article-title { font-size: 14px; font-weight: bold; margin-bottom: 5px; }
        .article-meta { font-size: 12px; color: #999; }
        .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; background: #667eea; color: white; margin-right: 10px; }
        .badge.world { background: #667eea; }
        .badge.tech { background: #f093fb; }
        .badge.sports { background: #4facfe; }
        .btn { display: inline-block; padding: 10px 20px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🐱 歪貓娛樂 - 新聞同步監控</h1>
    </div>
    <div class="container">
        <div class="stats">
            <div class="stat"><h3>📰 總文章</h3><div class="value">{{ stats.total }}</div></div>
            <div class="stat"><h3>📂 分類</h3><div class="value">{{ stats.categories|length }}</div></div>
            <div class="stat"><h3>📡 來源</h3><div class="value">{{ stats.sources|length }}</div></div>
        </div>
        <div class="section">
            <h2>📰 最新文章</h2>
            {% for a in articles %}
            <div class="article">
                {% if a.image %}<img src="{{ a.image }}">{% endif %}
                <div>
                    <div class="article-title">{{ a.title[:60] }}...</div>
                    <div class="article-meta">
                        <span class="badge {{ a.category }}">{{ a.category }}</span>
                        <span>{{ a.author }}</span>
                        <span>{{ a.date }}</span>
                    </div>
                </div>
            </div>
            {% endfor %}
        </div>
        <a href="/refresh" class="btn">🔄 刷新</a>
    </div>
</body>
</html>
"""

app = Flask(__name__)

@app.route('/')
def index():
    articles = get_articles(20)
    stats = get_stats()
    return render_template_string(HTML, articles=articles, stats=stats)

@app.route('/api/articles')
def api_articles():
    return jsonify(get_articles(50))

@app.route('/api/stats')
def api_stats():
    return jsonify(get_stats())

@app.route('/refresh')
def refresh():
    return index()


# ============================================================
# MAIN CLI
# ============================================================
async def test_website(url, screenshot=False):
    """Test a website"""
    print(f"🧪 Testing: {url}")
    async with Browser(headless=True) as b:
        await b.goto(url)
        await b.wait(3000)
        print(f"📍 URL: {await b.url()}")
        print(f"📄 Title: {await b.title()}")
        
        if screenshot:
            await b.screenshot("screenshot.png")
            print("📸 Screenshot saved to screenshot.png")
        
        # Show errors
        errors = [m for m in b.console if m['type'] == 'error']
        if errors:
            print(f"⚠️  {len(errors)} errors found")
            for e in errors[:3]:
                print(f"  - {e['text'][:100]}")
        
        return True

def main():
    parser = argparse.ArgumentParser(description="Kimaki News Tools")
    parser.add_argument("--sync", action="store_true", help="Sync all news sources")
    parser.add_argument("--monitor", action="store_true", help="Start web monitor on port 5000")
    parser.add_argument("--test", metavar="URL", help="Test a website")
    parser.add_argument("--screenshot", action="store_true", help="Take screenshot")
    parser.add_argument("--port", type=int, default=5000, help="Port for web monitor")
    
    args = parser.parse_args()
    
    if args.sync:
        asyncio.run(sync_all())
    elif args.monitor:
        print(f"🌐 Starting monitor on http://localhost:{args.port}")
        app.run(host="0.0.0.0", port=args.port)
    elif args.test:
        asyncio.run(test_website(args.test, args.screenshot))
    elif args.screenshot:
        asyncio.run(test_website("https://kimaki.vercel.app", True))
    else:
        parser.print_help()
        print("\nExamples:")
        print("  python kimaki.py --monitor          # Start web monitor")
        print("  python kimaki.py --sync             # Sync news")
        print("  python kimaki.py --test URL         # Test website")
        print("  python kimaki.py --screenshot       # Screenshot kimaki.vercel.app")


if __name__ == "__main__":
    main()
