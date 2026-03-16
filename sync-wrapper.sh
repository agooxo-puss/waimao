#!/bin/bash
cd /Users/whypuss/.kimaki/projects/kimaki/waimao
echo "=== Syncing Macau Daily ==="
/opt/homebrew/bin/node sync-playwright.cjs 2>&1
echo "=== Syncing TDM ==="
/opt/homebrew/bin/node sync-tdm.cjs 2>&1
echo "=== Syncing am730 ==="
/opt/homebrew/bin/node sync-am730.cjs 2>&1
