# Vidyanexa brand

Brand sheet: logo, meaning, colours, type and usage rules. Open it at https://claude.ai/artifact/UX6Y1sqnohs6YvJbXM6x5o (private to the owner until shared).

**The mark:** two open book pages form the V. Between them is a thin spine gutter, and a lamp flame (deepa) rises from the book. It is hand-drawn flat vector geometry on a 512-unit grid.

**The wordmark:** "Vidyanexa", always one word in one colour, set in Cormorant Garamond SemiBold (SIL OFL 1.1, see `source/fonts/`).

## Colours

| Name | Hex | Use |
|---|---|---|
| Ink Navy | `#15233F` | Primary: logo, buttons, headings (about 60%) |
| Ivory | `#F7F2E8` | Paper: backgrounds, cards (about 30%) |
| Antique Gold | `#B8893C` | Accent: the flame, highlights (about 10%) |
| Lamp Glow | `#E2BE74` | The flame's core; soft gold highlights |
| Slate | `#5B6478` | Secondary text |
| Night | `#0E1729` | Dark-mode background |

## Rules

- Write the name as one word, and never split or recolour "nexa" (keeps clear of Maruti's NEXA).
- Leave clear space equal to the flame's height. Minimum sizes: icon 16 px, full logo 120 px wide.
- Don't add gradients, glows or shadows, don't re-type the wordmark, and don't recolour the flame.

## Files

- `svg/`: logo, reverse, tagline, stacked, mark, one-colour mark, app icon, maskable icon.
- `png/`: exports for app stores, Android, iOS and favicons.
- `source/make_brand.py`: regenerates the SVGs. It needs `fonttools` and the Cormorant Garamond and Inter variable fonts from Google Fonts (OFL).
