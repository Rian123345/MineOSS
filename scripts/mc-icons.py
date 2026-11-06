#!/usr/bin/env python3
"""
Erzeugt Shop-Icons aus einem Minecraft-Resource-Pack (z. B. dem Standard-Pack).

  python3 scripts/mc-icons.py <entpackter-Pack-Ordner>

- Items (flache Texturen) werden 1:1 übernommen (16×16, im Browser pixelgenau vergrößert).
- Blöcke werden aus ihren Modellen als isometrischer Würfel wie im Inventar gerendert
  (inkl. Grasfärbung, Overlays, Animations-Frame 1, Halbstufen, Teppiche …).
Ausgabe: client/mc-textures.json (alle PNGs in einer Datei, Base64)  +  client/lib/mcIcons.json
Beim Build (npm run build) werden daraus die Dateien dist/public/mc/<id>.png.
Benötigt Python 3 + Pillow. Nur für Betreiber, die eigene Texturen einbauen möchten.
"""
import json, os, sys
from PIL import Image

PACK = sys.argv[1] if len(sys.argv) > 1 else '.'
ROOT = os.path.join(PACK, 'assets', 'minecraft')
PACK = os.path.join(os.path.dirname(__file__), '..', 'client', 'mc-textures.json')
PNGS = {}

def save_png(iid, img):
    import io, base64
    buf = io.BytesIO()
    img.save(buf, format='PNG', optimize=True)
    PNGS[iid] = base64.b64encode(buf.getvalue()).decode('ascii')
MANIFEST = os.path.join(os.path.dirname(__file__), '..', 'client', 'lib', 'mcIcons.json')
CUBE = 96          # Ausgabegröße der Block-Icons
SS = 3             # Supersampling für weiche Kanten

GRASS = (0x7C, 0xBD, 0x6B)

def strip(ns):
    return ns.split(':', 1)[1] if ':' in ns else ns

def load_json(path):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return None

_tex_cache = {}
def texture(name):
    """Textur laden (erster Frame bei Animationen)."""
    name = strip(name)
    if name in _tex_cache:
        return _tex_cache[name]
    p = os.path.join(ROOT, 'textures', name + '.png')
    img = None
    if os.path.exists(p):
        img = Image.open(p).convert('RGBA')
        w, h = img.size
        if h > w and h % w == 0:
            img = img.crop((0, 0, w, w))
    _tex_cache[name] = img
    return img

def model_chain(name):
    """Liefert (zusammengeführte Texturen, Elemente, Kette der Elternmodelle)."""
    textures, elements, chain = {}, None, []
    cur = strip(name)
    guard = 0
    while cur and guard < 20:
        guard += 1
        chain.append(cur)
        m = load_json(os.path.join(ROOT, 'models', cur + '.json'))
        if m is None:
            break
        for k, v in (m.get('textures') or {}).items():
            textures.setdefault(k, v)
        if elements is None and 'elements' in m:
            elements = m['elements']
        cur = strip(m['parent']) if 'parent' in m else None
    return textures, elements, chain

def resolve(textures, ref, depth=0):
    while isinstance(ref, str) and ref.startswith('#') and depth < 10:
        ref = textures.get(ref[1:])
        depth += 1
    return ref

def tint_color(t):
    if not t:
        return None
    typ = strip(t.get('type', ''))
    if typ == 'grass':
        return GRASS
    v = t.get('value', t.get('default'))
    if isinstance(v, int):
        v &= 0xFFFFFF
        return ((v >> 16) & 255, (v >> 8) & 255, v & 255)
    if isinstance(v, list) and len(v) >= 3:
        return tuple(int(c * 255) if c <= 1 else int(c) for c in v[:3])
    return None

