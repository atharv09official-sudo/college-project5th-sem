
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

print("Test script starting...")

import json
import importlib.util

app_py_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "app.py")
spec = importlib.util.spec_from_file_location("legacy_app", app_py_path)
legacy_app = importlib.util.module_from_spec(spec)
spec.loader.exec_module(legacy_app)
app = legacy_app.app

def test_api_countries():
    print("Testing /api/countries...")
    with app.test_client() as client:
        response = client.get('/api/countries')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert isinstance(data, list)
        assert len(data) > 0
        print("API Countries: OK")

def test_api_route_options():
    print("Testing /api/route-options...")
    with app.test_client() as client:
        # Test default
        response = client.get('/api/route-options?from=India&to=Netherlands')
        assert response.status_code == 200
        data = json.loads(response.data)
        
        assert data['origin'] == 'India'
        assert data['destination'] == 'Netherlands'
        assert 'routes' in data
        assert len(data['routes']) > 0
        
        # Check structure of a route
        route = data['routes'][0]
        assert 'mode' in route
        assert 'risk_score' in route
        assert 'cost_usd' in route
        
        print("API Route Options (India -> Netherlands): OK")
        
        # Test another pair
        response = client.get('/api/route-options?from=China&to=Germany')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['origin'] == 'China'
        assert data['destination'] == 'Germany'
        print("API Route Options (China -> Germany): OK")

if __name__ == "__main__":
    try:
        test_api_countries()
        test_api_route_options()
        print("All Route Compare Tests Passed!")
    except Exception as e:
        print(f"Test Failed: {e}")
        import traceback
        traceback.print_exc()
