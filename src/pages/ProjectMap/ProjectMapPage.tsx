import { previewStorage } from "../../integration/previewStorage";
import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import {
  MapPin,
  Navigation,
  Compass,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
  ArrowRightLeft,
  Building2,
  Briefcase,
  RotateCcw,
  Clock,
  Milestone,
  Layers,
  Search,
  X,
  CheckCircle2
} from "lucide-react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { ProjectService } from "../../services/projectService";

interface LocationPoint {
  name: string;
  lat: number;
  lng: number;
}

interface RouteCoords {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
}

interface ValidationErrors {
  from?: string;
  to?: string;
  general?: string;
}

// Custom Leaflet DivIcons for clean aesthetic
const createCustomIcon = (color: string, label: string) => {
  return L.divIcon({
    className: "custom-leaflet-marker",
    html: `
      <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%); pointer-events: auto;">
        <div style="background-color: ${color}; color: #040e1a; font-weight: 900; font-size: 10px; padding: 2px 7px; border-radius: 6px; border: 1.5px solid #ffffff; white-space: nowrap; box-shadow: 0 4px 10px rgba(0,0,0,0.5); margin-bottom: 3px; font-family: system-ui, sans-serif;">
          ${label}
        </div>
        <div style="width: 22px; height: 22px; background-color: ${color}; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2px solid #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;">
          <div style="width: 7px; height: 7px; background-color: #040e1a; border-radius: 50%; transform: rotate(45deg);"></div>
        </div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });
};

const originIcon = createCustomIcon("#10b981", "From (Origin)");
const destinationIcon = createCustomIcon("#f59e0b", "To (Destination)");

// Component to handle dynamic map bounds fitting or flyTo
function MapBoundsController({
  fromLoc,
  toLoc
}: {
  fromLoc: LocationPoint | null;
  toLoc: LocationPoint | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (fromLoc && toLoc) {
      const bounds: L.LatLngBoundsExpression = [
        [fromLoc.lat, fromLoc.lng],
        [toLoc.lat, toLoc.lng]
      ];
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    } else if (fromLoc) {
      map.flyTo([fromLoc.lat, fromLoc.lng], 13, { duration: 1 });
    } else if (toLoc) {
      map.flyTo([toLoc.lat, toLoc.lng], 13, { duration: 1 });
    }
  }, [fromLoc, toLoc, map]);

  return null;
}

export default function ProjectMapPage() {
  const { activeCompany, activeProject, onProjectChange } = useOutletContext<any>();

  // Selected Location points (only ONE location allowed per side)
  const [fromLocation, setFromLocation] = useState<LocationPoint | null>(null);
  const [toLocation, setToLocation] = useState<LocationPoint | null>(null);
  const [savedLocMessage, setSavedLocMessage] = useState<string | null>(null);

  const handleSaveLocationToProject = async (loc: LocationPoint) => {
    assertOperationalAction("write", "pages/ProjectMap/ProjectMapPage.tsx");
    const projId = activeProject?.id || activeProject?.project_id || previewStorage.getItem("pm_active_project_id") || "PRJ-CURRENT";
    const coordsPayload = { lat: loc.lat, lng: loc.lng, label: loc.name, source: "user_pinned" };
    try {
      previewStorage.setItem(`pm_project_coords_${projId}`, JSON.stringify(coordsPayload));
      previewStorage.setItem(`projectmatrix_coords_proj_${projId}`, JSON.stringify(coordsPayload));
      
      const storedActive = previewStorage.getItem("pm_active_project");
      if (storedActive) {
        const parsedActive = JSON.parse(storedActive);
        if (parsedActive) {
          previewStorage.setItem("pm_active_project", JSON.stringify({ ...parsedActive, latitude: loc.lat, longitude: loc.lng, execution_location: loc.name }));
        }
      }
    } catch (_) {}

    const updates = {
      latitude: loc.lat,
      longitude: loc.lng,
      lat: loc.lat,
      lng: loc.lng,
      gps_coordinates: `${loc.lat}, ${loc.lng}`,
      execution_location: loc.name,
      location: loc.name
    };

    const companyId = activeProject?.company_id || activeCompany?.id || "default";
    try {
      await ProjectService.updateProject(projId, companyId, updates);
    } catch (_) {}

    if (onProjectChange) {
      onProjectChange({ ...(activeProject || {}), ...updates });
    }

    try {
      window.dispatchEvent(new CustomEvent("project_coordinates_updated", {
        detail: { projectId: projId, lat: loc.lat, lng: loc.lng, location: loc.name }
      }));
    } catch (_) {}

    setSavedLocMessage(`Saved "${loc.name}" (${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}) as project location!`);
    setTimeout(() => setSavedLocMessage(null), 4000);
  };

  // Search input & results states for FROM
  const [fromSearchQuery, setFromSearchQuery] = useState<string>("");
  const [fromSearchResults, setFromSearchResults] = useState<any[]>([]);
  const [isSearchingFrom, setIsSearchingFrom] = useState<boolean>(false);
  const [showFromManual, setShowFromManual] = useState<boolean>(false);
  const [fromLatInput, setFromLatInput] = useState<string>("");
  const [fromLngInput, setFromLngInput] = useState<string>("");

  // Search input & results states for TO
  const [toSearchQuery, setToSearchQuery] = useState<string>("");
  const [toSearchResults, setToSearchResults] = useState<any[]>([]);
  const [isSearchingTo, setIsSearchingTo] = useState<boolean>(false);
  const [showToManual, setShowToManual] = useState<boolean>(false);
  const [toLatInput, setToLatInput] = useState<string>("");
  const [toLngInput, setToLngInput] = useState<string>("");

  // Active Route & Map State
  const [activeRoute, setActiveRoute] = useState<RouteCoords | null>(null);
  const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]);
  const [routeDistanceKm, setRouteDistanceKm] = useState<number | null>(null);
  const [routeDurationSec, setRouteDurationSec] = useState<number | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState<boolean>(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [errors, setErrors] = useState<ValidationErrors>({});

  // Debounced search for FROM using OpenStreetMap Nominatim
  useEffect(() => {
    if (!fromSearchQuery || fromSearchQuery.trim().length < 2) {
      setFromSearchResults([]);
      setIsSearchingFrom(false);
      return;
    }

    setIsSearchingFrom(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            fromSearchQuery
          )}&limit=5&addressdetails=1`,
          { headers: { "Accept-Language": "en" } }
        );
        if (res.ok) {
          const data = await res.json();
          setFromSearchResults(data || []);
        }
      } catch (e) {
        console.warn("Nominatim search error:", e);
      } finally {
        setIsSearchingFrom(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [fromSearchQuery]);

  // Debounced search for TO using OpenStreetMap Nominatim
  useEffect(() => {
    if (!toSearchQuery || toSearchQuery.trim().length < 2) {
      setToSearchResults([]);
      setIsSearchingTo(false);
      return;
    }

    setIsSearchingTo(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            toSearchQuery
          )}&limit=5&addressdetails=1`,
          { headers: { "Accept-Language": "en" } }
        );
        if (res.ok) {
          const data = await res.json();
          setToSearchResults(data || []);
        }
      } catch (e) {
        console.warn("Nominatim search error:", e);
      } finally {
        setIsSearchingTo(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [toSearchQuery]);

  // Clear route and metric calculations when inputs change or locations are removed
  const clearRoute = () => {
    setActiveRoute(null);
    setRoutePolyline([]);
    setRouteDistanceKm(null);
    setRouteDurationSec(null);
    setRouteError(null);
    setErrors({});
  };

  // Select a search result for FROM (replaces existing selection)
  const handleSelectFromSearchResult = (item: any) => {
    const lat = Number(item.lat);
    const lng = Number(item.lon);
    const name = item.display_name;

    setFromLocation({ name, lat, lng });
    setFromLatInput(String(lat));
    setFromLngInput(String(lng));
    setFromSearchQuery("");
    setFromSearchResults([]);
    clearRoute();
  };

  // Select a search result for TO (replaces existing selection)
  const handleSelectToSearchResult = (item: any) => {
    const lat = Number(item.lat);
    const lng = Number(item.lon);
    const name = item.display_name;

    setToLocation({ name, lat, lng });
    setToLatInput(String(lat));
    setToLngInput(String(lng));
    setToSearchQuery("");
    setToSearchResults([]);
    clearRoute();
  };

  // Remove FROM location (Clears search text, coordinates, marker, route, distance, duration)
  const handleRemoveFromLocation = () => {
    assertOperationalAction("delete", "pages/ProjectMap/ProjectMapPage.tsx");
    setFromLocation(null);
    setFromLatInput("");
    setFromLngInput("");
    setFromSearchQuery("");
    setFromSearchResults([]);
    clearRoute();
  };

  // Remove TO location (Clears search text, coordinates, marker, route, distance, duration)
  const handleRemoveToLocation = () => {
    assertOperationalAction("delete", "pages/ProjectMap/ProjectMapPage.tsx");
    setToLocation(null);
    setToLatInput("");
    setToLngInput("");
    setToSearchQuery("");
    setToSearchResults([]);
    clearRoute();
  };

  // Apply manual coordinates for FROM
  const handleApplyFromManualCoords = () => {
    const lat = Number(fromLatInput.trim());
    const lng = Number(fromLngInput.trim());

    if (isNaN(lat) || lat < -90 || lat > 90) {
      setErrors((prev) => ({ ...prev, from: "Latitude must be between -90 and 90." }));
      return false;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      setErrors((prev) => ({ ...prev, from: "Longitude must be between -180 and 180." }));
      return false;
    }

    setFromLocation({
      name: `Custom Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      lat,
      lng
    });
    setFromSearchQuery("");
    setFromSearchResults([]);
    setErrors((prev) => ({ ...prev, from: undefined }));
    clearRoute();
    return true;
  };

  // Apply manual coordinates for TO
  const handleApplyToManualCoords = () => {
    const lat = Number(toLatInput.trim());
    const lng = Number(toLngInput.trim());

    if (isNaN(lat) || lat < -90 || lat > 90) {
      setErrors((prev) => ({ ...prev, to: "Latitude must be between -90 and 90." }));
      return false;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      setErrors((prev) => ({ ...prev, to: "Longitude must be between -180 and 180." }));
      return false;
    }

    setToLocation({
      name: `Custom Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      lat,
      lng
    });
    setToSearchQuery("");
    setToSearchResults([]);
    setErrors((prev) => ({ ...prev, to: undefined }));
    clearRoute();
    return true;
  };

  // Swap From & To locations
  const handleSwapLocations = () => {
    const tempLoc = fromLocation;
    const tempLat = fromLatInput;
    const tempLng = fromLngInput;

    setFromLocation(toLocation);
    setFromLatInput(toLatInput);
    setFromLngInput(toLngInput);

    setToLocation(tempLoc);
    setToLatInput(tempLat);
    setToLngInput(tempLng);

    if (activeRoute) {
      const swappedRoute: RouteCoords = {
        fromLat: activeRoute.toLat,
        fromLng: activeRoute.toLng,
        toLat: activeRoute.fromLat,
        toLng: activeRoute.fromLng
      };
      setActiveRoute(swappedRoute);
      fetchOsrmRoute(swappedRoute);
    } else {
      clearRoute();
    }
  };

  // Fetch OSRM driving route
  const fetchOsrmRoute = async (coords: RouteCoords) => {
    setIsLoadingRoute(true);
    setRouteError(null);

    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coords.fromLng},${coords.fromLat};${coords.toLng},${coords.toLat}?overview=full&geometries=geojson`;
      const res = await fetch(osrmUrl);

      if (!res.ok) {
        throw new Error(`Routing service responded with status ${res.status}`);
      }

      const data = await res.json();

      if (data.code === "Ok" && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const leafletCoords: [number, number][] = route.geometry.coordinates.map(
          ([lng, lat]: [number, number]) => [lat, lng]
        );

        setRoutePolyline(leafletCoords);
        setRouteDistanceKm(route.distance / 1000);
        setRouteDurationSec(route.duration);
        setRouteError(null);
      } else {
        throw new Error(data.message || "No driving route found between specified points.");
      }
    } catch (err: any) {
      console.warn("OSRM routing error:", err);
      setRouteError("Unable to compute driving directions. Displaying straight connection line.");
      setRoutePolyline([
        [coords.fromLat, coords.fromLng],
        [coords.toLat, coords.toLng]
      ]);
      setRouteDistanceKm(null);
      setRouteDurationSec(null);
    } finally {
      setIsLoadingRoute(false);
    }
  };

  // Handle Show Route submit
  const handleShowRoute = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    let effectiveFrom = fromLocation;
    let effectiveTo = toLocation;

    // Auto-apply manual coords if typed but not explicitly set
    if (!effectiveFrom && fromLatInput.trim() && fromLngInput.trim()) {
      const ok = handleApplyFromManualCoords();
      if (ok) {
        effectiveFrom = {
          name: `Custom Location (${fromLatInput}, ${fromLngInput})`,
          lat: Number(fromLatInput),
          lng: Number(fromLngInput)
        };
      }
    }

    if (!effectiveTo && toLatInput.trim() && toLngInput.trim()) {
      const ok = handleApplyToManualCoords();
      if (ok) {
        effectiveTo = {
          name: `Custom Location (${toLatInput}, ${toLngInput})`,
          lat: Number(toLatInput),
          lng: Number(toLngInput)
        };
      }
    }

    if (!effectiveFrom || !effectiveTo) {
      setErrors({
        general: "Please select or specify both a 'From' origin and 'To' destination location to display a route."
      });
      return;
    }

    setErrors({});
    const coords: RouteCoords = {
      fromLat: effectiveFrom.lat,
      fromLng: effectiveFrom.lng,
      toLat: effectiveTo.lat,
      toLng: effectiveTo.lng
    };

    setActiveRoute(coords);
    fetchOsrmRoute(coords);
  };

  // Reset entire form
  const handleReset = () => {
    setFromLocation(null);
    setFromSearchQuery("");
    setFromSearchResults([]);
    setFromLatInput("");
    setFromLngInput("");

    setToLocation(null);
    setToSearchQuery("");
    setToSearchResults([]);
    setToLatInput("");
    setToLngInput("");

    clearRoute();
  };

  // Format Duration string
  const formattedDuration = useMemo(() => {
    if (routeDurationSec === null) return null;
    const minutes = Math.round(routeDurationSec / 60);
    if (minutes < 60) {
      return `${minutes} min${minutes === 1 ? "" : "s"}`;
    }
    const hours = Math.floor(minutes / 60);
    const remMins = minutes % 60;
    return `${hours}h ${remMins}m`;
  }, [routeDurationSec]);

  // Center coordinate for MapContainer
  const mapCenter = useMemo<[number, number]>(() => {
    if (fromLocation && toLocation) {
      return [(fromLocation.lat + toLocation.lat) / 2, (fromLocation.lng + toLocation.lng) / 2];
    }
    if (fromLocation) return [fromLocation.lat, fromLocation.lng];
    if (toLocation) return [toLocation.lat, toLocation.lng];
    return [-26.2041, 28.0473]; // Default South Africa view
  }, [fromLocation, toLocation]);

  // External Google Maps Directions link (Requirement 4)
  const externalGoogleMapsUrl = useMemo(() => {
    if (!fromLocation || !toLocation) return "#";
    const params = new URLSearchParams({
      api: "1",
      origin: `${fromLocation.lat},${fromLocation.lng}`,
      destination: `${toLocation.lat},${toLocation.lng}`,
      travelmode: "driving"
    });
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }, [fromLocation, toLocation]);

  return (
    <div className="min-h-screen bg-[#060a12] text-slate-100 p-4 md:p-8 space-y-6 font-sans">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#102846] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Technical Department
            </span>
            <span className="text-slate-500 text-xs font-mono">•</span>
            <span className="text-slate-400 text-xs font-medium flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-amber-500" />
              GIS & OpenStreetMap Navigation
            </span>
          </div>

          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
            <MapPin className="w-7 h-7 text-amber-500 shrink-0" />
            Project Map
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Search site locations or specify coordinates to calculate driving routes, haulage distances, and logistics access routes.
          </p>
        </div>

        {/* Active Context Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-1.5 bg-[#07182E] border border-[#102846] rounded-xl flex items-center gap-2 text-xs">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 font-medium">Company:</span>
            <span className="text-white font-bold">{activeCompany?.name || "N/A"}</span>
          </div>

          <div className="px-3 py-1.5 bg-[#07182E] border border-[#102846] rounded-xl flex items-center gap-2 text-xs">
            <Briefcase className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-slate-400 font-medium">Project:</span>
            <span className="text-amber-400 font-bold">{activeProject?.name || "Select Active Project"}</span>
          </div>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Location Selection Controls (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <form onSubmit={handleShowRoute} className="bg-[#07182E] border border-[#102846] rounded-2xl p-5 md:p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#102846] pb-3">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">
                  Route Selection
                </h2>
              </div>
              <button
                type="button"
                onClick={handleSwapLocations}
                disabled={!fromLocation && !toLocation}
                title="Swap From and To locations"
                className="p-1.5 bg-[#102846] hover:bg-amber-500/20 text-slate-300 hover:text-amber-400 rounded-lg transition-colors cursor-pointer text-xs font-bold flex items-center gap-1 border border-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Swap</span>
              </button>
            </div>

            {/* Status Alert Banner */}
            {savedLocMessage && (
              <div className="bg-emerald-950/60 border border-emerald-500/50 p-3 rounded-xl flex items-center gap-2.5 text-xs text-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-semibold">{savedLocMessage}</span>
              </div>
            )}

            {/* FROM LOCATION SECTION */}
            <div className="bg-[#040e1a] border border-[#102846] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-black uppercase text-emerald-400 tracking-wider">
                    From (Origin)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFromManual(!showFromManual)}
                  className="text-[10px] text-amber-400 hover:underline font-medium"
                >
                  {showFromManual ? "Use Search" : "Manual Coords"}
                </button>
              </div>

              {/* Removable Selected Chip for FROM */}
              {fromLocation ? (
                <div className="bg-[#07182E] border border-emerald-500/40 p-3 rounded-xl flex items-start justify-between gap-3 shadow-md transition-all">
                  <div className="flex items-start gap-2.5 overflow-hidden">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{fromLocation.name}</p>
                      <p className="text-[10px] text-emerald-400 font-mono mt-0.5">
                        Lat: {fromLocation.lat.toFixed(4)}, Lng: {fromLocation.lng.toFixed(4)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleSaveLocationToProject(fromLocation)}
                      className="px-2.5 py-1 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                      title="Save this location as project site location"
                    >
                      <MapPin className="w-3 h-3" />
                      <span>Save as Project Location</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveFromLocation}
                      className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg border border-rose-500/30 transition-colors cursor-pointer"
                      title="Remove location"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : !showFromManual ? (
                /* Search Box for FROM */
                <div className="relative space-y-1">
                  <div className="relative flex items-center">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
                    <input
                      type="text"
                      value={fromSearchQuery}
                      onChange={(e) => setFromSearchQuery(e.target.value)}
                      placeholder="Search city, site, or landmark (e.g. Pretoria)"
                      className="w-full pl-9 pr-8 py-2.5 bg-[#07182E] border border-[#102846] focus:border-amber-500 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none transition-colors"
                    />
                    {isSearchingFrom ? (
                      <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin absolute right-3" />
                    ) : fromSearchQuery ? (
                      <button
                        type="button"
                        onClick={() => {
                          setFromSearchQuery("");
                          setFromSearchResults([]);
                        }}
                        className="absolute right-3 text-slate-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    ) : null}
                  </div>

                  {/* Dropdown Results */}
                  {fromSearchResults.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-[#07182E] border border-[#102846] rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto space-y-0.5 p-1">
                      {fromSearchResults.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectFromSearchResult(item)}
                          className="w-full text-left p-2.5 hover:bg-[#102846] rounded-lg transition-colors cursor-pointer flex items-start gap-2 text-xs"
                        >
                          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span className="text-slate-200 line-clamp-2">{item.display_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Manual Inputs for FROM */
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={fromLatInput}
                      onChange={(e) => setFromLatInput(e.target.value)}
                      placeholder="Lat (-26.2041)"
                      className="px-3 py-2 bg-[#07182E] border border-[#102846] rounded-xl text-white text-xs font-mono focus:outline-none focus:border-amber-500"
                    />
                    <input
                      type="text"
                      value={fromLngInput}
                      onChange={(e) => setFromLngInput(e.target.value)}
                      placeholder="Lng (28.0473)"
                      className="px-3 py-2 bg-[#07182E] border border-[#102846] rounded-xl text-white text-xs font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyFromManualCoords}
                    className="w-full py-1.5 bg-[#102846] hover:bg-emerald-500/20 text-emerald-400 font-bold text-xs rounded-lg border border-emerald-500/30 transition-colors"
                  >
                    Set Origin Coordinates
                  </button>
                </div>
              )}

              {errors.from && (
                <p className="text-[10px] text-rose-400 font-semibold flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>{errors.from}</span>
                </p>
              )}
            </div>

            {/* TO LOCATION SECTION */}
            <div className="bg-[#040e1a] border border-[#102846] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-xs font-black uppercase text-amber-400 tracking-wider">
                    To (Destination)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowToManual(!showToManual)}
                  className="text-[10px] text-amber-400 hover:underline font-medium"
                >
                  {showToManual ? "Use Search" : "Manual Coords"}
                </button>
              </div>

              {/* Removable Selected Chip for TO */}
              {toLocation ? (
                <div className="bg-[#07182E] border border-amber-500/40 p-3 rounded-xl flex items-start justify-between gap-3 shadow-md transition-all">
                  <div className="flex items-start gap-2.5 overflow-hidden">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{toLocation.name}</p>
                      <p className="text-[10px] text-amber-400 font-mono mt-0.5">
                        Lat: {toLocation.lat.toFixed(4)}, Lng: {toLocation.lng.toFixed(4)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleSaveLocationToProject(toLocation)}
                      className="px-2.5 py-1 bg-amber-600/90 hover:bg-amber-500 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                      title="Save this location as project site location"
                    >
                      <MapPin className="w-3 h-3" />
                      <span>Save as Project Location</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveToLocation}
                      className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg border border-rose-500/30 transition-colors cursor-pointer"
                      title="Remove location"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : !showToManual ? (
                /* Search Box for TO */
                <div className="relative space-y-1">
                  <div className="relative flex items-center">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
                    <input
                      type="text"
                      value={toSearchQuery}
                      onChange={(e) => setToSearchQuery(e.target.value)}
                      placeholder="Search city, site, or landmark (e.g. Johannesburg)"
                      className="w-full pl-9 pr-8 py-2.5 bg-[#07182E] border border-[#102846] focus:border-amber-500 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none transition-colors"
                    />
                    {isSearchingTo ? (
                      <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin absolute right-3" />
                    ) : toSearchQuery ? (
                      <button
                        type="button"
                        onClick={() => {
                          setToSearchQuery("");
                          setToSearchResults([]);
                        }}
                        className="absolute right-3 text-slate-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    ) : null}
                  </div>

                  {/* Dropdown Results */}
                  {toSearchResults.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-[#07182E] border border-[#102846] rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto space-y-0.5 p-1">
                      {toSearchResults.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectToSearchResult(item)}
                          className="w-full text-left p-2.5 hover:bg-[#102846] rounded-lg transition-colors cursor-pointer flex items-start gap-2 text-xs"
                        >
                          <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <span className="text-slate-200 line-clamp-2">{item.display_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Manual Inputs for TO */
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={toLatInput}
                      onChange={(e) => setToLatInput(e.target.value)}
                      placeholder="Lat (-25.7479)"
                      className="px-3 py-2 bg-[#07182E] border border-[#102846] rounded-xl text-white text-xs font-mono focus:outline-none focus:border-amber-500"
                    />
                    <input
                      type="text"
                      value={toLngInput}
                      onChange={(e) => setToLngInput(e.target.value)}
                      placeholder="Lng (28.2293)"
                      className="px-3 py-2 bg-[#07182E] border border-[#102846] rounded-xl text-white text-xs font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyToManualCoords}
                    className="w-full py-1.5 bg-[#102846] hover:bg-amber-500/20 text-amber-400 font-bold text-xs rounded-lg border border-amber-500/30 transition-colors"
                  >
                    Set Destination Coordinates
                  </button>
                </div>
              )}

              {errors.to && (
                <p className="text-[10px] text-rose-400 font-semibold flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>{errors.to}</span>
                </p>
              )}
            </div>

            {/* General Form Error Notification */}
            {errors.general && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errors.general}</span>
              </div>
            )}

            {/* Submit & Reset Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={isLoadingRoute}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-500/10 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoadingRoute ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Calculating Route...</span>
                  </>
                ) : (
                  <>
                    <Navigation className="w-4 h-4 fill-current" />
                    <span>Show Route</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="p-3 bg-[#102846] hover:bg-[#1a3a60] text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
                title="Reset map inputs"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: React-Leaflet Map & Metrics (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Metrics Bar (Only displayed when route is calculated) */}
          {activeRoute && (routeDistanceKm !== null || formattedDuration || routeError) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-[#07182E] border border-[#102846] rounded-2xl p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Milestone className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Driving Distance
                  </span>
                  <span className="text-lg font-black text-white">
                    {routeDistanceKm !== null ? `${routeDistanceKm.toFixed(1)} km` : "N/A"}
                  </span>
                </div>
              </div>

              <div className="bg-[#07182E] border border-[#102846] rounded-2xl p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Est. Duration
                  </span>
                  <span className="text-lg font-black text-white">
                    {formattedDuration || "N/A"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Route Error Callout */}
          {routeError && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-300 text-xs font-semibold flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{routeError}</span>
            </div>
          )}

          {/* Map Container Card */}
          <div className="bg-[#07182E] border border-[#102846] rounded-2xl shadow-xl overflow-hidden flex flex-col min-h-[560px]">
            {/* Map Header Bar */}
            <div className="p-4 border-b border-[#102846] bg-[#07182E] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">
                  Interactive Route Map
                </h2>
                {activeRoute && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Route Active
                  </span>
                )}
              </div>

              {/* Requirement 4: Open in Google Maps Button */}
              {fromLocation && toLocation && (
                <a
                  href={externalGoogleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#102846] hover:bg-amber-500/20 text-amber-400 font-extrabold text-xs rounded-xl border border-amber-500/30 hover:border-amber-500/60 shadow-sm transition-all cursor-pointer group"
                >
                  <ExternalLink className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                  <span>Open in Google Maps</span>
                </a>
              )}
            </div>

            {/* Map Canvas */}
            <div className="relative flex-1 bg-[#030914] min-h-[480px] flex flex-col justify-center items-center">
              {!fromLocation && !toLocation ? (
                /* Empty State when no locations are selected */
                <div className="p-8 text-center space-y-3 max-w-sm">
                  <div className="w-14 h-14 rounded-2xl bg-[#07182E] border border-[#102846] flex items-center justify-center mx-auto text-amber-500 shadow-inner">
                    <Compass className="w-7 h-7" />
                  </div>
                  <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                    No Selected Locations
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Search for locations or enter coordinates in the panel on the left, then click <strong className="text-amber-400">"Show Route"</strong> to display the map.
                  </p>
                </div>
              ) : (
                /* React Leaflet Interactive Map */
                <div className="w-full h-full min-h-[480px] relative">
                  {isLoadingRoute && (
                    <div className="absolute inset-0 bg-[#030914]/80 backdrop-blur-xs flex flex-col items-center justify-center space-y-2 z-[1000] text-white">
                      <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
                      <p className="text-xs font-bold text-slate-300">Calculating Driving Route via OSRM...</p>
                    </div>
                  )}

                  <MapContainer
                    center={mapCenter}
                    zoom={10}
                    scrollWheelZoom={true}
                    style={{ height: "480px", width: "100%", borderRadius: "0 0 1rem 1rem" }}
                  >
                    <MapBoundsController fromLoc={fromLocation} toLoc={toLocation} />

                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {/* From Marker */}
                    {fromLocation && (
                      <Marker position={[fromLocation.lat, fromLocation.lng]} icon={originIcon}>
                        <Popup>
                          <div className="p-1 font-sans text-xs">
                            <strong className="text-emerald-600 block">Origin (From)</strong>
                            <p className="text-slate-800 font-semibold">{fromLocation.name}</p>
                            <span className="text-slate-500 text-[10px]">
                              Lat: {fromLocation.lat.toFixed(4)}, Lng: {fromLocation.lng.toFixed(4)}
                            </span>
                          </div>
                        </Popup>
                      </Marker>
                    )}

                    {/* To Marker */}
                    {toLocation && (
                      <Marker position={[toLocation.lat, toLocation.lng]} icon={destinationIcon}>
                        <Popup>
                          <div className="p-1 font-sans text-xs">
                            <strong className="text-amber-600 block">Destination (To)</strong>
                            <p className="text-slate-800 font-semibold">{toLocation.name}</p>
                            <span className="text-slate-500 text-[10px]">
                              Lat: {toLocation.lat.toFixed(4)}, Lng: {toLocation.lng.toFixed(4)}
                            </span>
                          </div>
                        </Popup>
                      </Marker>
                    )}

                    {/* Route Polyline */}
                    {routePolyline.length > 0 && (
                      <Polyline
                        positions={routePolyline}
                        pathOptions={{
                          color: "#f59e0b",
                          weight: 5,
                          opacity: 0.85,
                          dashArray: routeError ? "8, 8" : undefined
                        }}
                      />
                    )}
                  </MapContainer>
                </div>
              )}
            </div>

            {/* Map Footer Coordinates */}
            {(fromLocation || toLocation) && (
              <div className="p-3 bg-[#040e1a] border-t border-[#102846] flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">From:</span>
                  <span>
                    {fromLocation
                      ? `${fromLocation.lat.toFixed(4)}, ${fromLocation.lng.toFixed(4)}`
                      : "Not set"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 font-bold">To:</span>
                  <span>
                    {toLocation
                      ? `${toLocation.lat.toFixed(4)}, ${toLocation.lng.toFixed(4)}`
                      : "Not set"}
                  </span>
                </div>
                <div className="text-slate-500 font-sans text-[10px]">
                  Tile Provider: OpenStreetMap | Router: OSRM
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
