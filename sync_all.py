#!/usr/bin/env python3
"""
Sync all news sources to Supabase
Main coordination script
"""

import asyncio
import os
import sys
from datetime import datetime

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sync_bbc import sync_bbc


def get_date_str() -> str:
    """Get current date string"""
    today = datetime.now()
    return f"{today.year}年{today.month}月{today.day}日"


async def main():
    """Main sync function"""
    print("=" * 50)
    print(f"🕐 Starting news sync - {get_date_str()}")
    print("=" * 50)
    
    # Sync from each source
    try:
        await sync_bbc()
    except Exception as e:
        print(f"❌ BBC sync failed: {e}")
    
    # Add more sync functions here as needed
    # await sync_am730()
    # await sync_tdm()
    # await sync_macau_daily()
    # await sync_cool3c()
    
    print("=" * 50)
    print("✅ All sync complete!")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
