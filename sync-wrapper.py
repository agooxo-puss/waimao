#!/usr/bin/env python3
"""
Macau Daily News Sync Script
每30分鐘自動從澳門日報抓取最新新聞發布到網站
"""
import json
import subprocess
import sys

# 使用 Playwright 通過 subprocess 調用 Node.js 脚本
# 或者直接用 subprocess 调用 playwright cli

def run_sync():
    """執行同步"""
    print("=== 開始同步澳門日報新聞 ===")
    
    # 使用 subprocess 运行 node.js sync 脚本
    result = subprocess.run(
        ["node", "/Users/whypuss/.kimaki/projects/kimaki/waimao/sync-macau.cjs"],
        capture_output=True,
        text=True,
        cwd="/Users/whypuss/.kimaki/projects/kimaki/waimao"
    )
    
    print(result.stdout)
    if result.stderr:
        print("Error:", result.stderr)
    
    return result.returncode

if __name__ == "__main__":
    sys.exit(run_sync())
