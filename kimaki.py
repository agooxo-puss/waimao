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
    "taiwan": "台灣",
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
    """Check if article already exists by exact title match"""
    if not title:
        return False
    try:
        # URL encode the title for the query
        from urllib.parse import quote
        encoded_title = quote(title, safe='')
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/articles?title=eq.{encoded_title}",
            headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
        )
        if r.status_code == 200:
            data = r.json()
            return len(data) > 0
        return False
    except Exception as e:
        print(f"  ⚠️  article_exists error: {e}")
        return False

def cleanup_duplicates():
    """Remove duplicate articles - keep newest, delete older ones"""
    print("🧹 Checking for duplicates...")
    try:
        # Get all articles ordered by created_at
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/articles?select=id,title,created_at&order=created_at.desc",
            headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
        )
        if r.status_code != 200:
            print("  ❌ Failed to fetch articles")
            return 0
        
        articles = r.json()
        seen_titles = {}
        delete_ids = []
        
        # Find duplicates - keep newest
        for a in articles:
            title = a.get('title', '')
            if not title:
                continue
            if title in seen_titles:
                # This is a duplicate, mark for deletion
                delete_ids.append(a['id'])
            else:
                seen_titles[title] = a['id']
        
        # Delete duplicates
        deleted = 0
        for aid in delete_ids:
            try:
                dr = requests.delete(
                    f"{SUPABASE_URL}/rest/v1/articles?id=eq.{aid}",
                    headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
                )
                if dr.status_code in [200, 204]:
                    deleted += 1
            except:
                pass
        
        if deleted > 0:
            print(f"  ✅ Deleted {deleted} duplicate articles")
        return deleted
    except Exception as e:
        print(f"  ❌ Cleanup error: {e}")
        return 0

def repair_articles():
    """Repair articles with missing title, content, or image"""
    print("🔧 Repairing articles with missing data...")
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    repaired = 0
    
    try:
        # Get articles that need repair (no image, no content, or no url)
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/articles?select=*&order=created_at.desc&limit=100",
            headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
        )
        if r.status_code != 200:
            print("  ❌ Failed to fetch articles")
            return 0
        
        articles = r.json()
        
        for a in articles:
            needs_update = False
            update_data = {}
            aid = a.get('id')
            title = a.get('title', '')
            
            # Check if image is missing or invalid
            image = a.get('image')
            if not image or image == 'None' or image == '':
                print(f"  🔍 Article {aid}: Missing image - trying to fix...")
                
                # Try to find the article URL based on source
                source = a.get('author', '')
                url = a.get('url', '')
                
                # If no URL, try to search for the article
                if not url or url == '':
                    # Use title to search
                    try:
                        search_url = f"https://www.bing.com/search?q={requests.utils.quote(title)}"
                        search_resp = requests.get(search_url, headers=headers, timeout=10)
                        
                        # Find ltn.com.tw links
                        ltn_match = re.search(r'https://news\.ltn\.com\.tw/[^"\s]+', search_resp.text)
                        if ltn_match:
                            url = ltn_match.group(0)
                            update_data['url'] = url
                            needs_update = True
                    except:
                        pass
                
                # If we have URL, try to get image
                if url:
                    try:
                        resp = requests.get(url, headers=headers, timeout=10)
                        resp.encoding = 'utf-8'
                        html = resp.text
                        
                        # Extract og:image
                        og_match = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']', html)
                        if not og_match:
                            og_match = re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']', html)
                        if og_match:
                            image = og_match.group(1)
                            update_data['image'] = image
                            needs_update = True
                            print(f"    ✅ Found image: {image[:40]}...")
                        
                        # Also try to get content if missing
                        content = a.get('content', '')
                        if not content or len(content) < 50:
                            from bs4 import BeautifulSoup
                            soup = BeautifulSoup(html, 'lxml')
                            article_elem = (
                                soup.find('article') or 
                                soup.find(class_='content940') or
                                soup.find(class_=re.compile('content', re.I))
                            )
                            if article_elem:
                                content_text = article_elem.get_text(strip=True)
                                content_text = re.sub(r'限制級您即將進入之新聞內容需滿18歲.*?我同意', '', content_text)
                                if content_text and len(content_text) > 50:
                                    update_data['content'] = content_text[:50000]
                                    needs_update = True
                                    print(f"    ✅ Found content: {len(content_text)} chars")
                    except Exception as e:
                        print(f"    ❌ Error: {e}")
                
                # Last resort: use Bing Image Search
                if not image or image == 'None':
                    try:
                        search_url = f"https://www.bing.com/images/search?q={requests.utils.quote(title)}&first=1"
                        search_resp = requests.get(search_url, headers=headers, timeout=10)
                        bing_match = re.search(r'mediaurl=([^&"]+)', search_resp.text)
                        if bing_match:
                            image = requests.utils.unquote(bing_match.group(1))
                            update_data['image'] = image
                            needs_update = True
                            print(f"    ✅ Bing fallback image: {image[:40]}...")
                    except:
                        pass
            
            # Update if needed
            if needs_update and update_data:
                try:
                    ur = requests.patch(
                        f"{SUPABASE_URL}/rest/v1/articles?id=eq.{aid}",
                        json=update_data,
                        headers={
                            "apikey": SUPABASE_KEY, 
                            "Authorization": f"Bearer {SUPABASE_KEY}",
                            "Content-Type": "application/json"
                        }
                    )
                    if ur.status_code in [200, 204]:
                        repaired += 1
                        print(f"    ✅ Repaired article {aid}")
                except Exception as e:
                    print(f"    ❌ Update error: {e}")
        
        print(f"  ✅ Repaired {repaired} articles")
        return repaired
    except Exception as e:
        print(f"  ❌ Repair error: {e}")
        return 0

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
                try:
                    image = await b.eval("document.querySelector('meta[property=og:image]')?.content || document.querySelector('meta[name=image]')?.content || ''")
                except:
                    image = ""
                image = image or ""
                
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
                elif "culture" in link or "taiwan" in link:
                    category = "taiwan"
                
                if save_article(title, excerpt, content, category, "BBC中文", image):
                    print(f"  ✅ Saved: {title[:40]}...")
                else:
                    print(f"  ❌ Failed: {title[:40]}...")
                    
            except Exception as e:
                print(f"  ❌ Error: {e}")
                continue
    
    print("✅ BBC sync complete!")

