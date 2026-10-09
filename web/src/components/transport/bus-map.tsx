"use client";

import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap } from "leaflet";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface MapBus { id: string; label: string; lat: number | null; lng: number | null; stale?: boolean; path?: number[][] }
export interface MapStop { name: string; lat: number | null; lng: number | null; mine?: boolean }

const SCHOOL: [number, number] = [30.7333, 76.7794]; // used only when there's nothing to show yet

/** OpenStreetMap with buses (and their recent path) and stops. Leaflet loads in the browser only. */
export function BusMap({ buses, stops = [], className }: { buses: MapBus[]; stops?: MapStop[]; className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<import("leaflet").LayerGroup | null>(null);
  const fitted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current || map.current) return;
      map.current = L.map(el.current, { scrollWheelZoom: false }).setView(SCHOOL, 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors", maxZoom: 19 }).addTo(map.current);
      layer.current = L.layerGroup().addTo(map.current);
      draw(L);
    })();
    return () => { cancelled = true; map.current?.remove(); map.current = null; fitted.current = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    (async () => { if (map.current) draw((await import("leaflet")).default); })();
  }, [buses, stops]); // eslint-disable-line react-hooks/exhaustive-deps

  function draw(L: typeof import("leaflet")) {
    if (!layer.current || !map.current) return;
    layer.current.clearLayers();
    const points: [number, number][] = [];
    for (const s of stops) {
      if (s.lat == null || s.lng == null) continue;
      L.circleMarker([s.lat, s.lng], { radius: s.mine ? 8 : 5, color: s.mine ? "#16a34a" : "#64748b", weight: 2, fillOpacity: 0.8 })
        .bindTooltip(s.name).addTo(layer.current);
      points.push([s.lat, s.lng]);
    }
    for (const b of buses) {
      if (b.path && b.path.length > 1) L.polyline(b.path as [number, number][], { color: "#15233F", weight: 3, opacity: 0.5 }).addTo(layer.current);
      if (b.lat == null || b.lng == null) continue;
      const icon = L.divIcon({
        className: "",
        html: `<div style="background:${b.stale ? "#f59e0b" : "#15233F"};color:#fff;border-radius:9999px;padding:4px 8px;font:600 12px system-ui;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.3)">🚌 ${b.label.replace(/</g, "&lt;")}</div>`,
        iconAnchor: [20, 14],
      });
      L.marker([b.lat, b.lng], { icon }).addTo(layer.current);
      points.push([b.lat, b.lng]);
    }
    if (points.length && !fitted.current) {
      map.current.fitBounds(L.latLngBounds(points).pad(0.3), { maxZoom: 15 });
      fitted.current = true;
    }
  }

  return <div ref={el} className={cn("h-80 w-full overflow-hidden rounded-xl border", className)} role="img" aria-label="Map of buses and stops" />;
}
