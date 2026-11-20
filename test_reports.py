import requests
import json

BASE_URL = "http://127.0.0.1:5000"

def check_endpoint(name, url, method="GET", data=None):
    print(f"Testing {name} ({url})...")
    try:
        if method == "GET":
            response = requests.get(f"{BASE_URL}{url}")
        else:
            response = requests.post(f"{BASE_URL}{url}", json=data)
            
        if response.status_code in [200, 201]:
            print(f"  OK ({response.status_code})")
            try:
                print(f"  Response: {json.dumps(response.json(), indent=2)[:200]}...")
            except:
                print("  Response: (Not JSON)")
        else:
            print(f"  FAIL ({response.status_code})")
            print(f"  {response.text[:200]}")
    except Exception as e:
        print(f"  ERROR: {e}")

# Test Reports Endpoints
check_endpoint("Reports History", "/api/reports-history")
check_endpoint("Reports Summary", "/api/reports-summary")

# Test Risk Endpoints (New Logic)
check_endpoint("Risk History (Global)", "/api/risk-history?location=Global")
check_endpoint("Risk Breakdown (Global)", "/api/risk-breakdown?location=Global")

# Test Route Options (New Logic)
check_endpoint("Route Options (India->NL)", "/api/route-options?from=India&to=Netherlands")
check_endpoint("Route Options (US->China)", "/api/route-options?from=United%20States&to=China")

# Test Generate Report
check_endpoint("Generate Report", "/api/generate-report", "POST", {"type": "executive_brief"})
