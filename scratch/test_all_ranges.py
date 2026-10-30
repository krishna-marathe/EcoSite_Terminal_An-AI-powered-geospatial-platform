import sys
sys.path.insert(0, r"C:\Users\Sid\eco-terminal\EcoTerminal")
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)
for r in ["24h", "7d", "30d", "90d"]:
    resp = client.get(f"/api/v1/public-facilities/iron-mountain-mum-1/environmental?metrics=aqi,pm25,temperature,relative_humidity,rainfall,groundwater_depth&range={r}&interval=auto")
    data = resp.json()
    print(f"Range {r}: HTTP {resp.status_code}, Interval: {data.get('interval')}")
    for s in data.get("series", [])[:2]:
        print(f"   {s['displayName']}: {len(s['points'])} points, coverage={s['coverageFraction']}")
