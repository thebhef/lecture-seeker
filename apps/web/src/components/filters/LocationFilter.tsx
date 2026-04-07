"use client";

import { useState, useCallback, useRef } from "react";
import { MapPin, Navigation, Search, X, Loader2 } from "lucide-react";
import { MAP_DEFAULT_CENTER, MAP_DEFAULT_RADIUS_MILES } from "@lecture-seeker/shared";

interface LocationFilterProps {
  latitude: string;
  longitude: string;
  radius: string;
  onGeoChange: (lat: string | null, lng: string | null, radius: string | null) => void;
}

const RADIUS_OPTIONS = [5, 10, 25, 50, 100];

export function LocationFilter({
  latitude,
  longitude,
  radius,
  onGeoChange,
}: LocationFilterProps) {
  const [geoLoading, setGeoLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLabel, setSearchLabel] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasGeoFilter = latitude !== "" && longitude !== "";
  const currentRadius = radius || String(MAP_DEFAULT_RADIUS_MILES);

  const applyGeo = useCallback(
    (lat: string, lng: string, label: string) => {
      setSearchLabel(label);
      setGeoError(null);
      onGeoChange(lat, lng, currentRadius);
    },
    [onGeoChange, currentRadius]
  );

  const searchPlace = useCallback(
    async (query: string) => {
      if (!query.trim()) return;
      setSearchLoading(true);
      setGeoError(null);
      try {
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(query)}`
        );
        const data = await res.json();
        if (!res.ok) {
          setGeoError(
            data.error === "Location not found"
              ? "Location not found. Try a city name or zip code."
              : "Search failed. Try again."
          );
          return;
        }
        applyGeo(
          String(data.latitude),
          String(data.longitude),
          data.label.split(",")[0]
        );
      } catch {
        setGeoError("Search failed. Try again.");
      } finally {
        setSearchLoading(false);
      }
    },
    [applyGeo]
  );

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        searchPlace(searchQuery);
      }
    },
    [searchPlace, searchQuery]
  );

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation not supported");
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        applyGeo(
          String(pos.coords.latitude),
          String(pos.coords.longitude),
          "My Location"
        );
      },
      (err) => {
        setGeoLoading(false);
        setGeoError(
          err.code === 1 ? "Location permission denied" : "Could not get location"
        );
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }, [applyGeo]);

  const clearGeo = useCallback(() => {
    setSearchLabel("");
    setSearchQuery("");
    onGeoChange(null, null, null);
  }, [onGeoChange]);

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">Location</h3>
      <div className="space-y-3">
        {/* City / zip / place search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="City, zip code, or place..."
            className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-8 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {searchLoading ? (
            <Loader2 className="absolute right-2.5 top-2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : (
            searchQuery && (
              <button
                onClick={() => searchPlace(searchQuery)}
                className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
              >
                <Search className="h-3.5 w-3.5" />
              </button>
            )
          )}
        </div>

        {/* Quick buttons */}
        <div className="flex gap-1.5">
          <button
            onClick={useMyLocation}
            disabled={geoLoading}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors ${
              hasGeoFilter && searchLabel === "My Location"
                ? "border-primary bg-primary/10 text-primary font-medium"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Navigation className="h-3 w-3" />
            {geoLoading ? "Locating..." : "Near Me"}
          </button>
          <button
            onClick={() => {
              applyGeo(
                String(MAP_DEFAULT_CENTER.lat),
                String(MAP_DEFAULT_CENTER.lng),
                "Bay Area"
              );
              setSearchQuery("");
            }}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors ${
              hasGeoFilter && searchLabel === "Bay Area"
                ? "border-primary bg-primary/10 text-primary font-medium"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <MapPin className="h-3 w-3" />
            Bay Area
          </button>
        </div>

        {geoError && <p className="text-xs text-red-500">{geoError}</p>}

        {hasGeoFilter && (
          <>
            {searchLabel && (
              <p className="text-xs text-foreground font-medium">
                {searchLabel}
                <span className="text-muted-foreground font-normal">
                  {" "}&mdash; within {currentRadius} mi
                </span>
              </p>
            )}
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Radius
              </label>
              <div className="flex gap-1">
                {RADIUS_OPTIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() =>
                      onGeoChange(latitude, longitude, String(r))
                    }
                    className={`flex-1 rounded border px-1 py-0.5 text-xs transition-colors ${
                      currentRadius === String(r)
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {r}mi
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={clearGeo}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
              Clear location filter
            </button>
          </>
        )}
      </div>
    </div>
  );
}
