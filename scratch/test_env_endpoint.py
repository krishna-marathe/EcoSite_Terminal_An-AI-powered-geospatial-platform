import json
import urllib.request

base = 'http://127.0.0.1:8000/api/v1'
try:
    with urllib.request.urlopen(f'{base}/public-facilities/iron-mountain-mum-1/environmental/current') as resp:
        data = json.loads(resp.read().decode())
        print('Current metrics count:', len(data.get('metrics', [])))
        for m in data.get('metrics', [])[:6]:
            st_name = m['station']['name'] if m.get('station') else 'None'
            dist = m['station']['distanceKm'] if m.get('station') else 'N/A'
            print(f"  {m['displayName']} ({m['metric']}): {m['value']} {m['unit']} [Status: {m['availability']}] (Station: {st_name}, {dist} km)")
except Exception as e:
    print('Error:', e)
