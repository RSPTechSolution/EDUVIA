"""Vidyanexa Crest: the full logo set. A shield whose top edge is the open pages of a book, holding an open book and a lamp."""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "pylib"))
from fontTools.pens.svgPathPen import SVGPathPen  # noqa: E402
from fontTools.pens.transformPen import TransformPen  # noqa: E402
from fontTools.ttLib import TTFont  # noqa: E402
from fontTools.varLib.instancer import instantiateVariableFont  # noqa: E402

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
NAVY, GOLD, GLOW, IVORY, WHITE = "#15233F", "#B8893C", "#E2BE74", "#F7F2E8", "#FFFFFF"


def font(name, wght=None):
    f = TTFont(os.path.join(HERE, "fonts", name))
    return instantiateVariableFont(f, {"wght": wght}) if wght and "fvar" in f else f


CINZEL = font("Cinzel[wght].ttf", 600)
CINZEL_TAG = font("Cinzel[wght].ttf", 500)


def glyph(f, ch, size, x, y, rot=0.0):
    s = size / f["head"].unitsPerEm
    gname = f.getBestCmap()[ord(ch)]
    gs = f.getGlyphSet()
    a = math.radians(rot)
    c, si = math.cos(a), math.sin(a)
    pen = SVGPathPen(gs)
    gs[gname].draw(TransformPen(pen, (s * c, s * si, s * si, -s * c, x, y)))
    return pen.getCommands(), f["hmtx"][gname][0] * s


def text(f, t, size, x, y, tracking=0.0):
    parts, cx = [], x
    for ch in t:
        d, adv = glyph(f, ch, size, cx, y)
        parts.append(d)
        cx += adv + tracking * size
    return " ".join(parts), cx - x - tracking * size


def width(f, t, size, tracking=0.0):
    return text(f, t, size, 0, 0, tracking)[1]


# ---- the crest (512 grid; bounds 80..432 x 74..468) -------------------------------------------------
SHIELD = "M80 112 Q168 74 256 110 Q344 74 432 112 L432 252 C432 356 356 428 256 468 C156 428 80 356 80 252 Z"
INNER = "M104 130 Q180 100 256 132 Q332 100 408 130 L408 252 C408 342 342 404 256 440 C170 404 104 342 104 252 Z"
PAGE_L = "M249 350 C218 330 180 324 144 332 L144 246 C180 236 218 242 249 264 Z"
PAGE_R = "M263 350 C294 330 332 324 368 332 L368 246 C332 236 294 242 263 264 Z"
BOX = (80, 74, 432, 468)


def flame(cx=256, top=158, bottom=254, w=24):
    h = bottom - top
    mid = top + h * 0.62
    outer = (f"M{cx} {top} C{cx + w * .35} {top + h * .15} {cx + w} {top + h * .38} {cx + w} {mid} C{cx + w} {bottom - h * .12} {cx + w * .55} {bottom} {cx} {bottom} "
             f"C{cx - w * .55} {bottom} {cx - w} {bottom - h * .12} {cx - w} {mid} C{cx - w} {top + h * .38} {cx - w * .35} {top + h * .15} {cx} {top} Z")
    ct, cw = top + h * .45, w * .5
    ch = bottom - h * .06 - ct
    inner = (f"M{cx} {ct} C{cx + cw * .5} {ct + ch * .25} {cx + cw} {ct + ch * .45} {cx + cw} {ct + ch * .68} C{cx + cw} {ct + ch * .9} {cx + cw * .5} {ct + ch} {cx} {ct + ch} "
             f"C{cx - cw * .5} {ct + ch} {cx - cw} {ct + ch * .9} {cx - cw} {ct + ch * .68} C{cx - cw} {ct + ch * .45} {cx - cw * .5} {ct + ch * .25} {cx} {ct} Z")
    return outer, inner


FLAME, CORE = flame()


