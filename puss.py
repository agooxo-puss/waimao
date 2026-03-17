#!/usr/bin/env python3
"""
puss.py - Python Browser Automation (Playwright replacement)
Like Playwright but simpler, for Kimaki news website automation
"""

import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Optional, Dict, Any, List, Union
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlparse
import re

# Try to import playwright, fall back to requests if not available
try:
    from playwright.async_api import async_playwright, Playwright as PlaywrightSync, Browser, Page, BrowserContext, TimeoutError as PlaywrightTimeoutError
    HAS_PLAYWRIGHT = True
except ImportError:
    HAS_PLAYWRIGHT = False
    print("Warning: playwright not installed. Using requests fallback.")

try:
    import requests
    from bs4 import BeautifulSoup
    HAS_BS4 = True
except ImportError:
    HAS_BS4 = False


@dataclass
class ConsoleMessage:
    """Represents a console message from the browser"""
    type: str  # log, error, warning, info
    text: str
    args: List[Any] = field(default_factory=list)


@dataclass 
class Request:
    """Represents a network request"""
    url: str
    method: str = "GET"
    headers: Dict[str, str] = field(default_factory=dict)
    post_data: Optional[str] = None


@dataclass
class Response:
    """Represents a network response"""
    url: str
    status: int
    headers: Dict[str, str] = field(default_factory=dict)
    body: Optional[str] = None


