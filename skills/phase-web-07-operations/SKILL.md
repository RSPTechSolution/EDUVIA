---
name: schoolerp-web-phase-07-operations
description: >
  Web Phase 7 — Operations modules: Transport live ops (Leaflet map, Socket.io
  bus icons), HR & payroll dashboard, Library management, Hostel room grid,
  Gate Pass kiosk terminal, Inventory tracker, Asset register, Compliance vault.
  Use when building any operations module page.
---

# Web Phase 7 — Operations Modules
## Leaflet · Socket.io · Recharts · Next.js 15

---

## Transport Live Ops `/transport/live`

```tsx
// Full-height split: Left = Leaflet map (2/3) + Right = Trip list panel (1/3)
// Map shows all active bus icons with real-time movement via Socket.io
// Click bus icon → trip detail popup with driver, route, boarding progress

'use client';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

// Custom bus icon SVG (color-coded by trip status)
const createBusIcon = (color: string) => L.divIcon({
  html: `<div style="background:${color};width:36px;height:36px;border-radius:50%;
    border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3);
    display:flex;align-items:center;justify-content:center;font-size:16px">🚌</div>`,
  className: '',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -20],
});

export function LiveTransportMap() {
  const [trips, setTrips] = useState<LiveTrip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<string | null>(null);

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_API_URL!, {
      auth: { token: getAccessToken() },
    });
    socket.emit('join_room', 'transport_live');
    socket.on('trip_update', (data: TripUpdate) => {
      setTrips(prev => prev.map(t =>
        t.id === data.trip_id ? { ...t, lat: data.lat, lng: data.lng, speed: data.speed } : t
      ));
    });
    return () => socket.disconnect();
  }, []);

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0">
      {/* Map — 2/3 width */}
      <div className="flex-1 relative">
        <MapContainer
          center={[20.5937, 78.9629]}
          zoom={12}
          className="h-full w-full"
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
          />
          {trips.map(trip => (
            <Marker
              key={trip.id}
              position={[trip.lat, trip.lng]}
              icon={createBusIcon(trip.has_sos ? '#EF4444' : '#1A6FE8')}
              eventHandlers={{ click: () => setSelectedTrip(trip.id) }}
            >
              <Popup>
                <div className="min-w-[180px]">
                  <p className="font-semibold">{trip.route_name}</p>
                  <p className="text-xs text-gray-500">Driver: {trip.driver_name}</p>
                  <p className="text-xs text-gray-500">Speed: {trip.speed?.toFixed(1)} km/h</p>
                  <p className="text-xs text-gray-500">
                    Boarded: {trip.boarded_count}/{trip.total_students}
                  </p>
                  {trip.has_sos && (
                    <div className="mt-2 rounded bg-red-50 p-1.5 text-xs text-red-600 font-semibold">
                      🚨 SOS Active
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
          {/* Route polyline for selected trip */}
          {selectedTrip && (
            <Polyline
              positions={trips.find(t => t.id === selectedTrip)?.route_coords ?? []}
              color="hsl(var(--primary))"
              weight={3}
              dashArray="6 4"
            />
          )}
        </MapContainer>

        {/* Map overlay controls */}
        <div className="absolute right-4 top-4 z-[1000] flex flex-col gap-2">
          <Button size="sm" variant="secondary" className="shadow-lg" onClick={fitBounds}
            aria-label="Fit all buses on screen">
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Active trips count */}
        <div className="absolute left-4 top-4 z-[1000]">
          <div className="flex items-center gap-2 rounded-xl bg-card/90 backdrop-blur px-3 py-2 shadow-lg border border-border">
            <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <span className="text-sm font-medium">{trips.length} active trips</span>
          </div>
        </div>
      </div>

      {/* Trip list panel — 1/3 width */}
      <div className="w-80 xl:w-96 border-l border-border bg-card overflow-y-auto">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Active Trips</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {format(new Date(), 'EEEE, d MMMM yyyy • h:mm a')}
          </p>
        </div>
        {trips.length === 0 ? (
          <EmptyState icon={Bus} title="No active trips" description="All buses have completed their routes." className="py-12" />
        ) : (
          <div className="divide-y divide-border">
            {trips.map(trip => (
              <button key={trip.id}
                onClick={() => setSelectedTrip(trip.id === selectedTrip ? null : trip.id)}
                className={cn(
                  'w-full text-left px-4 py-3.5 transition-colors',
                  'hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring focus-visible:outline-none',
                  selectedTrip === trip.id && 'bg-accent/50',
                )}
                aria-pressed={selectedTrip === trip.id}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm',
                    trip.has_sos ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary',
                  )}>
                    {trip.has_sos ? '🚨' : '🚌'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{trip.route_name}</p>
                    <p className="text-xs text-muted-foreground">{trip.driver_name}</p>
                    <div className="mt-1.5 flex items-center gap-3">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        <span>{trip.boarded_count}/{trip.total_students}</span>
                      </div>
                      {trip.speed !== null && (
                        <span className="text-xs text-muted-foreground">{trip.speed.toFixed(0)} km/h</span>
                      )}
                    </div>
                    {/* Boarding progress bar */}
                    <Progress
                      value={(trip.boarded_count / trip.total_students) * 100}
                      className="mt-1.5 h-1"
                    />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## HR & Payroll `/hr`

### Staff List Page
```tsx
// DataTable with: photo, name, employee ID, designation, department,
//   joining date, salary (masked by default), status, actions
// Quick stats: Total staff / On leave today / Present / Payroll due date
// Filters: department, designation, status, join date range

// Salary column — masked with toggle
const SalaryCell = ({ value }: { value: number }) => {
  const [revealed, setRevealed] = useState(false);
  return (
    <button onClick={() => setRevealed(p => !p)}
      className="flex items-center gap-1.5 text-sm font-medium tabular-nums group"
      aria-label={revealed ? 'Hide salary' : 'Show salary'}>
      {revealed ? (
        <span>₹{value.toLocaleString('en-IN')}</span>
      ) : (
        <span className="text-muted-foreground tracking-widest">••••••</span>
      )}
      {revealed
        ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" aria-hidden />
        : <Eye className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" aria-hidden />
      }
    </button>
  );
};
```

### Payroll Run Dashboard
```tsx
// Month + Year picker → "Run Payroll" button → progress dialog
// Results: table with staff name, days, gross, deductions, net
// Finalize button → locks payroll → enables Download Salary Slips + Bank Advice
// Status badges: Draft / Generated / Finalized / Paid

// Payroll progress dialog
<Dialog open={isRunning}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Running Payroll — {monthYear}</DialogTitle>
    </DialogHeader>
    <div className="space-y-4 py-2">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <Calculator className="h-5 w-5 text-primary animate-pulse" />
        </div>
        <div>
          <p className="text-sm font-medium">Calculating salaries...</p>
          <p className="text-xs text-muted-foreground">{processed} of {total} staff processed</p>
        </div>
      </div>
      <Progress value={(processed / total) * 100} className="h-2" />
    </div>
  </DialogContent>
</Dialog>
```

---

## Gate Pass Terminal `/security/gate-terminal`

```tsx
// Full-screen kiosk mode — designed for a tablet at the school gate
// Uses the camera via getUserMedia → QR scanner overlay
// On scan: large overlay with result (green/red)

'use client';
import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

export function GateTerminal() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [result, setResult] = useState<GateScanResult | null>(null);
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => { if (videoRef.current) videoRef.current.srcObject = stream; });
  }, []);

  const scan = () => {
    if (!scanning || !videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, canvas.width, canvas.height);
    if (code?.data) processQr(code.data);
    requestAnimationFrame(scan);
  };

  const processQr = async (token: string) => {
    setScanning(false);
    const res = await api.post('/api/v1/security/gate-passes/scan', { qr_token: token });
    setResult(res.data);
    setTimeout(() => { setResult(null); setScanning(true); }, 4000);
  };

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden">
      <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
      <canvas ref={canvasRef} className="hidden" />

      {/* Scanner overlay */}
      {scanning && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative h-64 w-64">
            <div className="absolute inset-0 rounded-2xl border-2 border-white/80" />
            {/* Corner accents */}
            {['top-0 left-0','top-0 right-0','bottom-0 left-0','bottom-0 right-0'].map((pos, i) => (
              <div key={i} className={`absolute ${pos} h-8 w-8 border-4 border-primary rounded-sm`}
                style={{ borderRadius: i === 0 ? '8px 0 0 0' : i === 1 ? '0 8px 0 0' : i === 2 ? '0 0 0 8px' : '0 0 8px 0' }} />
            ))}
            {/* Scanning line animation */}
            <div className="absolute left-2 right-2 h-0.5 bg-primary/80 animate-[scanline_2s_ease-in-out_infinite]" />
          </div>
          <p className="absolute bottom-1/4 text-white/80 text-sm">Scan Gate Pass QR Code</p>
        </div>
      )}

      {/* Result overlay */}
      {result && (
        <div className={cn(
          'absolute inset-0 flex flex-col items-center justify-center gap-6 transition-all',
          result.status === 'approved' ? 'bg-success/90' : 'bg-destructive/90',
        )}>
          {result.person?.photo && (
            <img src={result.person.photo} alt={result.person?.name}
              className="h-32 w-32 rounded-full border-4 border-white object-cover shadow-xl" />
          )}
          <div className="text-center text-white">
            <p className="text-4xl font-bold">{result.person?.name ?? 'Unknown'}</p>
            <p className="text-xl mt-1 opacity-80">
              {result.status === 'approved' ? '✓ Gate Pass Valid — Exit Approved' : `✗ ${result.message}`}
            </p>
          </div>
          <div className={cn(
            'rounded-full p-6',
            result.status === 'approved' ? 'bg-white/20' : 'bg-white/20',
          )}>
            {result.status === 'approved'
              ? <CheckCircle2 className="h-20 w-20 text-white" />
              : <XCircle className="h-20 w-20 text-white" />
            }
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Library `/library`

```tsx
// Catalog page: card grid OR table toggle
// Book card: cover image (from Open Library) + title + author + available copies badge
// Issue book: barcode input (auto-focus) → lookup copy → member search → issue dialog
// Return book: barcode input → show issue details + fine calculation → return button

// Issue dialog
<Dialog>
  <DialogContent className="sm:max-w-sm">
    <DialogHeader><DialogTitle>Issue Book</DialogTitle></DialogHeader>
    <div className="flex gap-4">
      <img src={book.cover_url} alt={book.title}
        className="h-24 w-16 rounded object-cover shadow" />
      <div>
        <p className="font-semibold">{book.title}</p>
        <p className="text-sm text-muted-foreground">{book.author}</p>
        <p className="text-xs font-mono mt-1 text-muted-foreground">#{copy.barcode}</p>
      </div>
    </div>
    <div className="space-y-2">
      <Label>Issue To</Label>
      <MemberSearch onSelect={setMember} />  {/* combobox searching students + staff */}
      <Label>Due Date</Label>
      <DatePicker value={dueDate} onChange={setDueDate} />
    </div>
    <DialogFooter>
      <Button onClick={issueBook} disabled={!member}>Issue Book</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Hostel `/hostel`

```tsx
// Room grid: Block tabs → Floor accordion → Room cards
// Room card: room number, type badge, occupancy bar (6/10)
// Click room → occupant list sheet with allocate/deallocate actions

// Room card
<div className={cn(
  'rounded-xl border-2 p-4 cursor-pointer transition-all',
  'hover:border-primary/40 hover:shadow-hover',
  room.occupancy >= room.capacity
    ? 'border-destructive/30 bg-destructive/5'
    : room.occupancy > 0
    ? 'border-success/30 bg-success/5'
    : 'border-border bg-card',
)}>
  <div className="flex items-start justify-between mb-3">
    <div>
      <p className="font-semibold text-foreground">{room.room_number}</p>
      <Badge variant="outline" className="text-[10px] mt-1">{room.room_type}</Badge>
    </div>
    <span className={cn(
      'text-xs font-bold tabular-nums',
      room.occupancy >= room.capacity ? 'text-destructive' : 'text-muted-foreground',
    )}>
      {room.occupancy}/{room.capacity}
    </span>
  </div>
  <Progress
    value={(room.occupancy / room.capacity) * 100}
    className={cn('h-2',
      room.occupancy >= room.capacity ? '[&>div]:bg-destructive' : '[&>div]:bg-success'
    )}
    aria-label={`${room.occupancy} of ${room.capacity} beds occupied`}
  />
</div>
```

---

## Antigravity Prompt for Web Phase 7

```
@file skills/master-plan/SKILL.md
@file skills/phase-web-07-operations/SKILL.md

Build Web Phase 7 — Operations:
1. Transport live ops page: Leaflet map (react-leaflet + OpenStreetMap) with
   Socket.io real-time bus icons (color: blue=active, red=SOS),
   trip detail popup, route polyline for selected trip, right panel trip list
2. Route builder page: Leaflet click-to-add stops, stop list with drag-reorder,
   expected time per stop, save route button
3. HR staff list: DataTable with masked salary cell (toggle reveal), dept filter
4. Payroll run dashboard: month picker, run button, progress dialog, results table,
   download salary slips + bank advice Excel buttons
5. Gate pass list (admin): pending table with approve/reject buttons + reason
6. Gate terminal page: full-screen jsQR camera scanner, green/red result overlay,
   4-second auto-reset, accessibility: aria-live="assertive" on result
7. Library catalog: card grid + table toggle, barcode issue flow, return + fine dialog
8. Hostel room grid: block tabs, floor accordion, room cards with occupancy bar
9. Compliance vault: document list with expiry countdown chips, upload dialog
10. Inventory tracker: stock table, low-stock highlighted rows, purchase order form
11. Run: pnpm build && pnpm test
```