def crest(shield=NAVY, border=GOLD, pages=IVORY, fl=GOLD, core=GLOW, detailed=True):
    """detailed=False drops the thin inner border for small sizes (favicons)."""
    out = f'<path d="{SHIELD}" fill="{shield}"/>'
    if detailed:
        out += f'<path d="{INNER}" fill="none" stroke="{border}" stroke-width="6"/>'
    out += f'<path d="{PAGE_L}" fill="{pages}"/><path d="{PAGE_R}" fill="{pages}"/><path d="{FLAME}" fill="{fl}"/>'
    if core:
        out += f'<path d="{CORE}" fill="{core}"/>'
    return out


def crest_mono(ink, uid):
    """One colour: the shield in `ink`, the book and flame cut out so the paper shows through."""
    return (f'<defs><mask id="m{uid}" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">'
            f'<rect width="512" height="512" fill="#fff"/><path d="{INNER}" fill="none" stroke="#000" stroke-width="6"/>'
            f'<path d="{PAGE_L}" fill="#000"/><path d="{PAGE_R}" fill="#000"/><path d="{FLAME}" fill="#000"/></mask></defs>'
            f'<path d="{SHIELD}" fill="{ink}" mask="url(#m{uid})"/>')


# ---- files ---------------------------------------------------------------------------------------------
def svg(w, h, body, label="Vidyanexa"):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" width="{w:.0f}" height="{h:.0f}" role="img" '
            f'aria-label="{label}"><title>{label}</title>{body}</svg>')


def place(body, x, y, height):
    x0, y0, x1, y1 = BOX
    s = height / (y1 - y0)
    return f'<g transform="translate({x - x0 * s:.2f} {y - y0 * s:.2f}) scale({s:.4f})">{body}</g>', (x1 - x0) * s


WORD, TAG = "VIDYANEXA", "SCHOOL MANAGEMENT"


def horizontal(body, word_fill, tag_fill=None):
    H = 220
    mh = 172
    g, mw = place(body, 24, (H - mh) / 2, mh)
    x = 24 + mw + 36
    size = 82
    base = 128 if tag_fill else 140
    d, w = text(CINZEL, WORD, size, x, base, 0.06)
    out, right = g + f'<path d="{d}" fill="{word_fill}"/>', x + w
    if tag_fill:
        tsize = 22
        tw = width(CINZEL_TAG, TAG, tsize, 0.0)
        track = min((w - tw) / (len(TAG) - 1) / tsize, 0.30)  # spaced caps, never wider than the wordmark
        td, _ = text(CINZEL_TAG, TAG, tsize, x, base + 44, track)
        out += f'<path d="{td}" fill="{tag_fill}"/>'
    return svg(right + 30, H, out)


def stacked(body, word_fill, tag_fill):
    W = 560
    mh = 250
    mw = (BOX[2] - BOX[0]) * mh / (BOX[3] - BOX[1])
    g, _ = place(body, (W - mw) / 2, 30, mh)
    size = 66
    w = width(CINZEL, WORD, size, 0.06)
    d, _ = text(CINZEL, WORD, size, (W - w) / 2, 30 + mh + 86, 0.06)
    tsize = 19
    tw = width(CINZEL_TAG, TAG, tsize, 0)
    track = min((w - tw) / (len(TAG) - 1) / tsize, 0.30)
    tw2 = width(CINZEL_TAG, TAG, tsize, track)
    td, _ = text(CINZEL_TAG, TAG, tsize, (W - tw2) / 2, 30 + mh + 124, track)
    return svg(W, 30 + mh + 150, g + f'<path d="{d}" fill="{word_fill}"/><path d="{td}" fill="{tag_fill}"/>')


def mark(body, pad=0):
    x0, y0, x1, y1 = BOX
    return svg(x1 - x0 + 2 * pad, y1 - y0 + 2 * pad, f'<g transform="translate({pad - x0} {pad - y0})">{body}</g>')


def icon(bg, body, radius=0.22, scale=0.74):
    S = 512
    x0, y0, x1, y1 = BOX
    s = S * scale / (y1 - y0)
    tx, ty = (S - (x1 - x0) * s) / 2 - x0 * s, (S - (y1 - y0) * s) / 2 - y0 * s
    bgr = f'<rect width="{S}" height="{S}" rx="{S * radius}" fill="{bg}"/>' if bg else ""
    return svg(S, S, bgr + f'<g transform="translate({tx:.2f} {ty:.2f}) scale({s:.4f})">{body}</g>')


