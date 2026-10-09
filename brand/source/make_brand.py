"""Vidyanexa brand: hand-built vector mark + wordmark (Cormorant Garamond outlines, SIL OFL) -> SVG files."""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "pylib"))
from fontTools.pens.svgPathPen import SVGPathPen  # noqa: E402
from fontTools.pens.transformPen import TransformPen  # noqa: E402
from fontTools.ttLib import TTFont  # noqa: E402
from fontTools.varLib.instancer import instantiateVariableFont  # noqa: E402

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "out")
os.makedirs(OUT, exist_ok=True)

# ---- palette ------------------------------------------------------------------------------------
NAVY = "#15233F"      # Ink Navy: primary
GOLD = "#B8893C"      # Antique Gold: accent
GOLD_LIGHT = "#E2BE74"
IVORY = "#F7F2E8"     # Ivory: background


# ---- the mark (512 x 512 design grid) -----------------------------------------------------------
def mark(v_fill: str, flame: str, core: str) -> str:
    """Two open book pages forming a V, a spine gutter between them, and a lamp flame rising from the book."""
    left = "M250 452 L90 150 Q134 128 176 160 L250 322 Z"
    right = "M262 452 L422 150 Q378 128 336 160 L262 322 Z"
    flame_outer = "M256 88 C267 116 288 160 288 214 C288 250 274 274 256 274 C238 274 224 250 224 214 C224 160 245 116 256 88 Z"
    flame_core = "M256 168 C265 188 272 206 272 228 C272 246 265 260 256 260 C247 260 240 246 240 228 C240 206 247 188 256 168 Z"
    return (f'<path d="{left}" fill="{v_fill}"/><path d="{right}" fill="{v_fill}"/>'
            f'<path d="{flame_outer}" fill="{flame}"/><path d="{flame_core}" fill="{core}"/>')


MARK_BOX = (90, 88, 422, 452)  # tight bounds of the mark inside the grid


# ---- wordmark as outlines ------------------------------------------------------------------------
def load_font(path: str, wght: int) -> TTFont:
    f = TTFont(path)
    if "fvar" in f:
        f = instantiateVariableFont(f, {"wght": wght})
    return f


def text_paths(font: TTFont, text: str, size: float, x: float, baseline: float, tracking: float = 0.0, kern: dict | None = None):
    """SVG path data for `text`, left-aligned at (x, baseline). Returns (d, width)."""
    upm = font["head"].unitsPerEm
    scale = size / upm
    cmap, gs, hmtx = font.getBestCmap(), font.getGlyphSet(), font["hmtx"]
    parts, cx = [], x
    prev = None
    for ch in text:
        gname = cmap[ord(ch)]
        if prev and kern and (prev + ch) in kern:
            cx += kern[prev + ch] * size
        pen = SVGPathPen(gs)
        gs[gname].draw(TransformPen(pen, (scale, 0, 0, -scale, cx, baseline)))
        parts.append(pen.getCommands())
        cx += hmtx[gname][0] * scale + tracking * size
        prev = ch
    return " ".join(parts), cx - x - tracking * size


serif = load_font(os.path.join(HERE, "fonts", "CormorantGaramond[wght].ttf"), 600)
sans = load_font(os.path.join(HERE, "fonts", "Inter[opsz,wght].ttf"), 500)
KERN = {"Vi": -0.02, "ya": -0.01, "xa": -0.005}


def svg(w, h, body, bg=None, title="Vidyanexa"):
    rect = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-label="{title}">'
            f'<title>{title}</title>{rect}{body}</svg>')


def place_mark(x, y, height, v, fl, core):
    mx0, my0, mx1, my1 = MARK_BOX
    s = height / (my1 - my0)
    return f'<g transform="translate({x - mx0 * s:.2f} {y - my0 * s:.2f}) scale({s:.4f})">{mark(v, fl, core)}</g>', (mx1 - mx0) * s


def horizontal(word_fill, v, fl, core, tagline=None, tag_fill=None):
    H = 210
    mark_h = 150
    g_mark, mark_w = place_mark(24, (H - mark_h) / 2, mark_h, v, fl, core)
    size = 118
    x = 24 + mark_w + 36
    base = 128 if not tagline else 112
    d, w = text_paths(serif, "Vidyanexa", size, x, base, tracking=0.012, kern=KERN)
    body = g_mark + f'<path d="{d}" fill="{word_fill}"/>'
    width = x + w + 28
    if tagline:
        tsize = 17
        td, tw = text_paths(sans, tagline, tsize, x + 4, base + 54, tracking=0.32)
        body += f'<path d="{td}" fill="{tag_fill}"/>'
        width = max(width, x + 4 + tw + 28)
    return svg(round(width), H, body)


def stacked(word_fill, v, fl, core):
    W, mark_h = 520, 230
    mx0, _, mx1, _ = MARK_BOX
    mw = (mx1 - mx0) * mark_h / (452 - 88)
    g_mark, _ = place_mark((W - mw) / 2, 30, mark_h, v, fl, core)
    size = 96
    _, w = text_paths(serif, "Vidyanexa", size, 0, 0, tracking=0.012, kern=KERN)
    d, _ = text_paths(serif, "Vidyanexa", size, (W - w) / 2, 30 + mark_h + 92, tracking=0.012, kern=KERN)
    return svg(W, 30 + mark_h + 120, g_mark + f'<path d="{d}" fill="{word_fill}"/>')


def icon(bg, v, fl, core, radius=0.22, pad=0.16):
    S = 512
    inner = S * (1 - 2 * pad)
    mx0, my0, mx1, my1 = MARK_BOX
    s = inner / (my1 - my0)
    mw = (mx1 - mx0) * s
    g, _ = place_mark((S - mw) / 2, S * pad, inner, v, fl, core)
    r = S * radius
    return svg(S, S, f'<rect width="{S}" height="{S}" rx="{r}" fill="{bg}"/>' + g)


files = {
    "vidyanexa-logo.svg": horizontal(NAVY, NAVY, GOLD, GOLD_LIGHT),
    "vidyanexa-logo-reverse.svg": horizontal(IVORY, IVORY, GOLD, GOLD_LIGHT),
    "vidyanexa-logo-tagline.svg": horizontal(NAVY, NAVY, GOLD, GOLD_LIGHT, "SCHOOL MANAGEMENT, SIMPLIFIED", GOLD),
    "vidyanexa-logo-stacked.svg": stacked(NAVY, NAVY, GOLD, GOLD_LIGHT),
    "vidyanexa-mark.svg": svg(332, 364, f'<g transform="translate(-90 -88)">{mark(NAVY, GOLD, GOLD_LIGHT)}</g>'),
    "vidyanexa-mark-mono.svg": svg(332, 364, f'<g transform="translate(-90 -88)">{mark(NAVY, NAVY, IVORY)}</g>'),
    "vidyanexa-icon.svg": icon(NAVY, IVORY, GOLD, GOLD_LIGHT),
    "vidyanexa-icon-maskable.svg": icon(NAVY, IVORY, GOLD, GOLD_LIGHT, radius=0, pad=0.26),
}
for name, content in files.items():
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as fh:
        fh.write(content)
print("\n".join(files))