class Puss:
    """
    Main class for browser automation - similar to Playwright but simpler
    """
    
    def __init__(self, headless: bool = True, slow_mo: int = 0):
        self.headless = headless
        self.slow_mo = slow_mo
        self.playwright = None
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.console_messages: List[ConsoleMessage] = []
        self.requests: List[Request] = []
        self.responses: List[Response] = []
        self._state: Dict[str, Any] = {}
        
    async def __aenter__(self):
        await self.start()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
        
    async def start(self):
        """Start the browser"""
        if HAS_PLAYWRIGHT:
            self.playwright = await async_playwright().start()
            self.browser = await self.playwright.chromium.launch(
                headless=self.headless,
                slow_mo=self.slow_mo
            )
            self.context = await self.browser.new_context(
                viewport={"width": 1280, "height": 720}
            )
            self.page = await self.context.new_page()
            self._setup_listeners()
        else:
            print("Running in fallback mode (requests + BeautifulSoup)")
            
    def _setup_listeners(self):
        """Setup console and network listeners"""
        if not self.page:
            return
            
        # Console messages
        self.page.on("console", lambda msg: self.console_messages.append(
            ConsoleMessage(type=msg.type, text=msg.text)
        ))
        
        # Network requests
        self.page.on("request", lambda req: self.requests.append(
            Request(url=req.url, method=req.method)
        ))
        
        # Network responses
        self.page.on("response", lambda res: self.responses.append(
            Response(url=res.url, status=res.status)
        ))
        
    async def goto(self, url: str, wait_until: str = "load", timeout: int = 30000):
        """Navigate to URL"""
        if HAS_PLAYWRIGHT and self.page:
            await self.page.goto(url, wait_until=wait_until, timeout=timeout)
        else:
            # Fallback using requests
            response = requests.get(url)
            self._state['html'] = response.text
            self._state['url'] = url
            
    async def wait_for_timeout(self, milliseconds: int):
        """Wait for specified milliseconds"""
        if HAS_PLAYWRIGHT and self.page:
            await self.page.wait_for_timeout(milliseconds)
        else:
            import time
            time.sleep(milliseconds / 1000)
            
    async def click(self, selector: str, **kwargs):
        """Click an element"""
        if HAS_PLAYWRIGHT and self.page:
            await self.page.click(selector, **kwargs)
            
    async def fill(self, selector: str, value: str):
        """Fill input field"""
        if HAS_PLAYWRIGHT and self.page:
            await self.page.fill(selector, value)
            
    async def type(self, selector: str, text: str, delay: int = 0):
        """Type text into element"""
        if HAS_PLAYWRIGHT and self.page:
            await self.page.type(selector, text, delay=delay)
            
    async def press(self, selector: str, key: str):
        """Press a key"""
        if HAS_PLAYWRIGHT and self.page:
            await self.page.press(selector, key)
            
    async def hover(self, selector: str):
        """Hover over element"""
        if HAS_PLAYWRIGHT and self.page:
            await self.page.hover(selector)
            
    async def scroll_into_view(self, selector: str):
        """Scroll element into view"""
        if HAS_PLAYWRIGHT and self.page:
            await self.page.locator(selector).scroll_into_view_if_needed()
            
    async def evaluate(self, script: str):
        """Execute JavaScript in browser context"""
        if HAS_PLAYWRIGHT and self.page:
            return await self.page.evaluate(script)
        return None
        
    async def evaluate_on_new_document(self, script: str):
        """Execute JavaScript on new document"""
        if HAS_PLAYWRIGHT and self.page:
            await self.page.evaluate_on_new_document(script)
            
    async def screenshot(self, path: str = None, full_page: bool = False):
        """Take screenshot"""
        if HAS_PLAYWRIGHT and self.page:
            return await self.page.screenshot(path=path, full_page=full_page)
        return None
        
    async def content(self) -> str:
        """Get page content"""
        if HAS_PLAYWRIGHT and self.page:
            return await self.page.content()
        return self._state.get('html', '')
        
    async def inner_html(self, selector: str) -> str:
        """Get inner HTML of element"""
        if HAS_PLAYWRIGHT and self.page:
            return await self.page.inner_html(selector)
        return ""
        
    async def inner_text(self, selector: str) -> str:
        """Get inner text of element"""
        if HAS_PLAYWRIGHT and self.page:
            return await self.page.inner_text(selector)
        return ""
        
    async def text_content(self, selector: str) -> str:
        """Get text content of element"""
        if HAS_PLAYWRIGHT and self.page:
            return await self.page.text_content(selector)
        return ""
        
    async def input_value(self, selector: str) -> str:
        """Get input value"""
        if HAS_PLAYWRIGHT and self.page:
            return await self.page.input_value(selector)
        return ""
        
    async def is_visible(self, selector: str) -> bool:
        """Check if element is visible"""
        if HAS_PLAYWRIGHT and self.page:
            return await self.page.is_visible(selector)
        return False
        
    async def is_hidden(self, selector: str) -> bool:
        """Check if element is hidden"""
        if HAS_PLAYWRIGHT and self.page:
            return await self.page.is_hidden(selector)
        return True
        
    async def is_enabled(self, selector: str) -> bool:
        """Check if element is enabled"""
        if HAS_PLAYWRIGHT and self.page:
            return await self.page.is_enabled(selector)
        return False
        
    async def wait_for_selector(self, selector: str, timeout: int = 30000, state: str = "visible"):
        """Wait for selector"""
        if HAS_PLAYWRIGHT and self.page:
            await self.page.wait_for_selector(selector, timeout=timeout, state=state)
            
    async def wait_for_load_state(self, state: str = "load", timeout: int = 30000):
        """Wait for load state"""
        if HAS_PLAYWRIGHT and self.page:
            await self.page.wait_for_load_state(state, timeout=timeout)
            
    async def wait_for_function(self, script: str, timeout: int = 30000):
        """Wait for function to return true"""
        if HAS_PLAYWRIGHT and self.page:
            await self.page.wait_for_function(script, timeout=timeout)
            
    async def url(self) -> str:
        """Get current URL"""
        if HAS_PLAYWRIGHT and self.page:
            return self.page.url
        return self._state.get('url', '')
        
    async def title(self) -> str:
        """Get page title"""
        if HAS_PLAYWRIGHT and self.page:
            return await self.page.title()
        return ""
        
    def console_messages(self) -> List[ConsoleMessage]:
        """Get console messages"""
        return self.console_messages
        
    def requests(self) -> List[Request]:
        """Get network requests"""
        return self.requests
        
    def responses(self) -> List[Response]:
        """Get network responses"""
        return self.responses
        
    async def close(self):
        """Close browser"""
        if self.page:
            await self.page.close()
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()


# Helper functions (similar to playwright CLI)
def session_new() -> Puss:
    """Create new browser session"""
    return Puss(headless=True)


async def main():
    """Example usage"""
    async with Puss(headless=False) as puss:
        await puss.goto("https://example.com")
        print(f"Title: {await puss.title()}")
        print(f"URL: {await puss.url()}")
        await puss.screenshot("screenshot.png")


if __name__ == "__main__":
    asyncio.run(main())
