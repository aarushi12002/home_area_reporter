// Server-side ingestion geography. These polygons must never enter map bundles.
import boundaries from "../data/washington-boundaries.json" with {type:"json"};

function ringContains([x,y], ring) {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [xi,yi]=ring[i], [xj,yj]=ring[j];
    if(((yi>y)!==(yj>y)) && x<(xj-xi)*(y-yi)/(yj-yi)+xi) inside=!inside;
  }
  return inside;
}
export function containsPoint(geometry, longitude, latitude) {
  if(!geometry || !Number.isFinite(longitude)||!Number.isFinite(latitude))return false;
  if(geometry.type === "GeometryCollection")return geometry.geometries.some((g)=>containsPoint(g,longitude,latitude));
  const polygons=geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
  return polygons.some(([outer,...holes])=>ringContains([longitude,latitude],outer)&&!holes.some((hole)=>ringContains([longitude,latitude],hole)));
}
export function insideJurisdiction(id, longitude, latitude) {
  return containsPoint(boundaries.jurisdictions[id],longitude,latitude);
}
export function zipAtPoint(longitude,latitude,allowedZips) {
  const matches=allowedZips.filter((zip)=>containsPoint(boundaries.zctas[zip],longitude,latitude));
  return matches.length === 1 ? matches[0] : null;
}

// A label point inside an ArcGIS parcel polygon, not a surveyed building point.
// Even/odd scan-line intervals handle concavities, holes and disjoint rings.
export function parcelLabelPoint(rings) {
  if (!Array.isArray(rings) || !rings.length || rings.some((ring)=>!Array.isArray(ring) || ring.length<4 || ring.some((point)=>!Array.isArray(point)||!point.slice(0,2).every(Number.isFinite)))) return null;
  const ys=rings.flatMap((ring)=>ring.map((point)=>point[1]));
  const south=ys.reduce((a,b)=>Math.min(a,b),Infinity), north=ys.reduce((a,b)=>Math.max(a,b),-Infinity);
  let best=null;
  for (const fraction of [0.5,0.25,0.75]) {
    const y=south+(north-south)*fraction, crossings=[];
    for (const ring of rings) for (let i=0,j=ring.length-1;i<ring.length;j=i++) {
      const [xi,yi]=ring[i], [xj,yj]=ring[j];
      if ((yi>y)!==(yj>y)) crossings.push(xi+(y-yi)*(xj-xi)/(yj-yi));
    }
    crossings.sort((a,b)=>a-b);
    if (crossings.length%2) return null;
    for (let i=0;i<crossings.length;i+=2) {
      const width=crossings[i+1]-crossings[i];
      if (width>0 && (!best || width>best.width)) best={longitude:(crossings[i]+crossings[i+1])/2,latitude:y,width};
    }
  }
  return best ? {longitude:best.longitude,latitude:best.latitude} : null;
}
