"use client";

import { Camera, CameraOff, CheckCircle2, Clock, QrCode, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGate } from "@/components/common/permission-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, api, fileUrl } from "@/lib/api/client";
import type { ScanResult } from "@/lib/api/types";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

type Item = (ScanResult & { ok: true }) | { ok: false; code: string; message: string; time: string };

interface Detector { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> }
declare global { interface Window { BarcodeDetector?: new (opts: { formats: string[] }) => Detector } }

function ScanPage() {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const last = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const [camera, setCamera] = useState<"off" | "on" | "unsupported" | "denied">("off");
  const [code, setCode] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const busy = useRef(false);

  const submit = useCallback(async (raw: string) => {
    const value = raw.trim();
    if (!value || busy.current) return;
    // The camera sees the same card many times a second: ignore repeats for a few seconds.
    if (last.current.code === value && Date.now() - last.current.at < 4000) return;
    last.current = { code: value, at: Date.now() };
    busy.current = true;
    try {
      const { data } = await api<ScanResult>("/attendance/scan", { method: "POST", body: { code: value } });
      setItems((x) => [{ ...data, ok: true as const }, ...x].slice(0, 30));
      navigator.vibrate?.(60);
    } catch (e) {
      setItems((x) => [{ ok: false as const, code: value, message: e instanceof ApiError ? e.message : "Could not record", time: new Date().toISOString() }, ...x].slice(0, 30));
    } finally {
      busy.current = false;
    }
  }, []);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setCamera((c) => (c === "on" ? "off" : c));
  }, []);

  async function start() {
    if (!window.BarcodeDetector || !navigator.mediaDevices?.getUserMedia) { setCamera("unsupported"); return; }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (video.current) { video.current.srcObject = stream.current; await video.current.play(); }
      setCamera("on");
    } catch {
      setCamera("denied");
    }
  }

  useEffect(() => {
    if (camera !== "on" || !window.BarcodeDetector) return;
    const detector = new window.BarcodeDetector({ formats: ["qr_code", "code_128"] });
    let alive = true;
    const tick = async () => {
      if (!alive || !video.current) return;
      try {
        const found = await detector.detect(video.current);
        if (found[0]?.rawValue) await submit(found[0].rawValue);
      } catch { /* frame not ready */ }
      if (alive) setTimeout(tick, 350);
    };
    tick();
    return () => { alive = false; };
  }, [camera, submit]);

  useEffect(() => stop, [stop]);

  const today = items.filter((i) => i.ok).length;
  return (
    <>
      <PageHeader title="Scan ID cards" description="Point the camera at a student's ID card, or type the admission number. They're marked present for today (late after the cut-off)." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="relative aspect-video overflow-hidden rounded-2xl border bg-black">
            <video ref={video} className={cn("size-full object-cover", camera !== "on" && "hidden")} muted playsInline aria-label="Camera" />
            {camera !== "on" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white/80">
                <QrCode className="size-12" aria-hidden />
                <p className="text-sm">
                  {camera === "unsupported" ? "This browser can't read QR codes from the camera. Use Chrome or Edge, or type the number below." :
                   camera === "denied" ? "Camera permission was refused. Allow it in the browser's address bar, or type the number below." :
                   "Start the camera to scan cards."}
                </p>
              </div>
            )}
            {camera === "on" && <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-2 border-white/70" aria-hidden />}
          </div>
          <div className="flex flex-wrap gap-2">
            {camera === "on" ? <Button variant="outline" onClick={stop}><CameraOff aria-hidden />Stop camera</Button>
              : <Button onClick={start}><Camera aria-hidden />Start camera</Button>}
            <form className="flex flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); submit(code); setCode(""); }}>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Admission number" aria-label="Admission number" className="min-w-40" />
              <Button type="submit" variant="outline" disabled={!code.trim()}>Mark present</Button>
            </form>
          </div>
        </div>
        <section aria-label="Scanned" aria-live="polite">
          <h2 className="mb-2 font-semibold">Scanned this session <span className="text-muted-foreground">({today})</span></h2>
          {items.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Scans appear here.</p> : (
            <ul className="space-y-2">
              {items.map((i, n) => i.ok ? (
                <li key={`${i.student_id}-${i.time}-${n}`} className={cn("flex items-center gap-3 rounded-xl border p-3", n === 0 && "border-success/50 bg-success/5")}>
                  <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {i.photo_file_id ? <img src={fileUrl(i.photo_file_id)} alt="" className="size-full object-cover" /> : initials(i.name)} {/* eslint-disable-line @next/next/no-img-element */}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{i.name}</span>
                    <span className="block text-xs text-muted-foreground">{i.class_section}{i.already ? " · already in" : ""}</span>
                  </span>
                  <span className={cn("flex items-center gap-1 text-sm font-semibold capitalize", i.status === "late" ? "text-warning" : "text-success")}>
                    {i.status === "late" ? <Clock className="size-4" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}{i.status}
                  </span>
                </li>
              ) : (
                <li key={`${i.code}-${i.time}`} className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <XCircle className="size-5 shrink-0 text-destructive" aria-hidden /><span><span className="font-mono">{i.code}</span>: {i.message}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

export default function Page() {
  return <PermissionGate permission="attendance.scan"><ScanPage /></PermissionGate>;
}