async def sync_tvbs():
    """Sync Taiwan news from setn.com (三立新聞)"""
    print("📺 Syncing Taiwan news (三立新聞)...")
    
    async with Browser(headless=True) as b:
        # Setn (三立新聞) - main page
        await b.goto("https://www.setn.com")
        await b.wait(5000)  # Wait longer for dynamic content
        
        html = await b.content()
        
        import re
        
        # Find news links - handle HTML entities
        links = re.findall(r'href="(https?://www\.setn\.com/[^"]+)"', html)
        # Clean HTML entities
        links = [l.replace('&amp;', '&') for l in links]
        links = list(set([l for l in links if ('news' in l.lower() or 'viewall' in l.lower() or 'article' in l.lower()) and 'category' not in l.lower() and 'tag' not in l.lower()]))[:10]
        
        print(f"  Found {len(links)} potential articles")
        
        for i, link in enumerate(links):
            try:
                await b.goto(link)
                await b.wait(3000)  # Wait for article to load
                
                # Get title - try multiple selectors
                title = ""
                for sel in ["h1", ".title", ".news-title", "title"]:
                    try:
                        title = await b.eval(f"document.querySelector('{sel}')?.textContent")
                    except:
                        pass
                    if title and len(title or "") > 5:
                        break
                
                title = (title or "").strip()
                if not title or len(title) < 5:
                    print(f"  ⏭️  Skip (no title): {link[:50]}...")
                    continue
                
                # Check if exists
                if article_exists(title):
                    print(f"  ⏭️  Skip: {title[:40]}...")
                    continue
                
                # Get content
                try:
                    content = await b.eval("document.querySelector('article')?.innerHTML || document.querySelector('.content')?.innerHTML || ''")
                except:
                    content = ""
                content = clean_html(content)
                
                # Get image
                try:
                    image = await b.eval("document.querySelector('meta[property=og:image]')?.content || document.querySelector('meta[name=image]')?.content || ''")
                except:
                    image = ""
                
                # Get excerpt
                try:
                    excerpt = await b.eval("document.querySelector('meta[name=description]')?.content || ''")
                except:
                    excerpt = ""
                
                if not excerpt and content:
                    try:
                        from bs4 import BeautifulSoup
                        excerpt = BeautifulSoup(content, 'lxml').get_text()[:200]
                    except:
                        excerpt = content[:200]
                
                # Category is taiwan by default
                category = "taiwan"
                link_lower = link.lower()
                if any(x in link_lower for x in ['tech', '3c', 'digital']):
                    category = "tech"
                elif any(x in link_lower for x in ['sport', 'nba', '足球', '籃球']):
                    category = "sports"
                
                if save_article(title, excerpt, content, category, "三立新聞", image):
                    print(f"  ✅ Saved: {title[:40]}...")
                else:
                    print(f"  ❌ Failed: {title[:40]}...")
                    
            except Exception as e:
                print(f"  ❌ Error: {e}")
                continue
    
    print("✅ Taiwan news sync complete!")

