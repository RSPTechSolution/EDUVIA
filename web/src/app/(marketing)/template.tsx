import { PageTransition } from "@/components/motion/primitives";

/** A template (unlike a layout) is re-created on every navigation, so each public page plays the page transition. */
export default function MarketingTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
