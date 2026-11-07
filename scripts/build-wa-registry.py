"""Rebuild Washington's planning inventory from pinned Census geography.

Run with Python + shapely 2.1.2. No permit source is enabled by this operation.
County residuals are planning candidates, not legal jurisdiction determinations.
"""
import concurrent.futures
import datetime
import json
from pathlib import Path
import re
import urllib.parse
import urllib.request
from shapely import make_valid
from shapely.geometry import shape, mapping
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent.parent
BASE = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2024/MapServer"
CACHE = ROOT / ".local/wa-geography"
CACHE.mkdir(parents=True, exist_ok=True)


def query(layer, **params):
    url = f"{BASE}/{layer}/query?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=120) as response:
        data = json.load(response)
    if data.get("error") or data.get("exceededTransferLimit"):
        raise RuntimeError(f"Incomplete Census layer {layer}")
    return data


def fetch(name, layer, fields, **filters):
    path = CACHE / f"{name}.json"
    if path.exists():
        return json.loads(path.read_text())
    expected = query(layer, f="json", returnCountOnly="true", **filters)["count"]
    result = query(layer, f="geojson", outFields=fields, returnGeometry="true", outSR=4326,
                   geometryPrecision=5, maxAllowableOffset=0.00005, **filters)
    if len(result["features"]) != expected:
        raise RuntimeError(f"Census count mismatch: {name}")
    path.write_text(json.dumps(result))
    return result


def slug(value):
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def geometry(feature):
    return make_valid(shape(feature["geometry"]))


def build():
    jobs = [
        ("state", 80, "GEOID,NAME", {"where": "STATE='53'"}),
        ("cities", 28, "GEOID,BASENAME,STATE,LSADC", {"where": "STATE='53'"}),
        ("counties", 82, "GEOID,BASENAME,STATE", {"where": "STATE='53'"}),
        ("zctas", 2, "GEOID,ZCTA5", {"where": "1=1", "geometry": "-124.85,45.54,-116.9,49.01",
                                     "geometryType": "esriGeometryEnvelope", "inSR": 4326,
                                     "spatialRel": "esriSpatialRelIntersects"}),
    ]
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        data = dict(zip([job[0] for job in jobs], pool.map(lambda job: fetch(*job[:3], **job[3]), jobs)))
    state = geometry(data["state"]["features"][0])
    cities = [(f["properties"], geometry(f).intersection(state)) for f in data["cities"]["features"]]
    city_union = unary_union([g for _, g in cities])
    counties = [(f["properties"], geometry(f).intersection(state)) for f in data["counties"]["features"]]
    jurisdictions, shapes = [], {}
    first = {"Seattle", "Bellevue", "Redmond", "Kirkland", "Tacoma", "Spokane", "Vancouver"}
    for props, geom in cities:
        name = props["BASENAME"]
        key = "us-wa-" + slug(name)
        county_names = [p["BASENAME"] for p, c in counties if geom.intersection(c).area > 1e-8]
        wave = 1 if name in first else 2 if any(c in ["King", "Pierce", "Snohomish"] for c in county_names) else 3
        jurisdictions.append({"id": key, "name": name, "state": "WA", "type": "city", "geoid": props["GEOID"],
                              "counties": county_names, "wave": wave, "sourceStatus": "connected" if name == "Seattle" else "needs_source_review",
                              "nextAction": "Maintain published reports" if name == "Seattle" else "Verify reusable building and land-use sources; review local context and transit"})
        shapes[key] = geom
    for props, geom in counties:
        key = "us-wa-county-" + slug(props["BASENAME"]) + "-unincorporated"
        jurisdictions.append({"id": key, "name": props["BASENAME"] + " County (unincorporated)", "state": "WA", "type": "county_unincorporated",
                              "geoid": props["GEOID"], "counties": [props["BASENAME"]], "wave": 2 if props["BASENAME"] in ["King", "Pierce", "Snohomish"] else 3,
                              "sourceStatus": "needs_source_review", "nextAction": "Verify permitting authority, including tribal/federal exclusions, and reusable sources"})
        shapes[key] = make_valid(geom.difference(city_union))
    old = json.loads((ROOT / "data/service-areas.json").read_text())
    legacy = {a["zip"]: a for a in old["areas"] if a.get("jurisdictionId") == "us-wa-seattle"}
    areas, zcta_shapes = [], {}
    for feature in data["zctas"]["features"]:
        raw = geometry(feature)
        geom = raw.intersection(state)
        if geom.area <= 1e-8:
            continue
        zip_code = feature["properties"]["ZCTA5"]
        ids = [j["id"] for j in jurisdictions if geom.intersection(shapes[j["id"]]).area > 1e-8]
        if not ids:
            raise RuntimeError("Unassigned Washington geography: " + zip_code)
        area = {"zip": zip_code, "state": "WA", "jurisdictionId": ids[0], "jurisdictionIds": ids,
                "bounds": [round(n, 5) for n in raw.bounds], "shared": len(ids) > 1,
                "reviewStatus": "pending_review", "geographyType": "zcta"}
        if zip_code in legacy:
            area.update(legacy[zip_code])
            area["jurisdictionIds"] = list(dict.fromkeys(["us-wa-seattle"] + ids))
            area["reviewStatus"] = "reviewed"
        areas.append(area)
        zcta_shapes[zip_code] = mapping(raw)
    if not set(legacy).issubset({a["zip"] for a in areas}):
        raise RuntimeError("Seattle registry would lose an existing area")
    for jurisdiction in jurisdictions:
        jurisdiction["zips"] = sorted(a["zip"] for a in areas if jurisdiction["id"] in a["jurisdictionIds"])
    seattle = next(item for item in jurisdictions if item["id"] == "us-wa-seattle")
    seattle["nextAction"] = "Maintain 31 reviewed reports; review additional boundary-intersection candidates separately"
    source_inventory = json.loads((ROOT / "sources.json").read_text())
    for item in jurisdictions:
        configs = [s for s in source_inventory.get("jurisdiction_sources", []) if s["jurisdictionId"] == item["id"]]
        if configs:
            source = configs[0]
            item["sourceStatus"] = source.get("sourceStatus") or ("context_review" if source.get("enabled") and source.get("reuseStatus") == "approved" else source.get("reuseStatus", "source_review"))
            item["nextAction"] = source.get("nextAction") or source.get("blocker") or "Validate live ingestion, all city ZIP geography, neighborhood facts and local transit before publication"
    provenance = {"source": BASE, "vintage": "ACS2024 / 2020 ZCTAs", "stateFips": "53",
                  "retrievedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                  "method": "Positive-area intersection (>1e-8 square degrees); county residuals subtract incorporated places",
                  "limits": "Approximate planning geography, not legal postal or permitting boundaries. Tribal/federal authority and local boundary changes require review before activation."}
    result = {"provenance": old["provenance"], "stateProvenance": provenance,
              "jurisdictions": sorted(jurisdictions, key=lambda j: (j["wave"], j["name"])), "areas": sorted(areas, key=lambda a: a["zip"])}
    (ROOT / "data/service-areas.json").write_text(json.dumps(result, indent=2) + "\n")
    (ROOT / "data/washington-boundaries.json").write_text(json.dumps({"provenance": provenance, "jurisdictions": {k: mapping(v) for k, v in shapes.items()}, "zctas": zcta_shapes}, separators=(",", ":")) + "\n")
    print(json.dumps({"areas": len(areas), "cities": len(cities), "countyCandidates": len(counties), "jurisdictions": len(jurisdictions)}))


if __name__ == "__main__":
    build()
