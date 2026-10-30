import sys
sys.path.insert(0, r"C:\Users\Sid\eco-terminal\EcoTerminal")
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)
resp = client.get("/api/v1/public-facilities/iron-mountain-mum-1/environmental?metrics=aqi,pm25,temperature,relative_humidity,rainfall,groundwater_depth&range=24h&interval=auto")
print("Status:", resp.status_code)
if resp.status_code != 200:
    print("Error:", resp.text)
else:
    data = resp.json()
    print("Facility:", data["facilityId"], "Range:", data["range"], "Interval:", data["interval"])
    print("Series count:", len(data["series"]))
    for s in data["series"]:
        print(f"  {s['displayName']} ({s['metric']}): {len(s['points'])} points, status={s['availability']}")
