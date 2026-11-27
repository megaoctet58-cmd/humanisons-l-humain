"""Génère src/data/franceMap.ts (tracés SVG des départements) à partir du GeoJSON
« departements-avec-outre-mer.geojson » du projet github.com/gregoiredavid/france-geojson
(tracés IGN Admin Express, Licence Ouverte Etalab).

Usage : python3 scripts/build-map.py chemin/vers/departements-avec-outre-mer.geojson
"""
import json, math, sys
sys.setrecursionlimit(100000)

src = json.load(open(sys.argv[1]))
W, H = 600, 600
EPS = 0.9  # tolérance de simplification, en pixels

def proj(lon, lat, lat0=46.5):
    return lon * math.cos(math.radians(lat0)), -lat

def dp(pts, eps):
    """Douglas-Peucker itératif (indices, sans copies)."""
    n = len(pts)
    if n < 3: return pts
    keep = [False]*n; keep[0] = keep[-1] = True
    stack = [(0, n-1)]
    while stack:
        i0, i1 = stack.pop()
        if i1 - i0 < 2: continue
        a, b = pts[i0], pts[i1]
        dx, dy = b[0]-a[0], b[1]-a[1]; L = math.hypot(dx, dy)
        imax, dmax = i0, -1.0
        for i in range(i0+1, i1):
            p = pts[i]
            d = abs(dy*(p[0]-a[0]) - dx*(p[1]-a[1]))/L if L > 1e-9 else math.hypot(p[0]-a[0], p[1]-a[1])
            if d > dmax: imax, dmax = i, d
        if dmax > eps:
            keep[imax] = True
            stack.append((i0, imax)); stack.append((imax, i1))
    return [p for p, k in zip(pts, keep) if k]

def rings(geom):
    polys = geom['coordinates'] if geom['type'] == 'MultiPolygon' else [geom['coordinates']]
    for poly in polys:
        for ring in poly: yield ring

def path_for(feats, box, lat0):
    pr = {c: [[proj(x, y, lat0) for x, y in r] for r in rings(g)] for c, g in feats}
    xs = [p[0] for rs in pr.values() for r in rs for p in r]; ys = [p[1] for rs in pr.values() for r in rs for p in r]
    bx, by, bw, bh = box
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    s = min(bw/(x1-x0), bh/(y1-y0))
    ox = bx + (bw - s*(x1-x0))/2; oy = by + (bh - s*(y1-y0))/2
    out = {}
    for c, rs in pr.items():
        d = []
        for r in rs:
            pts = [((x-x0)*s+ox, (y-y0)*s+oy) for x, y in r]
            # Retire d'abord les points trop proches (moins de 0,6 pixel), puis simplifie.
            thin = [pts[0]]
            for p in pts[1:]:
                if math.hypot(p[0]-thin[-1][0], p[1]-thin[-1][1]) >= 0.6: thin.append(p)
            pts = thin
            if len(pts) > 4:
                pts = dp(pts, EPS)
            if len(pts) < 3: continue
            # écarte les îlots minuscules
            area = abs(sum(pts[i][0]*pts[i-1][1]-pts[i-1][0]*pts[i][1] for i in range(len(pts))))/2
            if area < 1.5 and len(rs) > 1: continue
            d.append('M' + 'L'.join(f'{x:.1f},{y:.1f}'.replace('.0,', ',').replace('.0L', 'L') for x, y in pts) + 'Z')
        out[c] = ''.join(d)
    return out

feats = {f['properties']['code']: (f['properties']['nom'], f['geometry']) for f in src['features']}
metro = [(c, g) for c, (n, g) in feats.items() if len(c) == 2]
paths = path_for(metro, (10, 10, W-20, H-20), 46.5)
# Outre-mer : petits encadrés en bas à gauche.
DOM = ['971', '972', '973', '974', '976']
insets = []
for i, c in enumerate(DOM):
    box = (8 + i*62, H + 14, 54, 54)
    g = feats[c][1]
    lat = (lambda ys: sum(ys)/len(ys))([p[1] for r in rings(g) for p in r])
    paths.update(path_for([(c, g)], box, lat))
    insets.append({'code': c, 'x': box[0]-4, 'y': box[1]-4, 'w': box[2]+8, 'h': box[3]+8})

names = {c: n for c, (n, g) in feats.items()}
order = sorted(paths, key=lambda c: (len(c) > 2, c))
with open('src/data/franceMap.ts', 'w') as f:
    f.write('/**\n * Tracés simplifiés des départements français (métropole + 5 départements d’outre-mer en encadrés).\n'
            ' * Source : IGN – Admin Express COG 2018, via github.com/gregoiredavid/france-geojson.\n'
            ' * Licence Ouverte (Etalab) : réutilisation libre et gratuite, avec mention de la source.\n'
            ' * Fichier généré par scripts/build-map.py : ne pas modifier à la main.\n */\n')
    f.write(f'export const MAP_VIEWBOX = "0 0 {W} {H + 80}";\n')
    f.write('export const MAP_INSETS = ' + json.dumps(insets) + ';\n')
    f.write('export const DEPARTMENT_PATHS: Record<string, string> = {\n')
    for c in order: f.write(f'  "{c}": "{paths[c]}",\n')
    f.write('};\n')
    f.write('export const GEO_NAMES: Record<string, string> = ' + json.dumps({c: names[c] for c in order}, ensure_ascii=False) + ';\n')
