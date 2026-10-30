import sys
sys.path.insert(0, r"C:\Users\Sid\eco-terminal\EcoTerminal")
import traceback
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)
try:
    resp = client.get("/api/v1/public-facilities/iron-mountain-mum-1/environmental/current")
    print("Status:", resp.status_code)
    if resp.status_code != 200:
        print("Response text:", resp.text)
    else:
        print("Success! JSON preview:")
        data = resp.json()
        for m in data.get("metrics", [])[:6]:
            print(" ", m["displayName"], m["value"], m["unit"], m["availability"])
except Exception as e:
    traceback.print_exc()
