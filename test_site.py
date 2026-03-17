#!/usr/bin/env python3
"""
Test script - similar to Playwright CLI functionality
Usage:
    python test_site.py                    # Test default URL
    python test_site.py --url URL          # Test specific URL
    python test_site.py --screenshot       # Take screenshot
    python test_site.py --console         # Show console logs
    python test_site.py --network          # Show network requests
"""

import asyncio
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from puss import Puss


async def test_site(url: str, screenshot: bool = False, console: bool = False, network: bool = False):
    """Test a website"""
    print(f"🧪 Testing: {url}")
    print("-" * 50)
    
    async with Puss(headless=True) as puss:
        # Navigate
        await puss.goto(url)
        await puss.wait_for_timeout(3000)
        
        # Get page info
        print(f"📍 URL: {await puss.url()}")
        print(f"📄 Title: {await puss.title()}")
        
        # Console messages
        if console:
            print("\n📝 Console messages:")
            for msg in puss.console_messages:
                print(f"  [{msg.type}] {msg.text}")
        
        # Network requests
        if network:
            print("\n🌐 Network requests:")
            for req in puss.requests[:20]:  # Show first 20
                print(f"  {req.method} {req.url[:80]}")
        
        # Screenshot
        if screenshot:
            await puss.screenshot("test_screenshot.png")
            print(f"\n📸 Screenshot saved to test_screenshot.png")
        
        # Check if page loaded
        html = await puss.content()
        if len(html) > 100:
            print("\n✅ Page loaded successfully!")
            return True
        else:
            print("\n❌ Page may not have loaded correctly")
            return False


async def monitor_site(url: str, interval: int = 60):
    """Monitor a site continuously"""
    print(f"🔄 Monitoring {url} every {interval} seconds...")
    print("Press Ctrl+C to stop\n")
    
    count = 0
    while True:
        count += 1
        print(f"\n--- Check #{count} ---")
        
        async with Puss(headless=True) as puss:
            await puss.goto(url)
            await puss.wait_for_timeout(2000)
            
            # Check for errors in console
            errors = [m for m in puss.console_messages if m.type == "error"]
            
            if errors:
                print(f"⚠️  {len(errors)} errors found:")
                for e in errors[:5]:
                    print(f"  - {e.text}")
            else:
                print("✅ No errors")
            
            # Check response status
            if puss.responses:
                status_codes = [r.status for r in puss.responses[:10]]
                print(f"📊 Response statuses: {status_codes}")
        
        await asyncio.sleep(interval)


def main():
    parser = argparse.ArgumentParser(description="Test websites like Playwright")
    parser.add_argument("--url", "-u", default="https://kimaki.vercel.app", help="URL to test")
    parser.add_argument("--screenshot", "-s", action="store_true", help="Take screenshot")
    parser.add_argument("--console", "-c", action="store_true", help="Show console messages")
    parser.add_argument("--network", "-n", action="store_true", help="Show network requests")
    parser.add_argument("--monitor", "-m", type=int, help="Monitor continuously (interval in seconds)")
    
    args = parser.parse_args()
    
    if args.monitor:
        asyncio.run(monitor_site(args.url, args.monitor))
    else:
        asyncio.run(test_site(args.url, args.screenshot, args.console, args.network))


if __name__ == "__main__":
    main()
