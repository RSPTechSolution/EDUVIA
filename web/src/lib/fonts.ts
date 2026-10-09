import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import localFont from "next/font/local";

export const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
export const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["500", "600", "700", "800"],
  display: "swap",
});
export const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

// The wordmark face (Cinzel SemiBold, SIL Open Font License; see src/fonts/OFL-Cinzel.txt).
export const cinzel = localFont({ src: "../fonts/Cinzel-SemiBold.ttf", variable: "--font-cinzel", weight: "600", display: "swap" });
