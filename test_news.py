
import sys
import os
import json

# Add src to path
sys.path.append(os.path.join(os.getcwd(), 'src'))

from utils import news_fetcher

def run_fetch():
    queries = [
        "China to Russian Federation",
        "Russian Federation China to Russian Federation",
        "Russian Federation Logistics",
        "Sanctions on Russia"
    ]
    
    for q in queries:
        print(f"\nQuery: '{q}'")
        items = news_fetcher.fetch_google_news_rss(q)
        print(f"Found {len(items)} items")
        if items:
            print(f"Top 1: {items[0]['title']}")
            print(f"Summary: {items[0]['summary'][:100]}...")

if __name__ == "__main__":
    run_fetch()
