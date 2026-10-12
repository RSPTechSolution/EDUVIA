/** GST on Vidyanexa's own prices (plans and subscriptions). Prices are quoted without GST; 18% is added on top. */
export const GST_RATE = 0.18;

/** The plan price, the GST on it and the total, in rupees and paise. */
export function withGst(base: number, rate = GST_RATE) {
  const gst = Math.round(base * rate * 100) / 100;
  return { base, gst, total: Math.round((base + gst) * 100) / 100, rate };
}
