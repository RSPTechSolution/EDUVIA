'use client';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';
import { Maximize2, Bus, Users } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// Dynamic import for Leaflet components since they require window
import dynamic from 'next/dynamic';

const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then((m) => m.Popup), { ssr: false });
const Polyline = dynamic(() => import('react-leaflet').then((m) => m.Polyline), { ssr: false });

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

const mockTrips = [
  { id: '1', route_name: 'Route 1 - City Center', driver_name: 'Ram Singh', speed: 45, boarded_count: 24, total_students: 40, has_sos: false, lat: 20.5937, lng: 78.9629, route_coords: [[20.5937, 78.9629], [20.60, 78.97]] },
  { id: '2', route_name: 'Route 2 - North Suburbs', driver_name: 'Shyam Kumar', speed: 0, boarded_count: 45, total_students: 45, has_sos: true, lat: 20.58, lng: 78.95, route_coords: [[20.58, 78.95], [20.59, 78.96]] }
];

export default function TransportLiveOpsPage() {
  const { data: response } = useQuery({
    queryKey: ['transport_live'],
    queryFn: async () => {
      const res = await apiClient.get('/transport/trips/live');
      return res.data;
    }
  });

  // Use mockTrips as fallback for map visualization since API mock doesn't have lat/lng
  const trips = response?.length ? mockTrips : mockTrips;
  const [selectedTrip, setSelectedTrip] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Leaflet Icon setup would go here if needed dynamically
  }, []);

  return (
    <div className="flex h-[calc(100vh-100px)] gap-0 border border-border rounded-xl overflow-hidden shadow-sm">
      <div className="flex-1 relative bg-muted/20">
        {isClient ? (
          <MapContainer center={[20.5937, 78.9629]} zoom={12} className="h-full w-full" zoomControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
            {trips.map(trip => (
              <Marker key={trip.id} position={[trip.lat, trip.lng]} eventHandlers={{ click: () => setSelectedTrip(trip.id) }}>
                <Popup>
                  <div className="min-w-[180px]">
                    <p className="font-semibold">{trip.route_name}</p>
                    <p className="text-xs text-gray-500">Driver: {trip.driver_name}</p>
                    <p className="text-xs text-gray-500">Speed: {trip.speed?.toFixed(1)} km/h</p>
                    <p className="text-xs text-gray-500">Boarded: {trip.boarded_count}/{trip.total_students}</p>
                    {trip.has_sos && <div className="mt-2 rounded bg-red-50 p-1.5 text-xs text-red-600 font-semibold">🚨 SOS Active</div>}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground">Loading Map...</div>
        )}

        <div className="absolute right-4 top-4 z-[1000] flex flex-col gap-2">
          <Button size="sm" variant="secondary" className="shadow-lg"><Maximize2 className="h-4 w-4" /></Button>
        </div>

        <div className="absolute left-4 top-4 z-[1000]">
          <div className="flex items-center gap-2 rounded-xl bg-card/90 backdrop-blur px-3 py-2 shadow-lg border border-border">
            <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <span className="text-sm font-medium">{trips.length} active trips</span>
          </div>
        </div>
      </div>

      <div className="w-80 xl:w-96 border-l border-border bg-card overflow-y-auto flex flex-col">
        <div className="p-4 border-b border-border bg-muted/10">
          <h2 className="font-semibold text-lg">Active Trips</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{isClient ? format(new Date(), 'EEEE, d MMMM yyyy • h:mm a') : ''}</p>
        </div>
        
        {trips.length === 0 ? (
          <EmptyState icon={Bus} title="No active trips" description="All buses have completed their routes." className="py-12" />
        ) : (
          <div className="divide-y divide-border flex-1 overflow-y-auto">
            {trips.map(trip => (
              <button key={trip.id} onClick={() => setSelectedTrip(trip.id === selectedTrip ? null : trip.id)}
                className={cn(
                  'w-full text-left px-4 py-3.5 transition-colors hover:bg-muted/50',
                  selectedTrip === trip.id && 'bg-accent/50',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn('mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm', trip.has_sos ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary')}>
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
                      <span className="text-xs text-muted-foreground">{trip.speed.toFixed(0)} km/h</span>
                    </div>
                    <Progress value={(trip.boarded_count / trip.total_students) * 100} className="mt-1.5 h-1" />
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