def seal():
    """Certificate seal: the crest inside a ring with the name and tagline."""
    S, R = 600, 300
    out = [f'<circle cx="{R}" cy="{R}" r="292" fill="{NAVY}"/>', f'<circle cx="{R}" cy="{R}" r="280" fill="none" stroke="{GOLD}" stroke-width="3"/>',
           f'<circle cx="{R}" cy="{R}" r="206" fill="none" stroke="{GOLD}" stroke-width="3"/>']

    def arc(t, size, radius, centre_deg, top, tracking):
        ws = [glyph(CINZEL, ch, size, 0, 0)[1] for ch in t]
        total = sum(ws) + tracking * size * (len(t) - 1)
        span = total / radius
        start = math.radians(centre_deg) - (span / 2 if top else -span / 2)
        ps, pos = [], 0.0
        for ch, w in zip(t, ws):
            a = start + (pos + w / 2) / radius * (1 if top else -1)
            cx_, cy_ = R + radius * math.cos(a), R + radius * math.sin(a)
            rot = math.degrees(a) + (90 if top else -90)
            ps.append(glyph(CINZEL, ch, size, cx_ - w / 2 * math.cos(math.radians(rot)), cy_ - w / 2 * math.sin(math.radians(rot)), rot)[0])
            pos += w + tracking * size
        return f'<path d="{" ".join(ps)}" fill="{IVORY}"/>'
    out.append(arc(WORD, 40, 228, -90, True, 0.16))
    out.append(arc(TAG, 24, 258, 90, False, 0.18))
    for ang in (180, 0):  # small gold diamonds separating the two lines of text
        a = math.radians(ang)
        cx_, cy_ = R + 244 * math.cos(a), R + 244 * math.sin(a)
        out.append(f'<path d="M{cx_ - 7} {cy_} L{cx_} {cy_ - 7} L{cx_ + 7} {cy_} L{cx_} {cy_ + 7} Z" fill="{GOLD}"/>')
    g, mw = place(crest(shield=IVORY, border=GOLD, pages=NAVY), 0, 0, 250)
    out.append(f'<g transform="translate({R - mw / 2:.2f} {R - 125})">{g}</g>')
    return svg(S, S, "".join(out), "Vidyanexa seal")


FILES = {
    "vidyanexa-logo.svg": horizontal(crest(), NAVY, GOLD),
    "vidyanexa-logo-plain.svg": horizontal(crest(), NAVY),
    "vidyanexa-logo-reverse.svg": horizontal(crest(shield=IVORY, pages=NAVY), IVORY, GOLD),
    "vidyanexa-logo-stacked.svg": stacked(crest(), NAVY, GOLD),
    "vidyanexa-logo-stacked-reverse.svg": stacked(crest(shield=IVORY, pages=NAVY), IVORY, GOLD),
    "vidyanexa-crest.svg": mark(crest()),
    "vidyanexa-crest-reverse.svg": mark(crest(shield=IVORY, pages=NAVY)),
    "vidyanexa-crest-mono.svg": mark(crest_mono(NAVY, "n")),
    "vidyanexa-crest-mono-white.svg": mark(crest_mono(WHITE, "w")),
    "vidyanexa-crest-small.svg": mark(crest(detailed=False, core=None)),
    "vidyanexa-icon.svg": icon(IVORY, crest()),
    "vidyanexa-icon-navy.svg": icon(NAVY, crest(shield=IVORY, pages=NAVY)),
    "vidyanexa-icon-maskable.svg": icon(IVORY, crest(), radius=0, scale=0.56),
    "vidyanexa-icon-apple.svg": icon(IVORY, crest(), radius=0, scale=0.74),
    "vidyanexa-favicon.svg": icon(None, crest(detailed=False, core=None), radius=0, scale=0.96),
    "vidyanexa-seal.svg": seal(),
}
for name, content in FILES.items():
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as fh:
        fh.write(content)
print("\n".join(FILES))
