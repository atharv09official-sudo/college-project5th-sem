import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import datetime
from typing import List, Dict, Any
from functools import lru_cache

@lru_cache(maxsize=200)
def fetch_google_news_rss(query: str) -> List[Dict[str, Any]]:
    """
    Fetches news from Google News RSS feed for a given query.
    Returns a list of dictionaries with title, link, pubDate, source, etc.
    """
    if not query:
        return []

    base_url = "https://news.google.com/rss/search"
    params = {
        "q": query,
        "hl": "en-US",
        "gl": "US",
        "ceid": "US:en"
    }
    url = f"{base_url}?{urllib.parse.urlencode(params)}"
    
    try:
        # Create request with a user agent to avoid being blocked
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        )
        
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status != 200:
                return []
            xml_content = response.read()
            
        root = ET.fromstring(xml_content)
        items = []
        
        # Parse RSS items
        # Structure: <item><title>...</title><link>...</link><pubDate>...</pubDate><source>...</source>...</item>
        for item in root.findall('.//item'):
            title = item.find('title').text if item.find('title') is not None else "No Title"
            link = item.find('link').text if item.find('link') is not None else "#"
            pub_date = item.find('pubDate').text if item.find('pubDate') is not None else ""
            description = item.find('description').text if item.find('description') is not None else ""
            source_elem = item.find('source')
            source = source_elem.text if source_elem is not None else "Google News"
            
            # Simple clean up of title (Google News often has " - SourceName" at the end)
            if " - " in title:
                title = title.rsplit(" - ", 1)[0]

            # Parse date if possible
            formatted_date = pub_date
            try:
                # Example: Mon, 06 Feb 2026 10:00:00 GMT
                dt = datetime.datetime.strptime(pub_date, "%a, %d %b %Y %H:%M:%S %Z")
                formatted_date = dt.strftime("%Y-%m-%d")
            except ValueError:
                pass

            items.append({
                "id": f"gn-{hash(link)}",
                "title": title,
                "url": link,
                "date": formatted_date,
                "source": source,
                "summary": description, # Google News description is often HTML, might need cleaning but acceptable for now
                "severity": "Unknown", # To be filled by risk engine if needed
                "meta_fetched_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "meta_is_live": True,
                "meta_source_origin": "Google News RSS",
                "meta_verified": True
            })
            
        return items[:10] # Return top 10
        
    except Exception as e:
        print(f"Error fetching Google News: {e}")
        return []

def get_combined_news(query: str, location: str = "") -> List[Dict[str, Any]]:
    """
    Wrapper to get news for a location + query combined.
    """
    full_query = f"{location} {query}".strip()
    return fetch_google_news_rss(full_query)
