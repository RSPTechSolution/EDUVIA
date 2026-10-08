/** Download a file from the API (through the session proxy) and save it with the server's filename. */
export async function downloadFile(path: string, fallbackName: string) {
  const res = await fetch(`/api/proxy${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? "Could not download the file");
  }
  const name = /filename="?([^"]+)"?/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? fallbackName;
  saveBlob(await res.blob(), name);
}

export function saveBlob(blob: Blob, name: string) {
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** CSV text (with a BOM so Excel reads non-English names correctly). */
export function csvBlob(header: string[], rows: (string | number | null)[][]) {
  const cell = (v: string | number | null) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  return new Blob(["﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
}

/** POST to the API and save the file it returns (e.g. a PDF built from the posted choices). */
export async function postDownload(path: string, body: unknown, fallbackName: string) {
  const res = await fetch(`/api/proxy${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error?.message ?? "Could not create the file");
  }
  const name = /filename="?([^"]+)"?/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? fallbackName;
  saveBlob(await res.blob(), name);
}
