# regenerates assets/icons from scratch: python3 tools/make-icons.py
import zlib, struct, pathlib

BG = (11, 11, 13)
FG = (245, 245, 244)
SS = 4  # supersample

def rrect(px, py, x0, y0, x1, y1, r):
    cx = min(max(px, x0 + r), x1 - r)
    cy = min(max(py, y0 + r), y1 - r)
    return (px - cx) ** 2 + (py - cy) ** 2 <= r * r

def shapes(S, pad):
    inner = S - 2 * pad
    cx, cy = S / 2, S / 2
    bar_h = inner * 0.085
    bar_w = inner * 0.60
    out = [(cx - bar_w / 2, cy - bar_h / 2, cx + bar_w / 2, cy + bar_h / 2, bar_h / 2)]
    for sign in (-1, 1):
        ox = cx + sign * inner * 0.315
        pw, ph = inner * 0.088, inner * 0.46
        out.append((ox - pw / 2, cy - ph / 2, ox + pw / 2, cy + ph / 2, pw * 0.34))
        ix = cx + sign * inner * 0.205
        iw, ih = inner * 0.070, inner * 0.30
        out.append((ix - iw / 2, cy - ih / 2, ix + iw / 2, cy + ih / 2, iw * 0.34))
    return out

def render(S, pad_ratio=0.20):
    pad = S * pad_ratio
    sh = shapes(S, pad)
    rows = []
    for y in range(S):
        row = bytearray()
        for x in range(S):
            hits = 0
            for sy in range(SS):
                py = y + (sy + 0.5) / SS
                for sx in range(SS):
                    px = x + (sx + 0.5) / SS
                    if any(rrect(px, py, *s) for s in sh):
                        hits += 1
            a = hits / (SS * SS)
            row += bytes(round(BG[i] + (FG[i] - BG[i]) * a) for i in range(3))
        rows.append(row)
    return rows

def png(path, S, pad_ratio=0.20):
    rows = render(S, pad_ratio)
    raw = b"".join(b"\x00" + bytes(r) for r in rows)
    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)
    out = b"\x89PNG\r\n\x1a\n"
    out += chunk(b"IHDR", struct.pack(">IIBBBBB", S, S, 8, 2, 0, 0, 0))
    out += chunk(b"IDAT", zlib.compress(raw, 9))
    out += chunk(b"IEND", b"")
    pathlib.Path(path).write_bytes(out)
    return len(out)

for size, pad in [(180, 0.09), (192, 0.09), (512, 0.09), (1024, 0.09), (256, 0.24)]:
    name = "assets/icons/maskable-256.png" if size == 256 else f"assets/icons/icon-{size}.png"
    n = png(name, size, pad)
    print(f"{name}  {size}x{size}  {n/1024:.1f} KB")
