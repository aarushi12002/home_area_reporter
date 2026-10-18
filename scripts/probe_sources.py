"""Read official metadata; no credentials, data rows or personal records stored."""
import json
from pathlib import Path
from urllib.request import urlopen
sources = json.loads((Path(__file__).resolve().parents[1] / 'sources.json').read_text())['sources']
for source in sources:
    try:
        with urlopen(f"https://data.seattle.gov/api/views/{source['id']}.json", timeout=20) as response:
            metadata = json.load(response)
        print(json.dumps({'id':source['id'],'name':metadata.get('name'),'license':metadata.get('license'),'refresh':metadata.get('metadata',{}).get('custom_fields',{}).get('Refresh Frequency',{})}))
    except Exception as error:
        print(json.dumps({'id':source['id'],'error':str(error)}))
