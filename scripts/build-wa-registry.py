"""Rebuild planning inventories from pinned Census geography.

Run with Python + shapely 2.1.2. No permit source is enabled by this operation.
County residuals are planning candidates, not legal jurisdiction determinations.
"""
import argparse
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
    prior_areas = {a["zip"]: a for a in old["areas"]}
    national_ids = {j["id"] for j in old["jurisdictions"] if j["state"] != "WA"}
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
        area["jurisdictionIds"] = list(dict.fromkeys(area["jurisdictionIds"] + [key for key in prior_areas.get(zip_code, {}).get("jurisdictionIds", []) if key in national_ids]))
        areas.append(area)
        zcta_shapes[zip_code] = mapping(raw)
    if not set(legacy).issubset({a["zip"] for a in areas}):
        raise RuntimeError("Seattle registry would lose an existing area")
    for jurisdiction in jurisdictions:
        jurisdiction["zips"] = sorted(a["zip"] for a in areas if jurisdiction["id"] in a["jurisdictionIds"])
        prior = next((j for j in old["jurisdictions"] if j["id"] == jurisdiction["id"]), {})
        for key in ["homePriority", "previewZip"]:
            if key in prior and (key != "previewZip" or prior[key] in jurisdiction["zips"]):
                jurisdiction[key] = prior[key]
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
              "jurisdictions": sorted(jurisdictions + [j for j in old["jurisdictions"] if j["state"] != "WA"], key=lambda j: (j["wave"], j["name"])), "areas": sorted(areas + [a for a in old["areas"] if a["state"] != "WA"], key=lambda a: a["zip"]),
              **({"nationalProvenance": old["nationalProvenance"]} if "nationalProvenance" in old else {})}
    (ROOT / "data/service-areas.json").write_text(json.dumps(result, indent=2) + "\n")
    (ROOT / "data/washington-boundaries.json").write_text(json.dumps({"provenance": provenance, "jurisdictions": {k: mapping(v) for k, v in shapes.items()}, "zctas": zcta_shapes}, separators=(",", ":")) + "\n")
    print(json.dumps({"areas": len(areas), "cities": len(cities), "countyCandidates": len(counties), "jurisdictions": len(jurisdictions)}))


# Selected major-city rollout priorities, not a ranking or complete national inventory.
# Preview ZIPs are examples, validated against the same Census place intersection.
MAJOR_CITIES = [
    ("NY", "New York", "3651000", "10001"),
    ("CA", "Los Angeles", "0644000", "90012"),
    ("IL", "Chicago", "1714000", "60601"),
    ("TX", "Houston", "4835000", "77002"),
    ("AZ", "Phoenix", "0455000", "85004"),
    ("PA", "Philadelphia", "4260000", "19103"),
    ("TX", "San Antonio", "4865000", "78205"),
    ("CA", "San Diego", "0666000", "92101"),
    ("TX", "Dallas", "4819000", "75201"),
    ("TX", "Austin", "4805000", "78701"),
    ("FL", "Jacksonville", "1235000", "32202"),
    ("TX", "Fort Worth", "4827000", "76102"),
    ("CA", "San Jose", "0668000", "95113"),
    ("CA", "San Francisco", "0667000", "94103"),
    ("MA", "Boston", "2507000", "02110"),
    ("CO", "Denver", "0820000", "80202"),
    ("DC", "Washington", "1150000", "20001"),
    ("FL", "Miami", "1245000", "33132"),
    ("GA", "Atlanta", "1304000", "30303"),
    ("OR", "Portland", "4159000", "97205"),
]