def apply_tint(img, color):
    if not color:
        return img
    r, g, b, a = img.split()
    r = r.point(lambda x: x * color[0] // 255)
    g = g.point(lambda x: x * color[1] // 255)
    b = b.point(lambda x: x * color[2] // 255)
    return Image.merge('RGBA', (r, g, b, a))

def shade(img, f):
    r, g, b, a = img.split()
    return Image.merge('RGBA', (r.point(lambda x: int(x * f)), g.point(lambda x: int(x * f)), b.point(lambda x: int(x * f)), a))

def find_model(node):
    """Sucht in einer Item-Definition das Standardmodell (Fallback, erster Fall …)."""
    if not isinstance(node, dict):
        return None
    typ = strip(node.get('type', ''))
    if typ == 'model':
        return node
    if typ == 'special':
        return {'model': node.get('base'), 'special': True}
    for key in ('fallback', 'on_false', 'model'):
        if key in node:
            r = find_model(node[key])
            if r:
                return r
    for key in ('cases', 'entries'):
        for c in node.get(key, []) or []:
            r = find_model(c.get('model') if isinstance(c, dict) else None)
            if r:
                return r
    return None

# ─────────── Würfel-Rendering ───────────

def face_image(textures, face, tints):
    if not face:
        return None
    ref = resolve(textures, face.get('texture'))
    if not ref or ref.startswith('#'):
        return None
    tex = texture(ref)
    if tex is None:
        return None
    uv = face.get('uv')
    if uv:
        s = tex.size[0] / 16
        x1, y1, x2, y2 = uv
        box = (int(min(x1, x2) * s), int(min(y1, y2) * s), int(max(x1, x2) * s), int(max(y1, y2) * s))
        if box[2] > box[0] and box[3] > box[1]:
            tex = tex.crop(box)
            if x1 > x2: tex = tex.transpose(Image.FLIP_LEFT_RIGHT)
            if y1 > y2: tex = tex.transpose(Image.FLIP_TOP_BOTTOM)
    if 'tintindex' in face:
        tex = apply_tint(tex, tints[face['tintindex']] if face['tintindex'] < len(tints) else None)
    return tex

def paste_face(canvas, tex, origin, U, V, w_units, h_units):
    """Bildet eine Textur (w×h Einheiten) per affiner Abbildung auf das Canvas ab."""
    W, H = canvas.size
    tw, th = tex.size
    # Vorwärts: p = origin + (u/tw*w)*U + (v/th*h)*V  →  Inverse für PIL
    a, b = U[0] * w_units / tw, V[0] * h_units / th
    c, d = U[1] * w_units / tw, V[1] * h_units / th
    det = a * d - b * c
    if abs(det) < 1e-9:
        return
    ia, ib, ic, id_ = d / det, -b / det, -c / det, a / det
    ox, oy = origin
    data = (ia, ib, -(ia * ox + ib * oy), ic, id_, -(ic * ox + id_ * oy))
    face = tex.transform((W, H), Image.AFFINE, data, resample=Image.NEAREST)
    # Nur innerhalb der Fläche behalten (PIL kachelt nicht, Außen ist transparent)
    canvas.alpha_composite(face)

def render_block(textures, elements, tints):
    if not elements:
        return None
    full = [e for e in elements if e.get('from', [0, 0, 0])[0] <= 0 and e['from'][2] <= 0
            and e.get('to', [16, 16, 16])[0] >= 16 and e['to'][2] >= 16 and not e.get('rotation')]
    if not full or len(full) != len(elements):
        return None   # Treppen, Zäune usw. werden nicht als Würfel dargestellt
    S = CUBE * SS
    u = S / 16.0
    canvas = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    top_y = min(16 - e['to'][1] for e in full)  # für niedrige Blöcke (Halbstufe) nach unten schieben
    offset = top_y * (7.5 / 16) * u / 2 if top_y else 0
    for e in full:
        y0, y1 = e['from'][1], e['to'][1]
        h = (y1 - y0)
        faces = e.get('faces', {})
        # Höhe des Elements in Pixeln, oberer Rand dieses Elements
        hp = h * 7.5 / 16 * u
        ytop = (16 - y1) * 7.5 / 16 * u
        L = (1 * u, 4.5 * u + ytop)
        B = (8 * u, 8 * u + ytop)
        left = face_image(textures, faces.get('north') or faces.get('south'), tints)
        right = face_image(textures, faces.get('east') or faces.get('west'), tints)
        top = face_image(textures, faces.get('up'), tints)
        if left is not None:
            paste_face(canvas, shade(left, 0.80), L, (7 * u / 16, 3.5 * u / 16), (0, hp / 16), 16, 16)
        if right is not None:
            paste_face(canvas, shade(right, 0.62), B, (7 * u / 16, -3.5 * u / 16), (0, hp / 16), 16, 16)
        if top is not None:
            paste_face(canvas, top, L, (7 * u / 16, -3.5 * u / 16), (7 * u / 16, 3.5 * u / 16), 16, 16)
    if offset:
        shifted = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
        shifted.alpha_composite(canvas, (0, int(offset)))
        canvas = shifted
    if canvas.getbbox() is None:
        return None
    return canvas.resize((CUBE, CUBE), Image.LANCZOS)

# ─────────── Flache Items ───────────

def render_item(textures, tints):
    layers = []
    i = 0
    while f'layer{i}' in textures:
        tex = texture(resolve(textures, textures[f'layer{i}']) or '')
        if tex is None:
            break
        layers.append(apply_tint(tex, tints[i] if i < len(tints) else None))
        i += 1
    if not layers:
        return None
    size = max(l.size[0] for l in layers)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    for l in layers:
        if l.size[0] != size:
            l = l.resize((size, size), Image.NEAREST)
        out.alpha_composite(l)
    return out

# ─────────── Sonderfälle: Objekte, die Minecraft aus Entity-Texturen zeichnet ───────────

def stack(*parts):
    w = max(p.size[0] for p in parts)
    out = Image.new('RGBA', (w, sum(p.size[1] for p in parts)), (0, 0, 0, 0))
    y = 0
    for p in parts:
        out.alpha_composite(p, (0, y)); y += p.size[1]
    return out

def cube_from_faces(top, left, right, height=16):
    textures = {'t': '#t'}
    # direkt rendern ohne Modell: temporäre Texturen im Cache
    _tex_cache['__t'], _tex_cache['__l'], _tex_cache['__r'] = top, left, right
    el = [{'from': [0, 0, 0], 'to': [16, height, 16], 'faces': {'up': {'texture': '__t'}, 'north': {'texture': '__l'}, 'east': {'texture': '__r'}}}]
    return render_block({}, el, [])

def special_cases(manifest, lang):
    out = {}
    chest = texture('entity/chest/normal')
    if chest:
        c = lambda b: chest.crop(b)
        flip = lambda im: im.transpose(Image.FLIP_TOP_BOTTOM)
        front = stack(c((42, 14, 56, 19)), flip(c((42, 33, 56, 43))))
        front.alpha_composite(c((1, 1, 3, 5)), (6, 3))
        side = stack(c((28, 14, 42, 19)), flip(c((28, 33, 42, 43))))
        out['chest'] = cube_from_faces(c((28, 0, 42, 14)), front, side, 15)
    for color in [''] + ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black']:
        sh = texture('entity/shulker/shulker' + (('_' + color) if color else ''))
        if not sh:
            continue
        def face(x):
            f = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
            f.alpha_composite(sh.crop((x, 44, x + 16, 52)), (0, 8))   # Unterteil
            f.alpha_composite(sh.crop((x, 16, x + 16, 28)), (0, 0))   # Deckel darüber
            return f
        out[(color + '_' if color else '') + 'shulker_box'] = cube_from_faces(sh.crop((16, 0, 32, 16)), face(16), face(0))
    shield = texture('entity/shield_base_nopattern')
    if shield:
        icon = Image.new('RGBA', (24, 24), (0, 0, 0, 0))
        icon.alpha_composite(shield.crop((1, 1, 13, 23)), (6, 1))
        out['shield'] = ('i', icon)
    for iid, img in out.items():
        kind = 'b'
        if isinstance(img, tuple):
            kind, img = img
        if img is None:
            continue
        save_png(iid, img)
        manifest[iid] = [kind, lang.get(f'item.minecraft.{iid}') or lang.get(f'block.minecraft.{iid}') or iid.replace('_', ' ').title()]

def main():
    lang = load_json(os.path.join(ROOT, 'lang', 'en_us.json')) or {}
    manifest = {}
    items_dir = os.path.join(ROOT, 'items')
    for fn in sorted(os.listdir(items_dir)):
        if not fn.endswith('.json'):
            continue
        iid = fn[:-5]
        d = load_json(os.path.join(items_dir, fn))
        node = find_model((d or {}).get('model'))
        if not node or not node.get('model'):
            continue
        model = strip(node['model'])
        tints = [tint_color(t) for t in node.get('tints', [])]
        textures, elements, chain = model_chain(model)
        img, kind = None, None
        if any(c in ('item/generated', 'builtin/generated') for c in chain):
            img, kind = render_item(textures, tints), 'i'
        elif model.startswith('block/'):
            img, kind = render_block(textures, elements, tints), 'b'
        if img is None:
            continue
        save_png(iid, img)
        name = lang.get(f'item.minecraft.{iid}') or lang.get(f'block.minecraft.{iid}') or iid.replace('_', ' ').title()
        manifest[iid] = [kind, name]
    special_cases(manifest, lang)
    with open(PACK, 'w', encoding='ascii') as f:
        json.dump(PNGS, f, separators=(',', ':'), sort_keys=True)
    with open(MANIFEST, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
    nb = sum(1 for v in manifest.values() if v[0] == 'b')
    print(f'{len(manifest)} Icons erzeugt ({len(manifest) - nb} Items, {nb} Blöcke)')

if __name__ == '__main__':
    main()
