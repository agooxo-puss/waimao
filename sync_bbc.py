#!/usr/bin/env python3
"""
Sync BBC Chinese news to Supabase
"""

import asyncio
import os
import re
import json
from datetime import datetime
from puss import Puss

# Supabase configuration
SUPABASE_URL = "https://sjokgfqpyuzrhuvrnvcz.supabase.co"
SUPABASE_KEY = "sb_publishable_0shlrzPR6MoWE5td6BO3Pg_onhIIWK_"

# Categories mapping
CATEGORY_MAP = {
    "world": "world",
    "tech": "tech", 
    "science": "tech",
    "business": "business",
    "culture": "culture"
}


def clean_content(html: str) -> str:
    """Clean HTML content - remove ads, related articles, etc."""
    if not html:
        return ""
    
    # Remove script tags
    html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
    # Remove style tags
    html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL | re.IGNORECASE)
    # Remove nav/footer
    html = re.sub(r'<(nav|footer|header|aside)[^>]*>.*?</\1>', '', html, flags=re.DOTALL | re.IGNORECASE)
    # Remove related articles section
    html = re.sub(r'<h[3-6][^>]*>.*?(相關文章|延伸閱讀|延伸報導).*?</h[3-6]>', '', html, flags=re.DOTALL | re.IGNORECASE)
    # Remove share buttons
    html = re.sub(r'<div[^>]*class="[^"]*(share|social)[^"]*"[^>]*>.*?</div>', '', html, flags=re.DOTALL | re.IGNORECASE)
    # Remove ads
    html = re.sub(r'<div[^>]*class="[^"]*(ad|advertisement|sponsor)[^"]*"[^>]*>.*?</div>', '', html, flags=re.DOTALL | re.IGNORECASE)
    # Clean up empty paragraphs
    html = re.sub(r'<p>\s*</p>', '', html)
    # Remove copyright notices
    html = re.sub(r'©.*?BBC.*?鐘.*?|版權所有.*?BBC.*?中文', '', html, flags=re.DOTALL | re.IGNORECASE)
    
    return html


def get_date_str() -> str:
    """Get current date string"""
    today = datetime.now()
    return f"{today.year}年{today.month}月{today.day}日"


async def get_bing_image(keywords: str) -> str:
    """Get relevant image from Bing"""
    # In production, use Bing Search API
    # For now, return a placeholder
    search_url = f"https://www.bing.com/images/search?q={keywords}"
    return ""


async def sync_bbc():
    """Sync BBC Chinese news"""
    print("🔄 Starting BBC Chinese sync...")
    
    async with Puss(headless=True) as puss:
        # BBC Chinese main page
        await puss.goto("https://www.bbc.com/zhongwen/simp")
        await puss.wait_for_timeout(3000)
        
        # Get article links from main page
        articles = []
        
        # Try different selectors for BBC Chinese
        selectors = [
            "article a",
            ".article-card a",
            ".media-list a",
            "main a[href*='/articles/']"
        ]
        
        for selector in selectors:
            try:
                elements = await puss.page.query_selector_all(selector)
                for elem in elements[:20]:
                    href = await elem.get_attribute("href")
                    if href and "/articles/" in href:
                        full_url = urljoin("https://www.bbc.com", href)
                        if full_url not in [a.get("url") for a in articles]:
                            articles.append({"url": full_url})
            except Exception as e:
                print(f"Selector {selector} failed: {e}")
                continue
        
        print(f"📰 Found {len(articles)} articles")
        
        # Process each article
        for i, article in enumerate(articles[:10]):  # Limit to 10
            try:
                print(f"  Processing article {i+1}/10...")
                await puss.goto(article["url"])
                await puss.wait_for_timeout(2000)
                
                # Extract title
                title = ""
                for selector in ["h1", "[itemprop='headline']", ".article-title"]:
                    try:
                        title = await puss.inner_text(selector)
                        if title:
                            break
                    except:
                        continue
                
                if not title:
                    continue
                
                # Extract content
                content = ""
                for selector in ["article", "[itemprop='articleBody']", ".article-body"]:
                    try:
                        content = await puss.inner_html(selector)
                        if content and len(content) > 200:
                            break
                    except:
                        continue
                
                content = clean_content(content)
                
                # Extract image
                image = ""
                for selector in ["meta[property='og:image']", "article img", ".article-hero img"]:
                    try:
                        if selector.startswith("meta"):
                            image = await puss.page.evaluate(f'document.querySelector("{selector}")?.content')
                        else:
                            image = await puss.page.query_selector(selector)
                            if image:
                                image = await image.get_attribute("src")
                        if image:
                            break
                    except:
                        continue
                
                # Extract excerpt/description
                excerpt = ""
                for selector in ["meta[name='description']", "meta[property='og:description']"]:
                    try:
                        excerpt = await puss.page.evaluate(f'document.querySelector("{selector}")?.content')
                        if excerpt:
                            break
                    except:
                        continue
                
                if not excerpt and content:
                    # Create excerpt from content
                    text = re.sub(r'<[^>]+>', '', content)[:200]
                    excerpt = text
                
                # Determine category
                category = "world"
                url_lower = article["url"].lower()
                if "tech" in url_lower or "science" in url_lower:
                    category = "tech"
                elif "business" in url_lower:
                    category = "business"
                elif "culture" in url_lower or "art" in url_lower:
                    category = "culture"
                
                # Save to Supabase
                article_data = {
                    "title": title,
                    "excerpt": excerpt,
                    "content": content,
                    "category": category,
                    "author": "BBC中文",
                    "date": get_date_str(),
                    "image": image if image else None
                }
                
                # Check if article exists (by title)
                check_res = requests.get(
                    f"{SUPABASE_URL}/rest/v1/articles?title=eq.{title}",
                    headers={
                        "apikey": SUPABASE_KEY,
                        "Authorization": f"Bearer {SUPABASE_KEY}"
                    }
                )
                
                existing = check_res.json()
                if not existing:
                    # Insert new article
                    post_res = requests.post(
                        f"{SUPABASE_URL}/rest/v1/articles",
                        headers={
                            "apikey": SUPABASE_KEY,
                            "Authorization": f"Bearer {SUPABASE_KEY}",
                            "Content-Type": "application/json",
                            "Prefer": "return=minimal"
                        },
                        json=article_data
                    )
                    if post_res.status_code in [200, 201]:
                        print(f"    ✅ Added: {title[:50]}...")
                    else:
                        print(f"    ❌ Failed: {post_res.status_code}")
                else:
                    print(f"    ⏭️  Skipped (exists): {title[:50]}...")
                    
            except Exception as e:
                print(f"    ❌ Error: {e}")
                continue
    
    print("✅ BBC sync complete!")


if __name__ == "__main__":
    import requests
    asyncio.run(sync_bbc())