async def sync_ftv():
    """Sync Taiwan news from 自由時報 (Liberty Times) via RSS"""
    print("📺 Syncing 自由時報 (Liberty Times)...")
    
    rss_urls = [
        ("https://news.ltn.com.tw/rss/all.xml", "taiwan"),
        ("https://news.ltn.com.tw/rss/politics.xml", "taiwan"),
        ("https://news.ltn.com.tw/rss/society.xml", "taiwan"),
        ("https://news.ltn.com.tw/rss/world.xml", "world"),
        ("https://news.ltn.com.tw/rss/sports.xml", "sports"),
    ]
    
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    
    for rss_url, category in rss_urls:
        try:
            print(f"  📡 Fetching {rss_url}...")
            resp = requests.get(rss_url, timeout=10, headers=headers)
            resp.encoding = 'utf-8'
            xml = resp.text
            
            # Parse RSS items
            items = re.findall(r'<item>(.*?)</item>', xml, re.DOTALL)
            print(f"     Found {len(items)} items")
            
            for item in items[:8]:  # Limit 8 per feed
                try:
                    # Extract title
                    title_match = re.search(r'<title><!\[CDATA\[(.*?)\]\]></title>|<title>(.*?)</title>', item)
                    title = ""
                    if title_match:
                        title = (title_match.group(1) or title_match.group(2) or "").strip()

                    if not title or len(title) < 5:
                        continue

                    # Check if exists
                    if article_exists(title):
                        continue

                    # Extract link
                    link_match = re.search(r'<link>(.*?)</link>', item)
                    link = link_match.group(1).strip() if link_match else ""

                    # Extract description
                    desc_match = re.search(r'<description><!\[CDATA\[(.*?)\]\]></description>|<description>(.*?)</description>', item)
                    excerpt = ""
                    if desc_match:
                        excerpt = (desc_match.group(1) or desc_match.group(2) or "").strip()
                    excerpt = re.sub(r'<[^>]+>', '', excerpt)[:200]

                    # Extract image from RSS - try multiple methods
                    img_match = re.search(r'<media:content.*?url="([^"]+)"', item)
                    if not img_match:
                        img_match = re.search(r'<enclosure.*?url="([^"]+)"', item)
                    image = img_match.group(1) if img_match else ""
                    
                    # ALWAYS visit article to get og:image and full content
                    content = excerpt
                    if link:
                        try:
                            article_resp = requests.get(link, headers=headers, timeout=10)
                            article_resp.encoding = 'utf-8'
                            html = article_resp.text
                            
                            # Method 1: Extract og:image from website
                            og_match = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']', html)
                            if not og_match:
                                og_match = re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']', html)
                            if og_match:
                                image = og_match.group(1)
                            
                            # Method 2: Try twitter:image as fallback
                            if not image:
                                twitter_match = re.search(r'<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)["\']', html)
                                if not twitter_match:
                                    twitter_match = re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']twitter:image["\']', html)
                                if twitter_match:
                                    image = twitter_match.group(1)
                            
                            # Extract full article content - try multiple selectors
                            from bs4 import BeautifulSoup
                            soup = BeautifulSoup(html, 'lxml')
                            article_elem = (
                                soup.find('article') or 
                                soup.find(class_='content940') or
                                soup.find(class_=re.compile('content', re.I)) or
                                soup.find(id=re.compile('content', re.I))
                            )
                            if article_elem:
                                content_text = article_elem.get_text(strip=True)
                                # Clean up the content - remove age restriction warning
                                content_text = re.sub(r'限制級您即將進入之新聞內容需滿18歲.*?我同意', '', content_text)
                                if content_text and len(content_text) > 50:
                                    content = content_text
                        except Exception as e:
                            pass
                    
                    # ========== VALIDATION RULES ==========
                    
                    # Rule 1: Must have title (minimum 5 characters)
                    if not title or len(title) < 5:
                        print(f"    ⏭️  Skip (no valid title): {str(title)[:30]}...")
                        continue
                    
                    # Rule 2: Must have content (minimum 50 characters)
                    if not content or len(content) < 50:
                        # Try to expand from excerpt
                        if excerpt and len(excerpt) >= 50:
                            content = excerpt
                        else:
                            print(f"    ⏭️  Skip (no content): {title[:30]}...")
                            continue
                    
                    # Rule 3: Must have image
                    if not image:
                        # Fallback: Use Bing Image Search to find related image
                        try:
                            search_url = f"https://www.bing.com/images/search?q={requests.utils.quote(title)}&first=1"
                            search_resp = requests.get(search_url, headers=headers, timeout=10)
                            bing_match = re.search(r'mediaurl=([^&"]+)', search_resp.text)
                            if bing_match:
                                image = bing_match.group(1)
                                # Clean up the URL
                                image = requests.utils.unquote(image)
                        except:
                            pass
                    
                    # Final check: Skip if still no image
                    if not image:
                        print(f"    ⏭️  Skip (no image): {title[:30]}...")
                        continue
                    
                    # Override category based on URL/feed
                    cat = category
                    if 'sports' in rss_url:
                        cat = "sports"
                    elif 'world' in rss_url:
                        cat = "world"
                    
                    if save_article(title, excerpt, content, cat, "自由時報", image):
                        print(f"    ✅ {title[:40]}...")
                except Exception as e:
                    print(f"    ❌ Error: {e}")
                    continue

        except Exception as e:
            print(f"  ❌ RSS error: {e}")
            continue
    
    print("✅ 自由時報 sync complete!")

