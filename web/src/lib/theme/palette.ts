import { Hct, MaterialDynamicColors as C, SchemeTonalSpot, argbFromHex, hexFromArgb, type DynamicColor } from "@material/material-color-utilities";

/** The default navy: the hand-tuned palette in globals.css. Both the old and new navy mean "no school colour". */
export const DEFAULT_ACCENTS = ["#15233f", "#2f4a86"];

/**
 * A school's accent colour turned into the full Material 3 palette, in light and dark, as CSS that overrides the theme
 * tokens in globals.css. The same tokens drive every component, so buttons, the sidebar, cards, panels and charts all
 * follow the school's colour while text keeps its contrast.
 */
export function accentCss(hex: string): string | null {
  if (!/^#[0-9a-f]{6}$/i.test(hex) || DEFAULT_ACCENTS.includes(hex.toLowerCase())) return null;
  const block = (dark: boolean) => Object.entries(accentTokens(hex, dark)).map(([k, v]) => `--${k}:${v}`).join(";");
  return `:root{${block(false)}}.dark{${block(true)}}`;
}

/** The theme tokens for an accent colour in one mode, e.g. for a live preview as inline CSS variables. */
export function accentTokens(hex: string, dark: boolean): Record<string, string> {
  const source = Hct.fromInt(argbFromHex(hex));
  const s = new SchemeTonalSpot(source, dark, 0);
  const c = (role: DynamicColor) => hexFromArgb(role.getArgb(s));
  const tokens: Record<string, string> = {
    background: c(C.surface),
    foreground: c(C.onSurface),
    card: c(dark ? C.surfaceContainerLow : C.surfaceContainerLowest),
    "card-foreground": c(C.onSurface),
    popover: c(dark ? C.surfaceContainer : C.surfaceContainerLow),
    "popover-foreground": c(C.onSurface),
    primary: c(C.primary),
    "primary-foreground": c(C.onPrimary),
    "primary-container": c(C.primaryContainer),
    "primary-container-foreground": c(C.onPrimaryContainer),
    secondary: c(C.secondaryContainer),
    "secondary-foreground": c(C.onSecondaryContainer),
    muted: c(C.surfaceContainer),
    "muted-foreground": c(C.onSurfaceVariant),
    accent: c(C.surfaceContainerHigh),
    "accent-foreground": c(C.onSurface),
    border: c(C.outlineVariant),
    input: c(C.outline),
    ring: c(C.primary),
    "chart-1": c(C.primary),
    sidebar: c(C.surfaceContainerLow),
    "sidebar-foreground": c(C.onSurface),
    "sidebar-muted": c(C.onSurfaceVariant),
    "sidebar-primary": c(C.secondaryContainer),
    "sidebar-primary-foreground": c(C.onSecondaryContainer),
    "sidebar-accent": c(C.surfaceContainerHigh),
    "sidebar-accent-foreground": c(C.onSurface),
    "sidebar-border": c(C.surfaceContainerHighest),
    "sidebar-ring": c(C.primary),
    // Solid panels carry white text, so they use a deep tone of the accent in both modes.
    panel: hexFromArgb(Hct.from(source.hue, Math.min(source.chroma, 60), dark ? 30 : 35).toInt()),
    "panel-foreground": "#ffffff",
    "panel-muted": c(dark ? C.onPrimaryContainer : C.primaryContainer),
  };
  return tokens;
}