def build_major_cities():
    path = ROOT / "data/service-areas.json"
    old = json.loads(path.read_text())
    areas = {a["zip"]: a for a in old["areas"]}
    jurisdictions = {j["id"]: j for j in old["jurisdictions"]}

    def city_inventory(city):
        state, name, geoid, preview = city
        features = fetch("place-" + geoid, 28, "GEOID,BASENAME,STATE", where=f"GEOID='{geoid}'")["features"]
        if len(features) != 1:
            raise RuntimeError("Expected exactly one Census place: " + name)
        boundary = geometry(features[0])
        envelope = ",".join(str(n) for n in boundary.bounds)
        zctas = fetch("place-zctas-" + geoid, 2, "GEOID,ZCTA5", where="1=1", geometry=envelope,
                      geometryType="esriGeometryEnvelope", inSR=4326, spatialRel="esriSpatialRelIntersects")["features"]
        matches = []
        for feature in zctas:
            geom = geometry(feature)
            if geom.intersection(boundary).area > 1e-8:
                matches.append((feature["properties"]["ZCTA5"], [round(n, 5) for n in geom.bounds]))
        if preview not in dict(matches):
            raise RuntimeError("Preview ZIP does not intersect selected city: " + name)
        return city, matches, boundary

    # Finish every fetch/validation before writing; preserve the previous registry on failure.
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        inventories = list(pool.map(city_inventory, MAJOR_CITIES))
    pilot_shapes = {}
    enabled = {s["jurisdictionId"] for s in json.loads((ROOT / "sources.json").read_text()).get("jurisdiction_sources", []) if s.get("enabled") and s.get("reuseStatus") == "approved"}
    for priority, (city, matches, boundary) in enumerate(inventories):
        state, name, geoid, preview = city
        key = "us-" + state.lower() + "-" + slug(name)
        if key in enabled:
            pilot_shapes[key] = mapping(boundary)
        prior = jurisdictions.get(key, {})
        jurisdictions[key] = {"id": key, "name": name, "state": state, "type": "city", "geoid": geoid,
            "wave": 4, "sourceStatus": "needs_source_review",
            "nextAction": "Verify reusable local permit feeds, geography, neighborhood highlights and transit before project publication",
            **prior, "homePriority": priority + 10, "previewZip": preview,
            "zips": sorted(zip_code for zip_code, _ in matches)}
        for zip_code, bounds in matches:
            if zip_code not in areas:
                areas[zip_code] = {"zip": zip_code, "state": state, "jurisdictionId": key, "jurisdictionIds": [],
                    "bounds": bounds, "shared": True, "reviewStatus": "pending_review", "geographyType": "zcta",
                    "geographyScope": "Selected-city intersections only; other jurisdictions have not been inventoried"}
            ids = areas[zip_code].setdefault("jurisdictionIds", [areas[zip_code]["jurisdictionId"]])
            if key not in ids:
                ids.append(key)
    wa_priorities = ["Seattle", "Redmond", "Tacoma", "Bellevue", "Spokane", "Kirkland", "Vancouver", "Everett", "Renton", "Bellingham", "Olympia", "Yakima", "Kennewick", "Wenatchee"]
    wa_boundaries = json.loads((ROOT / "data/washington-boundaries.json").read_text())
    wa_examples = {"Seattle": "98103", "Redmond": "98052", "Tacoma": "98402", "Bellevue": "98004", "Spokane": "99201", "Kirkland": "98033", "Vancouver": "98660", "Everett": "98201", "Renton": "98057", "Bellingham": "98225", "Olympia": "98501", "Yakima": "98901", "Kennewick": "99336", "Wenatchee": "98801"}
    for item in jurisdictions.values():
        if item["state"] == "WA" and item["type"] == "city":
            boundary = shape(wa_boundaries["jurisdictions"][item["id"]])
            point = boundary.representative_point()
            central = [z for z in item["zips"] if z in wa_boundaries["zctas"] and shape(wa_boundaries["zctas"][z]).covers(point)]
            if central:
                item["previewZip"] = central[0]
            if wa_examples.get(item["name"]) in item["zips"]:
                item["previewZip"] = wa_examples[item["name"]]
        if item["state"] == "WA" and item["name"] in wa_priorities:
            item["homePriority"] = wa_priorities.index(item["name"]) if item["name"] in wa_priorities[:4] else 30 + wa_priorities.index(item["name"])
    old.update({"areas": sorted(areas.values(), key=lambda a: a["zip"]), "jurisdictions": list(jurisdictions.values()),
        "nationalProvenance": {"source": BASE, "vintage": "ACS2024 / 2020 ZCTAs",
            "retrievedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "selectedCities": len(MAJOR_CITIES),
            "method": "Positive-area city/ZCTA intersection (>1e-8 square degrees)",
            "limits": "Planning candidates only, including water/sliver/shared-boundary intersections. No local permit source or publication is enabled. Census context availability is checked independently in storage."}})
    path.write_text(json.dumps(old, indent=2) + "\n")
    (ROOT / "data/national-pilot-boundaries.json").write_text(json.dumps({"provenance": old["nationalProvenance"], "jurisdictions": pilot_shapes}, separators=(",", ":")) + "\n")
    print(json.dumps({"selectedCities": len(MAJOR_CITIES), "totalAreas": len(areas), "nonWaAreas": sum(a["state"] != "WA" for a in areas.values())}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--major-cities", action="store_true", help="Extend the inventory with selected major US cities; preserve Washington reviews")
    args = parser.parse_args()
    if args.major_cities:
        build_major_cities()
    else:
        build()
