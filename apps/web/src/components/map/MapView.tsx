"use client";

import { useMemo, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { format } from "date-fns";
import { MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM } from "@lecture-seeker/shared";
import type { EventWithSource } from "@/lib/types";

import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icon paths (broken by bundlers)
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

// Source-based marker colors using simple colored circle markers
const SOURCE_COLORS: Record<string, string> = {
  stanford: "#8C1515",
  "uc-berkeley": "#003262",
  "cal-bears": "#FDB515",
  "csm-observatory": "#2563eb",
  "cal-academy": "#1a9641",
};

function makeIcon(color: string) {
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="
      width: 14px; height: 14px;
      background: ${color};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 1px 4px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });
}

interface MapViewProps {
  events: EventWithSource[];
  onSelect: (event: EventWithSource) => void;
}

/** Fits map bounds to all markers when events change */
function FitBounds({ events }: { events: EventWithSource[] }) {
  const map = useMap();
  const prevCount = useRef(0);

  useEffect(() => {
    const withCoords = events.filter((e) => e.latitude && e.longitude);
    if (withCoords.length === 0) return;
    // Only auto-fit when event set changes significantly
    if (withCoords.length === prevCount.current) return;
    prevCount.current = withCoords.length;

    const bounds = L.latLngBounds(
      withCoords.map((e) => [e.latitude!, e.longitude!] as [number, number])
    );
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [events, map]);

  return null;
}

export function MapView({ events, onSelect }: MapViewProps) {
  const geoEvents = useMemo(
    () => events.filter((e) => e.latitude != null && e.longitude != null),
    [events]
  );

  // Group events at the same location to show count in popup
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { lat: number; lng: number; events: EventWithSource[] }
    >();
    for (const event of geoEvents) {
      // Round to ~11m precision to cluster nearby markers
      const key = `${event.latitude!.toFixed(4)},${event.longitude!.toFixed(4)}`;
      if (!map.has(key)) {
        map.set(key, {
          lat: event.latitude!,
          lng: event.longitude!,
          events: [],
        });
      }
      map.get(key)!.events.push(event);
    }
    return Array.from(map.values());
  }, [geoEvents]);

  const noLocation = events.length - geoEvents.length;

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-lg border border-border shadow-sm" style={{ height: "calc(100vh - 220px)", minHeight: "400px" }}>
        <MapContainer
          center={[MAP_DEFAULT_CENTER.lat, MAP_DEFAULT_CENTER.lng]}
          zoom={MAP_DEFAULT_ZOOM}
          className="h-full w-full"
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds events={geoEvents} />

          {grouped.map((group) => {
            const icon = makeIcon(
              SOURCE_COLORS[group.events[0].source.slug] || "#6b7280"
            );
            return (
              <Marker
                key={`${group.lat},${group.lng}`}
                position={[group.lat, group.lng]}
                icon={icon}
              >
                <Popup maxWidth={300} minWidth={200}>
                  <div className="space-y-2 text-sm">
                    {group.events.length > 1 && (
                      <p className="font-semibold text-muted-foreground">
                        {group.events.length} events at this location
                      </p>
                    )}
                    {group.events.slice(0, 5).map((event) => (
                      <button
                        key={event.id}
                        onClick={() => onSelect(event)}
                        className="block w-full text-left hover:bg-muted/50 rounded p-1 -m-1"
                      >
                        <p className="font-medium leading-tight">
                          {event.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(event.startTime), "MMM d, h:mm a")}
                          {event.location && ` \u2022 ${event.location}`}
                        </p>
                      </button>
                    ))}
                    {group.events.length > 5 && (
                      <p className="text-xs text-muted-foreground">
                        +{group.events.length - 5} more
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* Info bar */}
      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
        <span>{geoEvents.length} events on map</span>
        {noLocation > 0 && (
          <span>{noLocation} events without location data</span>
        )}
      </div>
    </div>
  );
}
