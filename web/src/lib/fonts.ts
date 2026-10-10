import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import localFont from "next/font/local";

export const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
// A variable font: one file covers every weight, so headings get their face sooner and reflow less.
export const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
// Only used for codes and figures deep inside the app, so it isn't preloaded on every page.
export const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap", preload: false });

// The wordmark face (Cinzel SemiBold, SIL Open Font License; see src/fonts/OFL-Cinzel.txt).
export const cinzel = localFont({ src: "../fonts/Cinzel-SemiBold.ttf", variable: "--font-cinzel", weight: "600", display: "swap" });
