#!/usr/bin/env python3
"""
Web interface for Kimaki News Sync Monitor
Run with: python web_monitor.py
Access at: http://localhost:5000
"""

import os
import sys
from datetime import datetime
from flask import Flask, render_template_string, jsonify, request

# Supabase config
SUPABASE_URL = "https://sjokgfqpyuzrhuvrnvcz.supabase.co"
SUPABASE_KEY = "sb_publishable_0shlrzPR6MoWE5td6BO3Pg_onhIIWK_"

# Try to import requests
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False


app = Flask(__name__)


def get_articles(limit: int = 20):
    """Get articles from Supabase"""
    if not HAS_REQUESTS:
        return []
    
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/articles?order=created_at.desc&limit={limit}",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}"
            }
        )
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        print(f"Error fetching articles: {e}")
    return []


def get_stats():
    """Get statistics"""
    articles = get_articles(limit=100)
    
    stats = {
        "total": len(articles),
        "categories": {},
        "sources": {},
        "latest": articles[0] if articles else None
    }
    
    for article in articles:
        # Count by category
        cat = article.get("category", "unknown")
        stats["categories"][cat] = stats["categories"].get(cat, 0) + 1
        
        # Count by author/source
        author = article.get("author", "unknown")
        stats["sources"][author] = stats["sources"].get(author, 0) + 1
    
    return stats


HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>歪貓娛樂 - Sync Monitor</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            color: #333;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            text-align: center;
        }
        .header h1 { font-size: 24px; margin-bottom: 5px; }
        .header p { opacity: 0.8; font-size: 14px; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .stat-card h3 { font-size: 14px; color: #666; margin-bottom: 10px; }
        .stat-card .value { font-size: 32px; font-weight: bold; color: #667eea; }
        
        .section {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        .section h2 { font-size: 18px; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee; }
        
        .articles { display: grid; gap: 15px; }
        .article {
            display: flex;
            gap: 15px;
            padding: 15px;
            border: 1px solid #eee;
            border-radius: 8px;
            transition: transform 0.2s;
        }
        .article:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .article img {
            width: 120px;
            height: 80px;
            object-fit: cover;
            border-radius: 6px;
        }
        .article-content { flex: 1; }
        .article-title { font-size: 16px; font-weight: bold; margin-bottom: 5px; }
        .article-title a { color: #333; text-decoration: none; }
        .article-title a:hover { color: #667eea; }
        .article-meta { font-size: 12px; color: #999; }
        .article-meta span { margin-right: 15px; }
        .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 11px;
            background: #667eea;
            color: white;
        }
        .badge.world { background: #667eea; }
        .badge.tech { background: #f093fb; }
        .badge.sports { background: #4facfe; }
        .badge.culture { background: #43e97b; }
        .badge.business { background: #fa709a; }
        .badge.macaodaily { background: #fee140; }
        
        .btn {
            display: inline-block;
            padding: 10px 20px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-size: 14px;
        }
        .btn:hover { background: #5568d3; }
        
        .refresh-time { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🐱 歪貓娛樂 - Sync Monitor</h1>
        <p>新聞同步監控面板</p>
    </div>
    
    <div class="container">
        <div class="stats">
            <div class="stat-card">
                <h3>📰 總文章數</h3>
                <div class="value">{{ stats.total }}</div>
            </div>
            <div class="stat-card">
                <h3>📂 分類數</h3>
                <div class="value">{{ stats.categories|length }}</div>
            </div>
            <div class="stat-card">
                <h3>📡 來源數</h3>
                <div class="value">{{ stats.sources|length }}</div>
            </div>
        </div>
        
        <div class="section">
            <h2>📰 最新文章</h2>
            <div class="articles">
                {% for article in articles %}
                <div class="article">
                    {% if article.image %}
                    <img src="{{ article.image }}" alt="">
                    {% endif %}
                    <div class="article-content">
                        <div class="article-title">
                            <a href="{{ article.url or '#' }}" target="_blank">{{ article.title[:60] }}...</a>
                        </div>
                        <div class="article-meta">
                            <span class="badge {{ article.category }}">{{ article.category }}</span>
                            <span>👤 {{ article.author }}</span>
                            <span>📅 {{ article.date }}</span>
                        </div>
                    </div>
                </div>
                {% endfor %}
            </div>
        </div>
        
        <div class="section">
            <h2>📊 分類統計</h2>
            <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                {% for cat, count in stats.categories.items() %}
                <span class="badge {{ cat }}">{{ cat }}: {{ count }}</span>
                {% endfor %}
            </div>
        </div>
        
        <div class="section">
            <h2>📡 來源統計</h2>
            <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                {% for source, count in stats.sources.items() %}
                <span style="padding: 5px 10px; background: #eee; border-radius: 4px; font-size: 12px;">
                    {{ source }}: {{ count }}
                </span>
                {% endfor %}
            </div>
        </div>
        
        <a href="/refresh" class="btn">🔄 刷新數據</a>
        
        <p class="refresh-time">最後更新: {{ last_update }}</p>
    </div>
</body>
</html>
"""


@app.route('/')
def index():
    """Main page"""
    articles = get_articles(limit=20)
    stats = get_stats()
    last_update = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    return render_template_string(
        HTML_TEMPLATE,
        articles=articles,
        stats=stats,
        last_update=last_update
    )


@app.route('/api/articles')
def api_articles():
    """API endpoint for articles"""
    limit = request.args.get('limit', 20, type=int)
    articles = get_articles(limit=limit)
    return jsonify(articles)


@app.route('/api/stats')
def api_stats():
    """API endpoint for stats"""
    stats = get_stats()
    return jsonify(stats)


@app.route('/refresh')
def refresh():
    """Refresh page"""
    return index()


if __name__ == '__main__':
    print("🌐 Starting Kimaki Monitor...")
    print("📍 Open http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)
