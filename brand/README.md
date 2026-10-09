# Vidyanexa brand: Crest edition

Brand sheet: https://claude.ai/artifact/UX6Y1sqnohs6YvJbXM6x5o (private to the owner until shared).

**The crest:** a shield whose top edge curves like two open book pages meeting at a spine. Inside are an open book, a lamp flame (deepa) rising from it, and a thin gold inner border. It is hand-drawn flat vector geometry on a 512-unit grid. The small version (no inner border, simple flame) is for 48 px and below.

**The wordmark:** "VIDYANEXA" in Cinzel SemiBold capitals, with the tagline "SCHOOL MANAGEMENT" in Cinzel. It is always one word in one colour. Both fonts are under the SIL OFL 1.1 (see `source/fonts/`).

## Colours

| Name | Hex | Use |
|---|---|---|
| Ink Navy | `#15233F` | Primary: the crest, buttons, headings (about 60%) |
| Ivory | `#F7F2E8` | Paper: backgrounds, cards (about 30%) |
| Antique Gold | `#B8893C` | Accent: flame, border, tagline (about 10%) |
| Lamp Glow | `#E2BE74` | The flame's core |
| Slate | `#5B6478` | Secondary text |
| Night | `#0E1729` | Dark-mode background |

## Files

| File | Use |
|---|---|
| `svg/vidyanexa-logo.svg`, `-logo-plain.svg` | Horizontal logo, with and without tagline |
| `svg/vidyanexa-logo-reverse.svg`, `-logo-stacked.svg`, `-logo-stacked-reverse.svg` | Dark backgrounds and square spaces |
| `svg/vidyanexa-crest.svg`, `-crest-reverse.svg`, `-crest-mono.svg`, `-crest-mono-white.svg`, `-crest-small.svg` | The crest alone |
| `svg/vidyanexa-seal.svg` | Certificates, report cards, TCs |
| `svg/vidyanexa-icon*.svg`, `svg/vidyanexa-favicon.svg` | App icons (ivory, navy, maskable, Apple) and favicon |
| `png/` | Exports of the above, including `icon-1024/512/192`, `apple-icon-180` and `favicon-32/16` |
| `source/make_brand.py` | Rebuilds every SVG; needs `fonttools` and the Cinzel variable font |
| `archive/deepa-book/` | The earlier "Deepa Book" design (not in use) |

## Rules

- Write the name as one word, and never split or recolour "NEXA" (keeps clear of Maruti's NEXA).
- Leave clear space equal to the flame's height. Minimum sizes: full logo 140 px wide, crest 16 px (use the small crest below 48 px).
- Don't flatten the shield's top edge, remove the book or flame, or add laurels, ribbons, gradients or shadows.

Before filing the trademark, search IP India and WIPO for similar crests, uploading `png/vidyanexa-crest.png`. Shields with books are common among schools; the book-page top edge is the distinctive feature.
