/** A page's search params, as the server component receives them. */
export type PageQuery = Record<string, string | string[] | undefined>;

/** The server's search params as URLSearchParams, so a client form can read them while being rendered on the server
 *  (useSearchParams would hold the form back until the browser runs JavaScript, and the page would jump). */
export function toSearchParams(query: PageQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, v);
  }
  return params;
}
