import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  MapPin, 
  Layers, 
  Navigation, 
  Search, 
  Edit3, 
  Check, 
  Maximize2, 
  Minimize2, 
  Compass, 
  RefreshCw, 
  Info, 
  CheckCircle2,
  X,
  Globe,
  Sparkles,
  ArrowRight
} from "lucide-react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { resolveProjectCoordinates, KNOWN_CITY_COORDINATES, getProjectRealProgress, ResolvedCoordinates } from "../../utils/projectDataUtils";
import { ProjectService } from "../../services/projectService";

export interface ProjectLocationMapCardProps {
  activeProject?: any;
  allProjects?: any[];
  activeCompany?: any;
  onProjectChange?: (project: any) => void;
  className?: string;
  [key: string]: any;
}

// Map recentering helper
function ChangeMapView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.flyTo(center, zoom, { duration: 0.6 });
    }
  }, [center, zoom, map]);
  return null;
}

// Ensure Leaflet recalculates dimensions when mounted inside modal
function InvalidateSizeOnMount() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [map]);
  return null;
}

// Map click listener component for pinning on map
function MapPinClickListener({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Marker icon generator using SVG divIcon (avoids missing leaflet asset files)
const createProjectMarkerIcon = (color: string, label: string, isSelected: boolean) => {
    assertOperationalAction("create", "components/dashboard/ProjectLocationMapCard.tsx");
  return L.divIcon({
    className: "custom-leaflet-marker",
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
        ${isSelected ? `<div style="position: absolute; bottom: 8px; width: 36px; height: 36px; background-color: ${color}33; border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>` : ''}
        <div style="background-color: ${color}; color: white; padding: 6px 10px; border-radius: 12px; font-weight: bold; font-size: 11px; font-family: monospace; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 2px solid white; white-space: nowrap; z-index: 10;">
          <svg style="width: 14px; height: 14px; display: inline-block;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <span>${label}</span>
        </div>
        <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 8px solid ${color}; margin-top: -1px;"></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });
};

const POPULAR_CORRIDORS = [
  "Dar es Salaam",
  "Dodoma",
  "Tunduma",
  "Mtwara",
  "Mwanza",
  "Arusha",
  "Nairobi",
  "Kigali",
  "Johannesburg",
  "Riyadh",
  "Dubai"
];

export default function ProjectLocationMapCard({
  activeProject,
  allProjects = [],
  activeCompany,
  onProjectChange,
  className = ""
}: ProjectLocationMapCardProps) {
  const [mapLayer, setMapLayer] = useState<"satellite" | "streets">("satellite");
  const [modalMapLayer, setModalMapLayer] = useState<"satellite" | "streets">("satellite");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");
  const [locationNameInput, setLocationNameInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [lastSelectedSource, setLastSelectedSource] = useState<string | null>(null);

  // Fallback safe project ID resolution
  const targetProjectId = useMemo(() => {
    return activeProject?.id || activeProject?.project_id || localStorage.getItem("pm_active_project_id") || allProjects?.[0]?.id || "PRJ-CURRENT";
  }, [activeProject, allProjects]);

  // Reactive state for pinned coordinates so the map card updates immediately upon saving
  const [pinnedCoords, setPinnedCoords] = useState<ResolvedCoordinates | null>(() => resolveProjectCoordinates(activeProject));

  // Resolved coordinates for selected project: prefers reactive pinnedCoords, then resolveProjectCoordinates
  const projectCoords = pinnedCoords || resolveProjectCoordinates(activeProject);

  // Sync inputs whenever activeProject changes
  useEffect(() => {
    const resolved = resolveProjectCoordinates(activeProject);
    if (resolved) {
      setPinnedCoords(resolved);
    }
  }, [activeProject]);

  // Listen to global coordinates update event across all modules
  useEffect(() => {
    const handleCoordsUpdated = (e: any) => {
      const detail = e.detail;
      if (detail && (!detail.projectId || detail.projectId === targetProjectId)) {
        setPinnedCoords({
          lat: detail.lat,
          lng: detail.lng,
          label: detail.location || "Site Location",
          source: "user_pinned"
        });
      }
    };
    window.addEventListener("project_coordinates_updated", handleCoordsUpdated);
    return () => window.removeEventListener("project_coordinates_updated", handleCoordsUpdated);
  }, [targetProjectId]);

  // Sync inputs whenever activeProject, projectCoords change, or modal opens
  useEffect(() => {
    if (projectCoords) {
      setLatInput(projectCoords.lat.toString());
      setLngInput(projectCoords.lng.toString());
      setLocationNameInput(projectCoords.label || activeProject?.execution_location || activeProject?.location || "");
    } else {
      const locText = (activeProject?.execution_location || activeProject?.location || "").toLowerCase().trim();
      let matched = false;
      if (locText) {
        for (const [city, c] of Object.entries(KNOWN_CITY_COORDINATES)) {
          if (locText.includes(city)) {
            setLatInput(c.lat.toString());
            setLngInput(c.lng.toString());
            setLocationNameInput(activeProject?.execution_location || activeProject?.location || city);
            matched = true;
            break;
          }
        }
      }
      if (!matched) {
        setLatInput("");
        setLngInput("");
        setLocationNameInput(activeProject?.execution_location || activeProject?.location || "");
      }
    }
  }, [activeProject, projectCoords, isModalOpen]);

  // Search address via Nominatim OpenStreetMap geocoding with local city cache first
  const handleSearchLocation = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim() || locationNameInput.trim() || activeProject?.location || activeProject?.execution_location;
    if (!query) {
      setSearchMessage("Please enter a location, site name, or corridor to search.");
      return;
    }

    setIsSearching(true);
    setSearchMessage(null);

    // 1. Check known cities dictionary for instantaneous match
    const queryLower = query.toLowerCase();
    for (const [city, c] of Object.entries(KNOWN_CITY_COORDINATES)) {
      if (queryLower.includes(city) || city.includes(queryLower)) {
        setLatInput(c.lat.toString());
        setLngInput(c.lng.toString());
        setLocationNameInput(city.toUpperCase() + ", Site Location");
        setLastSelectedSource(`Corridor match: ${city}`);
        setSearchMessage(`Matched coordinates for ${city.toUpperCase()} (${c.lat}, ${c.lng}). Ready to save.`);
        setIsSearching(false);
        return;
      }
    }

    // 2. Query OpenStreetMap Nominatim
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
        { headers: { "Accept-Language": "en" } }
      );
      const data = await resp.json();
      if (data && data.length > 0) {
        const found = data[0];
        const latVal = parseFloat(found.lat).toFixed(5);
        const lngVal = parseFloat(found.lon).toFixed(5);
        setLatInput(latVal);
        setLngInput(lngVal);
        const displayName = found.display_name.split(",").slice(0, 3).join(",");
        setLocationNameInput(displayName || query);
        setLastSelectedSource(`Searched: ${displayName}`);
        setSearchMessage(`Location found: ${displayName} (${latVal}, ${lngVal}). Ready to save.`);
      } else {
        setSearchMessage(`No direct GPS coordinates found for "${query}". You can select a preset corridor or click on the map preview.`);
      }
    } catch {
      setSearchMessage("Network geocoding lookup unavailable. Please choose a preset corridor or click on the map.");
    } finally {
      setIsSearching(false);
    }
  };

  // Quick corridor selection helper
  const handleSelectCorridor = (city: string) => {
    const c = KNOWN_CITY_COORDINATES[city.toLowerCase()];
    if (c) {
      setLatInput(c.lat.toString());
      setLngInput(c.lng.toString());
      setLocationNameInput(`${city}, Site Corridor`);
      setLastSelectedSource(`Preset corridor: ${city}`);
      setSearchMessage(`Selected ${city} (${c.lat}, ${c.lng}). Click "Save Selected Location" below.`);
    }
  };

  // Quick corridor one-click save directly from main empty card or modal
  const handleQuickPinCorridor = async (city: string) => {
    const c = KNOWN_CITY_COORDINATES[city.toLowerCase()];
    if (c) {
      await handleSaveCoordinates(c.lat, c.lng, `${city}, Site Corridor`);
    }
  };

  // Interactive map click listener
  const handleMapLocationSelect = (lat: number, lng: number) => {
    const formattedLat = Number(lat.toFixed(5));
    const formattedLng = Number(lng.toFixed(5));
    setLatInput(formattedLat.toString());
    setLngInput(formattedLng.toString());
    const label = locationNameInput.trim() || `Pinned Location (${formattedLat}, ${formattedLng})`;
    setLocationNameInput(label);
    setLastSelectedSource(`Map pin: ${formattedLat}, ${formattedLng}`);
    setSearchMessage(`Location Selected: ${formattedLat}, ${formattedLng}. Click "Save Selected Location" to confirm.`);
  };

  // Save coordinates to project with complete dual-layer persistence
  const handleSaveCoordinates = async (customLat?: number, customLng?: number, customLocName?: string) => {
    assertOperationalAction("write", "components/dashboard/ProjectLocationMapCard.tsx");
    let lat = customLat !== undefined ? customLat : parseFloat(latInput.trim());
    let lng = customLng !== undefined ? customLng : parseFloat(lngInput.trim());
    let locName = (customLocName !== undefined ? customLocName : locationNameInput).trim();

    // If inputs were not numeric yet, attempt auto-resolution from location name or search query
    if (isNaN(lat) || isNaN(lng)) {
      const candidateText = (locName || searchQuery || activeProject?.execution_location || activeProject?.location || "").toLowerCase().trim();
      let matched = false;
      if (candidateText) {
        for (const [city, c] of Object.entries(KNOWN_CITY_COORDINATES)) {
          if (candidateText.includes(city) || city.includes(candidateText)) {
            lat = c.lat;
            lng = c.lng;
            locName = locName || `${city.toUpperCase()}, Site Location`;
            matched = true;
            break;
          }
        }
      }
      // If still not matched, use modal preview center
      if (!matched) {
        lat = modalPreviewCoords[0];
        lng = modalPreviewCoords[1];
        locName = locName || "Site Location";
      }
    }

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setSearchMessage("Invalid coordinates. Please enter or click a location with Latitude between -90 and 90, Longitude between -180 and 180.");
      return;
    }

    const effectiveProjId = targetProjectId;
    if (!effectiveProjId) {
      setSearchMessage("Please select an active project before saving coordinates.");
      return;
    }

    setIsSaving(true);
    setSearchMessage(null);

    const companyId = activeProject?.company_id || activeProject?.organisation_id || activeCompany?.id || localStorage.getItem("pm_active_company_id") || "default";
    const finalLocLabel = locName || activeProject?.execution_location || activeProject?.location || "Site Location";

    // Immediate reactive local state update
    const coordsPayload: ResolvedCoordinates = { lat, lng, label: finalLocLabel, source: "user_pinned" };
    setPinnedCoords(coordsPayload);

    // Immediate reactive local storage caching across all keys
    try {
      localStorage.setItem(`pm_project_coords_${effectiveProjId}`, JSON.stringify(coordsPayload));
      localStorage.setItem(`projectmatrix_coords_proj_${effectiveProjId}`, JSON.stringify(coordsPayload));
      
      const storedActive = localStorage.getItem("pm_active_project");
      if (storedActive) {
        const parsedActive = JSON.parse(storedActive);
        if (parsedActive) {
          localStorage.setItem("pm_active_project", JSON.stringify({ ...parsedActive, latitude: lat, longitude: lng, execution_location: finalLocLabel }));
        }
      }
    } catch (_) {}

    const updates: any = {
      latitude: lat,
      longitude: lng,
      lat: lat,
      lng: lng,
      gps_coordinates: `${lat}, ${lng}`,
      execution_location: finalLocLabel,
      location: finalLocLabel,
    };

    let projectPayload = { ...(activeProject || {}), id: effectiveProjId, ...updates };

    try {
      const updated = await ProjectService.updateProject(effectiveProjId, companyId, updates);
      if (updated) {
        projectPayload = { ...updated, ...updates };
      }
    } catch (err) {
      console.warn("Could not save to remote database, saved to local store:", err);
      // Ensure local cache has updated project record
      try {
        const storedProjects = ProjectService.getStoredProjects(companyId);
        const idx = storedProjects.findIndex(p => p.id === effectiveProjId);
        if (idx >= 0) {
          storedProjects[idx] = { ...storedProjects[idx], ...updates };
          ProjectService.saveStoredProjects(companyId, storedProjects);
        }
      } catch (_) {}
    }

    // Update active project state in App.tsx
    if (onProjectChange) {
      onProjectChange(projectPayload);
    }

    // Broadcast global event so other tabs and modules update reactively
    try {
      window.dispatchEvent(new CustomEvent("project_coordinates_updated", {
        detail: { projectId: effectiveProjId, lat, lng, location: finalLocLabel }
      }));
      window.dispatchEvent(new CustomEvent("project_updated", {
        detail: projectPayload
      }));
    } catch (_) {}

    setIsSaving(false);
    setSaveSuccess(true);
    setIsModalOpen(false);
    setTimeout(() => setSaveSuccess(false), 4000);
  };

  // Resolve coordinates for other uploaded projects to show secondary markers
  const otherProjectsWithCoords = useMemo(() => {
    return allProjects
      .filter((p) => p.id !== activeProject?.id)
      .map((p) => {
        const coords = resolveProjectCoordinates(p);
        return { project: p, coords };
      })
      .filter((item): item is { project: any; coords: NonNullable<ReturnType<typeof resolveProjectCoordinates>> } => item.coords !== null);
  }, [allProjects, activeProject?.id]);

  // Derived current preview coordinates for the modal map
  const modalPreviewCoords = useMemo<[number, number]>(() => {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return [lat, lng];
    }
    if (projectCoords) {
      return [projectCoords.lat, projectCoords.lng];
    }
    // Default regional focus (Dar es Salaam / East Africa)
    return [-6.7924, 39.2083];
  }, [latInput, lngInput, projectCoords]);

  const hasSelectedCoords = useMemo(() => {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }, [latInput, lngInput]);

  const tileLayerUrl =
    mapLayer === "satellite"
      ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

  const modalTileLayerUrl =
    modalMapLayer === "satellite"
      ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

  const tileLayerAttribution =
    mapLayer === "satellite"
      ? "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye"
      : '&copy; <a href="https://carto.com/">CARTO</a>';

  return (
    <div
      id="project-location-gis-card"
      className={`bg-white dark:bg-[#0B172A] border border-[#E6E9EF] dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col gap-4 ${
        isFullscreen ? "fixed inset-4 z-50 overflow-auto bg-white dark:bg-slate-900" : ""
      } ${className}`}
    >
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="p-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg border border-blue-200 dark:border-blue-800 shrink-0">
              <Compass className="w-4 h-4" />
            </span>
            <h3 className="text-base font-semibold text-[#172033] dark:text-white tracking-tight whitespace-nowrap">
              Project Location & Satellite GIS Map
            </h3>
            {projectCoords ? (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1 shrink-0 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Pin
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shrink-0 whitespace-nowrap">
                Coordinates Needed
              </span>
            )}
          </div>
          <p className="text-xs text-[#667085] dark:text-slate-400 mt-1 line-clamp-2 max-w-2xl break-words">
            {activeProject?.name || "Active Project"} &bull;{" "}
            {activeProject?.execution_location || activeProject?.location || "Site location not assigned"}
            {projectCoords && ` (${projectCoords.lat.toFixed(4)}, ${projectCoords.lng.toFixed(4)})`}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
          {projectCoords && (
            <div className="flex items-center bg-[#F7F8FA] dark:bg-slate-800 p-0.5 rounded-xl border border-[#E6E9EF] dark:border-slate-700 text-xs shrink-0">
              <button
                type="button"
                onClick={() => setMapLayer("satellite")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  mapLayer === "satellite"
                    ? "bg-white dark:bg-slate-700 text-[#172033] dark:text-white shadow-2xs"
                    : "text-[#667085] hover:text-[#172033] dark:hover:text-white"
                }`}
              >
                Satellite
              </button>
              <button
                type="button"
                onClick={() => setMapLayer("streets")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  mapLayer === "streets"
                    ? "bg-white dark:bg-slate-700 text-[#172033] dark:text-white shadow-2xs"
                    : "text-[#667085] hover:text-[#172033] dark:hover:text-white"
                }`}
              >
                Streets
              </button>
            </div>
          )}

          <button
            type="button"
            id="btn-edit-coordinates"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-xs whitespace-nowrap shrink-0"
          >
            <Edit3 className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">{projectCoords ? "Edit Coordinates" : "Add Coordinates"}</span>
          </button>

          {projectCoords && (
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 bg-[#F7F8FA] dark:bg-slate-800 text-[#667085] dark:text-slate-400 hover:text-[#172033] dark:hover:text-white rounded-xl border border-[#E6E9EF] dark:border-slate-700 transition-colors cursor-pointer shrink-0"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Map"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Success Notification */}
      {saveSuccess && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Project GPS coordinates updated successfully. Site location is now pinned and live on the map.</span>
        </div>
      )}

      {/* Main Map View when coordinates exist */}
      {projectCoords ? (
        <div className="relative w-full h-[380px] sm:h-[420px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-inner">
          <MapContainer
            center={[projectCoords.lat, projectCoords.lng]}
            zoom={12}
            scrollWheelZoom={false}
            className="w-full h-full z-0"
          >
            <InvalidateSizeOnMount />
            <ChangeMapView center={[projectCoords.lat, projectCoords.lng]} zoom={12} />
            <TileLayer url={tileLayerUrl} attribution={tileLayerAttribution} maxZoom={19} />

            {/* Active Selected Project Marker */}
            <Marker
              position={[projectCoords.lat, projectCoords.lng]}
              icon={createProjectMarkerIcon("#2563eb", activeProject?.code || activeProject?.contract_code || "PRJ", true)}
            >
              <Popup className="custom-project-popup">
                <div className="p-2 space-y-1.5 min-w-[200px] text-xs font-sans">
                  <div className="flex items-center justify-between border-b pb-1">
                    <span className="font-bold text-blue-600">{activeProject?.code || activeProject?.contract_code || "PRJ"}</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold">
                      {activeProject?.status || "Active"}
                    </span>
                  </div>
                  <p className="font-bold text-slate-800 text-sm leading-tight">{activeProject?.name || "Project"}</p>
                  <p className="text-slate-500 text-[11px]">{activeProject?.client || activeProject?.client_organization || "Client"}</p>
                  <p className="text-slate-600 text-[11px] font-medium">{projectCoords.label || "Site Location"}</p>
                  <div className="pt-1 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>Progress: {getProjectRealProgress(activeProject)}%</span>
                    <span>GPS: {projectCoords.lat.toFixed(4)}, {projectCoords.lng.toFixed(4)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="mt-2 w-full py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Change Pin Location</span>
                  </button>
                </div>
              </Popup>
            </Marker>

            {/* Secondary markers for other uploaded projects */}
            {otherProjectsWithCoords.map(({ project, coords }) => (
              <Marker
                key={project.id}
                position={[coords.lat, coords.lng]}
                icon={createProjectMarkerIcon("#64748b", project.code || project.contract_code || "PRJ", false)}
                eventHandlers={{
                  click: () => {
                    if (onProjectChange) onProjectChange(project);
                  }
                }}
              >
                <Popup>
                  <div className="p-2 space-y-1 min-w-[180px] text-xs font-sans">
                    <p className="font-bold text-slate-800">{project.name || "Project"}</p>
                    <p className="text-[10px] text-slate-500">{coords.label}</p>
                    <button
                      type="button"
                      onClick={() => onProjectChange && onProjectChange(project)}
                      className="mt-1.5 w-full py-1 bg-blue-600 text-white rounded text-[10px] font-bold cursor-pointer"
                    >
                      Switch to this Project
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Floating Coordinate Pill */}
          <div className="absolute bottom-3 left-3 z-[400] bg-slate-900/85 backdrop-blur-md text-white px-3 py-1.5 rounded-xl border border-slate-700 shadow-lg text-[11px] font-mono flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>GPS: {projectCoords.lat.toFixed(5)}, {projectCoords.lng.toFixed(5)}</span>
            <span className="text-slate-400 text-[10px]">&bull; WGS84</span>
          </div>

          {/* Quick Recenter button */}
          <button
            type="button"
            onClick={() => {
              setMapLayer((l) => (l === "satellite" ? "streets" : "satellite"));
              setTimeout(() => setMapLayer((l) => (l === "satellite" ? "streets" : "satellite")), 50);
            }}
            className="absolute top-3 right-3 z-[400] bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-md text-slate-700 dark:text-slate-200 hover:text-blue-600 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span className="text-[11px]">Recenter</span>
          </button>
        </div>
      ) : (
        /* Empty State Prompt when no coordinates exist */
        <div className="py-10 px-6 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-900/40 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xs">
            <MapPin className="w-7 h-7" />
          </div>

          <div className="max-w-md space-y-1.5">
            <h4 className="text-base font-bold text-[#172033] dark:text-white">
              No GPS Coordinates Configured for {activeProject?.name || "this Project"}
            </h4>
            <p className="text-xs text-[#667085] dark:text-slate-400 leading-relaxed">
              Assign physical latitude and longitude coordinates to enable live satellite GIS mapping, site weather telemetry, and route tracking.
            </p>
          </div>

          {/* Main Requested Action Button */}
          <div className="pt-2">
            <button
              type="button"
              id="btn-enter-coordinates-pin"
              onClick={() => setIsModalOpen(true)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-md hover:shadow-lg transition-all"
            >
              <MapPin className="w-4 h-4" />
              <span>Enter Coordinates & Pin Location</span>
            </button>
          </div>

          {/* Quick Corridor Selection - 1-Click Save */}
          <div className="pt-2 flex flex-col items-center gap-2">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Or quick-save to a regional project corridor:
            </span>
            <div className="flex items-center gap-1.5 flex-wrap justify-center max-w-lg">
              {POPULAR_CORRIDORS.slice(0, 7).map((city) => (
                <button
                  key={city}
                  type="button"
                  onClick={() => handleQuickPinCorridor(city)}
                  disabled={isSaving}
                  className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 dark:hover:bg-slate-700 cursor-pointer transition-colors flex items-center gap-1"
                >
                  <MapPin className="w-3 h-3 text-blue-500" />
                  <span>{city}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Interactive Pinning & Coordinate Entry Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-scaleUp">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-200 dark:border-blue-800">
                  <MapPin className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    Select & Save Project Location
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {activeProject?.name || "Project"} &bull; {activeProject?.code || "PRJ"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {/* Instructions banner */}
              <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-xl p-3 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Select Location by Map Click, Search, or Preset Corridor</p>
                  <p className="text-blue-700 dark:text-blue-300 text-[11px] mt-0.5">
                    Click anywhere on the map preview below to drop a pin, search by place name, or pick a corridor. Then click <strong>"Save Selected Location"</strong> to persist.
                  </p>
                </div>
              </div>

              {/* Search Bar */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Search Location or Site Name
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <div className="relative flex-1 w-full">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="e.g. Tunduma, Songwe or Dar es Salaam or Nairobi..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSearchLocation();
                        }
                      }}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSearchLocation()}
                    disabled={isSearching}
                    className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    <span>{isSearching ? "Searching..." : "Lookup GPS"}</span>
                  </button>
                </div>
              </div>

              {/* Quick Corridors Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Quick Corridors:
                  </span>
                  <span className="text-[10px] text-slate-400">Click to select location</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {POPULAR_CORRIDORS.map((city) => (
                    <button
                      key={city}
                      type="button"
                      onClick={() => handleSelectCorridor(city)}
                      className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                    >
                      {city}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Message / Selected Location Card */}
              {searchMessage && (
                <div className="text-xs text-blue-800 dark:text-blue-200 bg-blue-50 dark:bg-blue-950/40 p-3 rounded-xl border border-blue-200 dark:border-blue-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>{searchMessage}</span>
                  </div>
                  {hasSelectedCoords && (
                    <button
                      type="button"
                      onClick={() => handleSaveCoordinates()}
                      disabled={isSaving}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shrink-0 flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3 h-3" />
                      <span>Save Now</span>
                    </button>
                  )}
                </div>
              )}

              {/* Interactive Pin-On-Map Picker Canvas */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-blue-500" />
                    Interactive Map: Click anywhere to drop / move pin
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setModalMapLayer("satellite")}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer ${
                        modalMapLayer === "satellite" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      Satellite
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalMapLayer("streets")}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer ${
                        modalMapLayer === "streets" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      Streets
                    </button>
                  </div>
                </div>

                <div className="relative w-full h-[240px] sm:h-[280px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 cursor-crosshair">
                  <MapContainer
                    center={modalPreviewCoords}
                    zoom={hasSelectedCoords ? 12 : 6}
                    scrollWheelZoom={true}
                    className="w-full h-full z-0"
                  >
                    <InvalidateSizeOnMount />
                    <ChangeMapView center={modalPreviewCoords} zoom={hasSelectedCoords ? 13 : 7} />
                    <TileLayer url={modalTileLayerUrl} attribution={tileLayerAttribution} maxZoom={19} />
                    <MapPinClickListener onLocationSelect={handleMapLocationSelect} />

                    {hasSelectedCoords && (
                      <Marker
                        position={[parseFloat(latInput), parseFloat(lngInput)]}
                        icon={createProjectMarkerIcon("#2563eb", activeProject?.code || "PIN", true)}
                      >
                        <Popup>
                          <div className="p-1 text-xs">
                            <p className="font-bold">{activeProject?.name || "Project Site"}</p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              {parseFloat(latInput).toFixed(4)}, {parseFloat(lngInput).toFixed(4)}
                            </p>
                          </div>
                        </Popup>
                      </Marker>
                    )}
                  </MapContainer>

                  {/* Visual Crosshair Helper Badge */}
                  <div className="absolute top-2 left-2 z-[400] bg-slate-900/80 backdrop-blur-md text-white px-2.5 py-1 rounded-lg text-[10px] font-mono flex items-center gap-1.5 pointer-events-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    <span>Click anywhere on map to pin</span>
                  </div>

                  {hasSelectedCoords && (
                    <div className="absolute bottom-2 left-2 z-[400] bg-slate-900/85 backdrop-blur-md text-white px-2.5 py-1 rounded-lg text-[10px] font-mono pointer-events-none flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>Selected: {parseFloat(latInput).toFixed(4)}, {parseFloat(lngInput).toFixed(4)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Coordinate Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Latitude (-90 to 90)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. -9.3000"
                    value={latInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      const pairMatch = val.trim().match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/);
                      if (pairMatch) {
                        setLatInput(pairMatch[1]);
                        setLngInput(pairMatch[2]);
                        setLastSelectedSource(`Pasted: ${pairMatch[1]}, ${pairMatch[2]}`);
                        setSearchMessage(`Pasted coordinates (${pairMatch[1]}, ${pairMatch[2]}). Click "Save Selected Location" to confirm.`);
                      } else {
                        setLatInput(val);
                      }
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Longitude (-180 to 180)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 32.7667"
                    value={lngInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      const pairMatch = val.trim().match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/);
                      if (pairMatch) {
                        setLatInput(pairMatch[1]);
                        setLngInput(pairMatch[2]);
                        setLastSelectedSource(`Pasted: ${pairMatch[1]}, ${pairMatch[2]}`);
                        setSearchMessage(`Pasted coordinates (${pairMatch[1]}, ${pairMatch[2]}). Click "Save Selected Location" to confirm.`);
                      } else {
                        setLngInput(val);
                      }
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Site Location Label
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Tunduma Border Road"
                    value={locationNameInput}
                    onChange={(e) => setLocationNameInput(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer - Always allows saving */}
            <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="btn-save-pinned-coordinates"
                  onClick={() => handleSaveCoordinates()}
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50 transition-all"
                >
                  {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{isSaving ? "Saving Location..." : "Save Selected Location"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