async def sync_all():
    """Sync all sources"""
    print("=" * 50)
    print(f"🕐 Starting sync - {get_date_str()}")
    print("=" * 50)
    
    # Repair articles with missing data BEFORE syncing
    repair_articles()
    
    # Clean duplicates before syncing
    cleanup_duplicates()
    
    await sync_bbc()
    await sync_tvbs()
    await sync_ftv()
    # Add more sources here...
    
    # Clean duplicates after syncing
    cleanup_duplicates()
    
    # Final repair check after syncing
    repair_articles()
    
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
    <title>歪貓娛樂 - 管理面板</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f5f5f5; }
        .header { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 20px; }
        .header h1 { font-size: 24px; }
        .header p { opacity: 0.8; font-size: 14px; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        
        .actions { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
        .btn { 
            padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; 
            font-size: 14px; font-weight: 500; transition: transform 0.2s, box-shadow 0.2s;
        }
        .btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
        .btn-primary { background: #667eea; color: white; }
        .btn-success { background: #43e97b; color: white; }
        .btn-danger { background: #fa709a; color: white; }
        .btn-info { background: #4facfe; color: white; }
        .btn-warning { background: #fee140; color: #333; }
        
        .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; }
        .stat { background: white; padding: 20px; border-radius: 10px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .stat h3 { font-size: 14px; color: #666; }
        .stat .value { font-size: 32px; font-weight: bold; color: #667eea; }
        
        .section { background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .section h2 { font-size: 18px; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
        
        .article { display: flex; gap: 15px; padding: 15px; border: 1px solid #eee; border-radius: 8px; margin-bottom: 10px; }
        .article:hover { background: #fafafa; }
        .article img { width: 100px; height: 70px; object-fit: cover; border-radius: 6px; }
        .article-content { flex: 1; }
        .article-title { font-size: 14px; font-weight: bold; margin-bottom: 5px; }
        .article-meta { font-size: 12px; color: #999; }
        .article-actions { display: flex; gap: 5px; }
        .btn-sm { padding: 5px 10px; font-size: 12px; border-radius: 4px; cursor: pointer; }
        
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: 500; }
        .form-group input, .form-group textarea, .form-group select { 
            width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; 
        }
        .form-group textarea { min-height: 100px; }
        
        .modal { 
            display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
            background: rgba(0,0,0,0.5); z-index: 1000; 
        }
        .modal.active { display: flex; align-items: center; justify-content: center; }
        .modal-content { 
            background: white; padding: 30px; border-radius: 12px; max-width: 600px; width: 90%; 
            max-height: 90vh; overflow-y: auto;
        }
        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .modal-close { background: none; border: none; font-size: 24px; cursor: pointer; }
        
        .tab-buttons { display: flex; gap: 10px; margin-bottom: 20px; }
        .tab-btn { padding: 10px 20px; border: none; background: #eee; border-radius: 6px; cursor: pointer; }
        .tab-btn.active { background: #667eea; color: white; }
        
        .log-box { 
            background: #1e1e1e; color: #0f0; padding: 15px; border-radius: 8px; 
            font-family: monospace; font-size: 12px; max-height: 300px; overflow-y: auto;
        }
        
        .loading { text-align: center; padding: 40px; color: #666; }
        
        .test-form { display: flex; gap: 10px; }
        .test-form input { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 6px; }
        
        @media (max-width: 768px) {
            .stats { grid-template-columns: 1fr; }
            .actions { flex-direction: column; }
            .article { flex-direction: column; }
            .article img { width: 100%; height: 150px; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🐱 歪貓娛樂 - 管理面板</h1>
        <p>Kimaki News Admin Panel</p>
    </div>
    
    <div class="container">
        <!-- Actions -->
        <div class="actions">
            <button class="btn btn-primary" onclick="showTab('articles')">📰 文章管理</button>
            <button class="btn btn-success" onclick="runSync()">🔄 立即同步</button>
            <button class="btn btn-warning" onclick="runCleanup()">🧹 清理重複</button>
            <button class="btn btn-info" onclick="showTab('add')">➕ 發布文章</button>
            <button class="btn btn-warning" onclick="showTab('test')">🧪 測試網站</button>
            <button class="btn btn-info" onclick="showTab('logs')">📋 日誌</button>
        </div>
        
        <!-- Stats -->
        <div class="stats">
            <div class="stat"><h3>📰 總文章</h3><div class="value" id="total">{{ stats.total }}</div></div>
            <div class="stat"><h3>📂 分類</h3><div class="value">{{ stats.categories|length }}</div></div>
            <div class="stat"><h3>📡 來源</h3><div class="value">{{ stats.sources|length }}</div></div>
        </div>
        
        <!-- Articles Tab -->
        <div id="tab-articles" class="section">
            <h2>📰 文章列表 <button class="btn-sm" onclick="loadArticles()">🔄 刷新</button></h2>
            <div id="articles-list">
                {% for a in articles %}
                <div class="article" data-id="{{ a.id }}">
                    {% if a.image %}<img src="{{ a.image }}">{% endif %}
                    <div class="article-content">
                        <div class="article-title">{{ a.title[:60] }}...</div>
                        <div class="article-meta">
                            <span class="badge {{ a.category }}">{{ a.category }}</span>
                            <span>{{ a.author }}</span>
                            <span>{{ a.date }}</span>
                        </div>
                    </div>
                    <div class="article-actions">
                        <button class="btn-sm btn-danger" onclick="deleteArticle({{ a.id }})">🗑️</button>
                    </div>
                </div>
                {% endfor %}
            </div>
        </div>
        
        <!-- Add Article Tab -->
        <div id="tab-add" class="section" style="display:none;">
            <h2>➕ 發布文章</h2>
            <form id="add-form" onsubmit="submitArticle(event)">
                <div class="form-group">
                    <label>標題 *</label>
                    <input type="text" name="title" required placeholder="輸入文章標題">
                </div>
                <div class="form-group">
                    <label>摘要</label>
                    <textarea name="excerpt" placeholder="輸入文章摘要"></textarea>
                </div>
                <div class="form-group">
                    <label>內容 (HTML)</label>
                    <textarea name="content" placeholder="<p>文章內容...</p>"></textarea>
                </div>
                <div class="form-group">
                    <label>分類</label>
                    <select name="category">
                        <option value="world">國際</option>
                        <option value="tech">科技</option>
                        <option value="sports">體育</option>
                        <option value="taiwan">台灣</option>
                        <option value="business">香港</option>
                        <option value="macaodaily">澳門</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>作者</label>
                    <input type="text" name="author" placeholder="作者名稱">
                </div>
                <div class="form-group">
                    <label>圖片 URL</label>
                    <input type="text" name="image" placeholder="https://...">
                </div>
                <button type="submit" class="btn btn-success">🚀 發布文章</button>
            </form>
        </div>
        
        <!-- Test Tab -->
        <div id="tab-test" class="section" style="display:none;">
            <h2>🧪 測試網站</h2>
            <div class="test-form">
                <input type="text" id="test-url" placeholder="輸入網址..." value="https://kimaki.vercel.app">
                <button class="btn btn-info" onclick="testWebsite()">測試</button>
            </div>
            <div id="test-result" style="margin-top: 20px;"></div>
        </div>
        
        <!-- Logs Tab -->
        <div id="tab-logs" class="section" style="display:none;">
            <h2>📋 操作日誌</h2>
            <div class="log-box" id="log-box">
                {% for log in logs %}
                {{ log }}<br>
                {% endfor %}
            </div>
        </div>
    </div>
    
    <script>
        let logs = {{ logs|tojson }};
        
        function showTab(tab) {
            document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
            document.getElementById('tab-' + tab).style.display = 'block';
        }
        
        function addLog(msg) {
            const time = new Date().toLocaleTimeString();
            logs.push('[' + time + '] ' + msg);
            if (logs.length > 100) logs.shift();
            document.getElementById('log-box').innerHTML = logs.join('<br>');
        }
        
        async function runSync() {
            addLog('🔄 開始同步新聞...');
            try {
                const res = await fetch('/api/sync');
                const data = await res.json();
                addLog('✅ 同步完成: ' + data.message);
                loadArticles();
            } catch(e) {
                addLog('❌ 同步失敗: ' + e);
            }
        }
        
        async function runCleanup() {
            if (!confirm('確定要清理重複文章？')) return;
            addLog('🧹 開始清理重複文章...');
            try {
                const res = await fetch('/api/cleanup');
                const data = await res.json();
                addLog('✅ 清理完成，刪除 ' + data.deleted + ' 篇');
                loadArticles();
            } catch(e) {
                addLog('❌ 清理失敗: ' + e);
            }
        }
        
        async function loadArticles() {
            const res = await fetch('/api/articles');
            const articles = await res.json();
            let html = '';
            articles.forEach(a => {
                html += '<div class="article"><div class="article-content"><div class="article-title">' + a.title.substring(0,60) + '...</div><div class="article-meta"><span>' + a.category + '</span> <span>' + a.author + '</span> <span>' + a.date + '</span></div></div><button class="btn-sm btn-danger" onclick="deleteArticle(' + a.id + ')">🗑️</button></div>';
            });
            document.getElementById('articles-list').innerHTML = html;
            document.getElementById('total').textContent = articles.length;
        }
        
        async function deleteArticle(id) {
            if (!confirm('確定要刪除呢篇文章？')) return;
            addLog('🗑️ 刪除文章 ' + id);
            try {
                await fetch('/api/article/' + id, { method: 'DELETE' });
                addLog('✅ 刪除成功');
                loadArticles();
            } catch(e) {
                addLog('❌ 刪除失敗: ' + e);
            }
        }
        
        async function submitArticle(e) {
            e.preventDefault();
            const form = e.target;
            const data = {
                title: form.title.value,
                excerpt: form.excerpt.value,
                content: form.content.value,
                category: form.category.value,
                author: form.author.value || '歪貓編輯',
                image: form.image.value || null
            };
            addLog('📝 發布文章: ' + data.title);
            try {
                const res = await fetch('/api/article', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(data)
                });
                addLog('✅ 發布成功');
                form.reset();
                loadArticles();
            } catch(e) {
                addLog('❌ 發布失敗: ' + e);
            }
        }
        
        async function testWebsite() {
            const url = document.getElementById('test-url').value;
            addLog('🧪 測試網站: ' + url);
            try {
                const res = await fetch('/api/test?url=' + encodeURIComponent(url));
                const data = await res.json();
                addLog('📄 Title: ' + data.title);
                addLog('📍 URL: ' + data.url);
                addLog('✅ 測試成功');
                document.getElementById('test-result').innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
            } catch(e) {
                addLog('❌ 測試失敗: ' + e);
            }
        }
    </script>
</body>
</html>
"""

app = Flask(__name__)

# In-memory logs
logs = ["[" + datetime.now().strftime("%H:%M:%S") + "] 系統啟動"]

def add_log(msg):
    logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")
    if len(logs) > 100:
        logs.pop(0)

@app.route('/')
def index():
    articles = get_articles(50)
    stats = get_stats()
    return render_template_string(HTML, articles=articles, stats=stats, logs=logs)

@app.route('/api/articles')
def api_articles():
    return jsonify(get_articles(50))

@app.route('/api/stats')
def api_stats():
    return jsonify(get_stats())

@app.route('/api/sync')
def api_sync():
    """Trigger sync"""
    add_log("🔄 開始同步新聞...")
    # In a real implementation, this would run the sync
    # For now, just return a message
    add_log("✅ 同步完成 (mock)")
    return jsonify({"status": "ok", "message": "Sync completed"})

@app.route('/api/cleanup')
def api_cleanup():
    """Clean up duplicates"""
    add_log("🧹 開始清理重複文章...")
    deleted = cleanup_duplicates()
    add_log(f"✅ 清理完成，刪除 {deleted} 篇重複文章")
    return jsonify({"status": "ok", "deleted": deleted})

@app.route('/api/article', methods=['POST'])
def api_add_article():
    """Add new article"""
    data = request.json
    title = data.get('title', '')
    excerpt = data.get('excerpt', '')
    content = data.get('content', '')
    category = data.get('category', 'world')
    author = data.get('author', '歪貓編輯')
    image = data.get('image')
    
    date_str = f"{datetime.now().year}年{datetime.now().month}月{datetime.now().day}日"
    
    try:
        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/articles",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "title": title[:500],
                "excerpt": excerpt[:1000],
                "content": content[:50000],
                "category": category,
                "author": author,
                "date": date_str,
                "image": image
            }
        )
        if r.status_code in [200, 201]:
            add_log(f"✅ 新增文章: {title[:30]}...")
            return jsonify({"status": "ok"})
        else:
            add_log(f"❌ 新增失敗: {r.status_code}")
            return jsonify({"status": "error", "message": r.text}), 400
    except Exception as e:
        add_log(f"❌ 新增錯誤: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/article/<int:article_id>', methods=['DELETE'])
def api_delete_article(article_id):
    """Delete article"""
    try:
        r = requests.delete(
            f"{SUPABASE_URL}/rest/v1/articles?id=eq.{article_id}",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}"
            }
        )
        if r.status_code in [200, 204]:
            add_log(f"🗑️ 刪除文章 ID: {article_id}")
            return jsonify({"status": "ok"})
        else:
            add_log(f"❌ 刪除失敗: {r.status_code}")
            return jsonify({"status": "error"}), 400
    except Exception as e:
        add_log(f"❌ 刪除錯誤: {e}")
        return jsonify({"status": "error"}), 500

@app.route('/api/test')
def api_test():
    """Test a website"""
    url = request.args.get('url', 'https://example.com')
    add_log(f"🧪 測試網站: {url}")
    
    async def run_test():
        async with Browser(headless=True) as b:
            await b.goto(url)
            await b.wait(3000)
            return {
                "url": await b.url(),
                "title": await b.title(),
                "console_count": len(b.console),
                "errors": len([m for m in b.console if m['type'] == 'error'])
            }
    
    result = asyncio.run(run_test())
    add_log(f"✅ 測試完成: {result['title']}")
    return jsonify(result)

@app.route('/refresh')
def refresh():
    add_log("🔄 頁面刷新")
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
    parser.add_argument("--repair", action="store_true", help="Repair articles with missing data")
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
    elif args.repair:
        repair_articles()
    else:
        parser.print_help()
        print("\nExamples:")
        print("  python kimaki.py --monitor          # Start web monitor")
        print("  python kimaki.py --sync             # Sync news")
        print("  python kimaki.py --repair           # Repair missing images/content")
        print("  python kimaki.py --test URL         # Test website")
        print("  python kimaki.py --screenshot       # Screenshot kimaki.vercel.app")


if __name__ == "__main__":
    main()
