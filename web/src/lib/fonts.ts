import { JetBrains_Mono, Lexend } from "next/font/google";
import localFont from "next/font/local";

// Theme version 2: one typeface for text and headings. This is the only place to change it;
// globals.css reads it through --font-ui (body) and --font-heading.
// A variable font: one file covers every weight, so headings get their face sooner and reflow less.
export const ui = Lexend({ subsets: ["latin"], variable: "--font-ui", display: "swap", adjustFontFallback: true });
// Only used for codes and figures deep inside the app, so it isn't preloaded on every page.
export const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap", preload: false });

// The wordmark face (Cinzel SemiBold, SIL Open Font License; see src/fonts/OFL-Cinzel.txt).
export const cinzel = localFont({ src: "../fonts/Cinzel-SemiBold.ttf", variable: "--font-cinzel", weight: "600", display: "swap" });
