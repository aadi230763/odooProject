import urllib.request
import json

def test():
    # 1. Login to get token
    login_data = json.dumps({"email": "admin@example.com", "password": "password"}).encode('utf-8')
    req = urllib.request.Request(
        'http://127.0.0.1:5000/api/auth/login',
        data=login_data,
        headers={'Content-Type': 'application/json'}
    )
    try:
        res = urllib.request.urlopen(req)
        body = json.loads(res.read())
        token = body['data']['token']
    except Exception as e:
        print("Login failed:", getattr(e, 'read', lambda: str(e))())
        return

    # 2. Try creating an asset
    payload = {
        "name": "Test",
        "category_id": 1,
        "serial_number": None,
        "acquisition_date": None,
        "acquisition_cost": None,
        "condition": "good",
        "location": None,
        "is_bookable": False,
    }
    req2 = urllib.request.Request(
        'http://127.0.0.1:5000/api/assets',
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'}
    )
    try:
        res2 = urllib.request.urlopen(req2)
        print("Success:", res2.read())
    except Exception as e:
        print("Asset creation failed:", getattr(e, 'read', lambda: str(e))())

if __name__ == "__main__":
    test()
