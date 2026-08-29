# regenerates assets/icons from the logo geometry: python3 tools/make-icons.py
import zlib, struct, pathlib

BG = (23, 23, 28)
FG = (245, 245, 244)

# the R, lifted straight out of assets/brand/logo.svg and made absolute
GLYPH = [
    [(150, 132), (300, 132), ("C", (347, 132), (378, 162), (378, 206)),
     ("C", (378, 240), (359, 265), (329, 275)), (399, 380), (325, 380),
     (265, 284), (220, 284), (220, 380), (150, 380)],
    [(220, 194), (220, 260), (292, 260), ("C", (312, 260), (324, 248), (324, 227)),
     ("C", (324, 206), (312, 194), (292, 194))],
]

# x, y, w, h, radius — each painted as a light bar with a dark 9px stroke
BARS = [
    (126, 243, 260, 27, 13),
    (163, 186, 34, 141, 12),
    (315, 186, 34, 141, 12),
    (122, 211, 28, 91, 11),
    (362, 211, 28, 91, 11),
]
STROKE = 4.5


def cubic(p0, c1, c2, p3, n=28):
    out = []
    for i in range(1, n + 1):
        t = i / n
        u = 1 - t
        out.append((
            u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0],
            u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1],
        ))
    return out


def flatten(sub):
    pts, cur = [], sub[0]
    pts.append(cur)
    for seg in sub[1:]:
        if isinstance(seg, tuple) and seg and seg[0] == "C":
            pts += cubic(cur, seg[1], seg[2], seg[3])
            cur = seg[3]
        else:
            pts.append(seg)
            cur = seg
    return pts


def round_rect(x, y, w, h, r, n=14):
    r = max(0.0, min(r, w / 2, h / 2))
    pts = []
    import math
    for cx, cy, a0 in ((x + w - r, y + r, -90), (x + w - r, y + h - r, 0),
                       (x + r, y + h - r, 90), (x + r, y + r, 180)):
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def coverage(polys, S, scale, off, ss):
    edges = []
    for poly in polys:
        p = [(x * scale + off, y * scale + off) for x, y in poly]
        for i in range(len(p)):
            x0, y0 = p[i]
            x1, y1 = p[(i + 1) % len(p)]
            if y0 != y1:
                edges.append((x0, y0, x1, y1))
    cov = [[0.0] * S for _ in range(S)]
    inv = 1.0 / ss
    for sy in range(S * ss):
        y = (sy + 0.5) * inv
        xs = []
        for x0, y0, x1, y1 in edges:
            if (y0 <= y < y1) or (y1 <= y < y0):
                xs.append(x0 + (y - y0) / (y1 - y0) * (x1 - x0))
        if len(xs) < 2:
            continue
        xs.sort()
        row = cov[sy // ss]
        for i in range(0, len(xs) - 1, 2):
            a, b = max(xs[i], 0.0), min(xs[i + 1], float(S))
            if b <= a:
                continue
            ia, ib = int(a), min(int(b), S - 1)
            if ia == ib:
                row[ia] += (b - a) * inv
            else:
                row[ia] += (ia + 1 - a) * inv
                for x in range(ia + 1, ib):
                    row[x] += inv
                row[ib] += (b - ib) * inv
    return cov


def paint(buf, cov, colour, S):
    for y in range(S):
        cr, br = cov[y], buf[y]
        for x in range(S):
            a = cr[x]
            if a <= 0.002:
                continue
            a = 1.0 if a > 1 else a
            px = br[x]
            br[x] = tuple(px[i] + (colour[i] - px[i]) * a for i in range(3))


def render(S, mark=1.0, rounded=False, ss=6):
    scale = S / 512.0 * mark
    off = (S - 512.0 * scale) / 2
    buf = [[BG] * S for _ in range(S)]
    if rounded:
        buf = [[(0, 0, 0)] * S for _ in range(S)]
        paint(buf, coverage([round_rect(0, 0, 512, 512, 116)], S, S / 512.0, 0, ss), BG, S)
    paint(buf, coverage([flatten(g) for g in GLYPH], S, scale, off, ss), FG, S)
    for x, y, w, h, r in BARS:
        out = round_rect(x - STROKE, y - STROKE, w + 2 * STROKE, h + 2 * STROKE, r + STROKE)
        paint(buf, coverage([out], S, scale, off, ss), BG, S)
        ins = round_rect(x + STROKE, y + STROKE, w - 2 * STROKE, h - 2 * STROKE, max(0, r - STROKE))
        paint(buf, coverage([ins], S, scale, off, ss), FG, S)
    return buf


def write(path, buf, S):
    raw = b"".join(b"\x00" + bytes(round(v) for px in row for v in px) for row in buf)

    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    out = b"\x89PNG\r\n\x1a\n"
    out += chunk(b"IHDR", struct.pack(">IIBBBBB", S, S, 8, 2, 0, 0, 0))
    out += chunk(b"IDAT", zlib.compress(raw, 9))
    out += chunk(b"IEND", b"")
    pathlib.Path(path).write_bytes(out)
    return len(out)


# home-screen and manifest icons go full bleed, because every OS masks them itself.
# the favicon keeps the rounded tile, since nothing rounds it for us.
JOBS = [
    ("icon-1024.png", 1024, 1.0, False, 4),
    ("icon-512.png", 512, 1.0, False, 6),
    ("maskable-512.png", 512, 0.62, False, 6),
    ("icon-192.png", 192, 1.0, False, 10),
    ("icon-180.png", 180, 1.0, False, 10),
    ("icon-32.png", 32, 1.12, True, 24),
]

for name, size, mark, rounded, ss in JOBS:
    path = f"frontend/assets/icons/{name}"
    n = write(path, render(size, mark, rounded, ss), size)
    print(f"{path}  {size}x{size}  {n / 1024:.1f} KB")
