#!/usr/bin/env python3
"""
Environment configuration
"""

import os
from dotenv import load_dotenv

# Load .env file if exists
load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://sjokgfqpyuzrhuvrnvcz.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "sb_publishable_0shlrzPR6MoWE5td6BO3Pg_onhIIWK_")

# Admin credentials
ADMIN_USER = os.getenv("ADMIN_USER", "waimao")
ADMIN_PASS = os.getenv("ADMIN_PASS", "waimao123")

# Category names
CATEGORY_NAMES = {
    "world": "國際",
    "tech": "科技",
    "sports": "體育",
    "culture": "文化",
    "business": "香港",
    "macaodaily": "澳門"
}
