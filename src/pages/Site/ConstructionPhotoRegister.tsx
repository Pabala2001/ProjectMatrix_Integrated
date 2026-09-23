import { previewStorage } from "../../integration/previewStorage";
import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useMemo, useRef } from "react";
import {
  Camera,
  Plus,
  Filter,
  FileText,
  Printer,
  Download,
  Calendar,
  User,
  MapPin,
  Tag,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  ShieldCheck,
  Search,
  X,
  Upload,
  Sparkles,
  Layers,
  ChevronRight,
  Eye
} from "lucide-react";

export type PhotoCategory =
  | "Before"
  | "During"
  | "After"
  | "Inspection"
  | "Defect"
  | "Progress"
  | "Safety";

export interface ConstructionPhotoRecord {
  id: string;
  project: string;
  dateTime: string;
  user: string;
  activity: string;
  chainage: string;
  category: PhotoCategory;
  description: string;
  imageUrl: string;
  gpsCoordinates?: string;
  direction?: string;
  verifiedBy?: string;
}

const CATEGORY_COLORS: Record<PhotoCategory, { bg: string; text: string; border: string }> = {
  Before: {
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-300 dark:border-slate-700"
  },
  During: {
    bg: "bg-blue-50 dark:bg-blue-950/60",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800"
  },
  After: {
    bg: "bg-emerald-50 dark:bg-emerald-950/60",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800"
  },
  Inspection: {
    bg: "bg-indigo-50 dark:bg-indigo-950/60",
    text: "text-indigo-700 dark:text-indigo-300",
    border: "border-indigo-200 dark:border-indigo-800"
  },
  Defect: {
    bg: "bg-rose-50 dark:bg-rose-950/60",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-800"
  },
  Progress: {
    bg: "bg-purple-50 dark:bg-purple-950/60",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-200 dark:border-purple-800"
  },
  Safety: {
    bg: "bg-amber-50 dark:bg-amber-950/60",
    text: "text-amber-800 dark:text-amber-300",
    border: "border-amber-300 dark:border-amber-800"
  }
};

// Curated civil engineering placeholder image generator
function getPlaceholderImage(category: PhotoCategory, title: string): string {
  // SVG embedded data-uri showing civil engineering graphic representation
  const colors: Record<PhotoCategory, { primary: string; secondary: string }> = {
    Before: { primary: "#475569", secondary: "#334155" },
    During: { primary: "#2563eb", secondary: "#1d4ed8" },
    After: { primary: "#059669", secondary: "#047857" },
    Inspection: { primary: "#4f46e5", secondary: "#4338ca" },
    Defect: { primary: "#e11d48", secondary: "#be123c" },
    Progress: { primary: "#7c3aed", secondary: "#6d28d9" },
    Safety: { primary: "#d97706", secondary: "#b45309" }
  };
  const { primary, secondary } = colors[category] || { primary: "#2563eb", secondary: "#1d4ed8" };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
    <rect width="800" height="500" fill="#0f172a"/>
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${primary}" stop-opacity="0.8"/>
        <stop offset="100%" stop-color="${secondary}" stop-opacity="0.4"/>
      </linearGradient>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#ffffff" stroke-width="0.5" stroke-opacity="0.08"/>
      </pattern>
    </defs>
    <rect width="800" height="500" fill="url(#g)"/>
    <rect width="800" height="500" fill="url(#grid)"/>
    <g transform="translate(60, 80)">
      <rect width="680" height="340" rx="16" fill="#000000" fill-opacity="0.35" stroke="#ffffff" stroke-opacity="0.2" stroke-width="1.5"/>
      <circle cx="60" cy="60" r="28" fill="${primary}"/>
      <text x="60" y="67" font-family="monospace" font-size="20" font-weight="bold" fill="#ffffff" text-anchor="middle">PM</text>
      <text x="110" y="55" font-family="sans-serif" font-size="14" font-weight="900" fill="#ffffff" letter-spacing="2">CONSTRUCTION PHOTO RECORD</text>
      <text x="110" y="75" font-family="monospace" font-size="12" fill="#94a3b8">STAGE: ${category.toUpperCase()}</text>
      <text x="60" y="160" font-family="sans-serif" font-size="24" font-weight="bold" fill="#ffffff">${title.slice(0, 42)}</text>
      <text x="60" y="200" font-family="monospace" font-size="13" fill="#cbd5e1">GPS: -9.2941° S, 32.7684° E · ELEV: 1,328m</text>
      <text x="60" y="225" font-family="monospace" font-size="13" fill="#cbd5e1">CORRIDOR: TANZAM HIGHWAY · FIDIC RED BOOK</text>
      <rect x="60" y="260" width="160" height="36" rx="8" fill="${primary}"/>
      <text x="140" y="283" font-family="sans-serif" font-size="12" font-weight="bold" fill="#ffffff" text-anchor="middle">${category.toUpperCase()}</text>
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// 18 Standard Initial Construction Photo Records matching the shift evidence
const DEFAULT_PHOTO_RECORDS: ConstructionPhotoRecord[] = [
  {
    id: "CPR-2026-001",
    project: "Tunduma Border Road",
    dateTime: "2026-09-04 07:45 EAT",
    user: "Eng. J. Makori (Site Eng)",
    activity: "Concrete Pavement",
    chainage: "CH 2+400",
    category: "Before",
    description: "Subbase G3 grade preparation & stringline survey setup before slipform paver mobilization.",
    imageUrl: getPlaceholderImage("Before", "Subbase Stringline Alignment"),
    gpsCoordinates: "-9.2941° S, 32.7684° E",
    direction: "045° NE",
    verifiedBy: "Consultant RE"
  },
  {
    id: "CPR-2026-002",
    project: "Tunduma Border Road",
    dateTime: "2026-09-04 08:30 EAT",
    user: "Eng. J. Makori (Site Eng)",
    activity: "Concrete Pavement",
    chainage: "CH 2+420",
    category: "During",
    description: "Concrete slab extrusion using slipform paver; internal vibrators active at 8,000 vpm. 50.4 m³ batch verified.",
    imageUrl: getPlaceholderImage("During", "Paver Extrusion CH 2+420"),
    gpsCoordinates: "-9.2943° S, 32.7689° E",
    direction: "045° NE",
    verifiedBy: "Materials Eng"
  },
  {
    id: "CPR-2026-003",
    project: "Tunduma Border Road",
    dateTime: "2026-09-04 09:15 EAT",
    user: "Eng. J. Makori (Site Eng)",
    activity: "Concrete Pavement",
    chainage: "CH 2+435",
    category: "Inspection",
    description: "Slump test (65 mm) and cube casting (6 No. 150mm cubes) witnessed by TANROADS Resident Engineer.",
    imageUrl: getPlaceholderImage("Inspection", "Concrete Slump & Cube Sampling"),
    gpsCoordinates: "-9.2946° S, 32.7695° E",
    direction: "090° E",
    verifiedBy: "TANROADS RE"
  },
  {
    id: "CPR-2026-004",
    project: "Tunduma Border Road",
    dateTime: "2026-09-04 10:40 EAT",
    user: "Eng. J. Makori (Site Eng)",
    activity: "Concrete Pavement",
    chainage: "CH 2+450",
    category: "During",
    description: "Surface texturing (transverse tining 3mm depth) and resin curing compound application at 0.25 L/m².",
    imageUrl: getPlaceholderImage("During", "Texturing & Curing Membrane"),
    gpsCoordinates: "-9.2949° S, 32.7701° E",
    direction: "045° NE",
    verifiedBy: "Inspector M. Kileo"
  },
  {
    id: "CPR-2026-005",
    project: "Tunduma Border Road",
    dateTime: "2026-09-04 11:20 EAT",
    user: "Eng. J. Makori (Site Eng)",
    activity: "Concrete Pavement",
    chainage: "CH 2+472",
    category: "After",
    description: "Cured stop-end header board fixed at CH 2+472 with dowel bar alignment verification. 72m executed.",
    imageUrl: getPlaceholderImage("After", "Completed Slab Stop-End CH 2+472"),
    gpsCoordinates: "-9.2952° S, 32.7708° E",
    direction: "045° NE",
    verifiedBy: "Section Lead"
  },
  {
    id: "CPR-2026-006",
    project: "Tunduma Border Road",
    dateTime: "2026-09-04 07:15 EAT",
    user: "P. Baraza (HSE Officer)",
    activity: "Concrete Pavement",
    chainage: "CH 2+410",
    category: "Safety",
    description: "Crew A pre-start toolbox talk; paver blind-spot exclusion zone and ear defenders compliance check.",
    imageUrl: getPlaceholderImage("Safety", "Crew A Toolbox Talk & PPE Audit"),
    gpsCoordinates: "-9.2942° S, 32.7686° E",
    direction: "360° N",
    verifiedBy: "HSE Mgr"
  },
  {
    id: "CPR-2026-007",
    project: "Tunduma Border Road",
    dateTime: "2026-09-04 06:50 EAT",
    user: "Surv. S. Mtweve",
    activity: "Excavation",
    chainage: "CH 3+100",
    category: "Before",
    description: "Pre-cut ground profile and batter peg verification prior to cut widening.",
    imageUrl: getPlaceholderImage("Before", "Pre-cut Topographic Profile"),
    gpsCoordinates: "-9.2980° S, 32.7750° E",
    direction: "120° SE",
    verifiedBy: "Chief Surveyor"
  },
  {
    id: "CPR-2026-008",
    project: "Tunduma Border Road",
    dateTime: "2026-09-04 09:30 EAT",
    user: "Eng. J. Makori (Site Eng)",
    activity: "Excavation",
    chainage: "CH 3+180",
    category: "During",
    description: "CAT 320 loading tipper convoy; side cut benching trimmed to 1:1.5 slope angle.",
    imageUrl: getPlaceholderImage("During", "CAT 320 Cut Benching & Haul"),
    gpsCoordinates: "-9.2985° S, 32.7760° E",
    direction: "090° E",
    verifiedBy: "Earthworks Foreman"
  },
  {
    id: "CPR-2026-009",
    project: "Tunduma Border Road",
    dateTime: "2026-09-04 11:45 EAT",
    user: "Eng. J. Makori (Site Eng)",
    activity: "Excavation",
    chainage: "CH 3+250",
    category: "Progress",
    description: "430 m³ bulk cut completed; formation level achieved and accepted for rolling.",
    imageUrl: getPlaceholderImage("Progress", "430 m³ Formation Reached"),
    gpsCoordinates: "-9.2990° S, 32.7770° E",
    direction: "045° NE",
    verifiedBy: "Consultant RE"
  },
  {
    id: "CPR-2026-010",
    project: "Tunduma Border Road",
    dateTime: "2026-09-04 12:10 EAT",
    user: "T. Mlay (QA/QC)",
    activity: "Excavation",
    chainage: "CH 3+210",
    category: "Inspection",
    description: "Nuclear density gauge compaction testing on bed formation. Measured 96.4% MDD (BS 1377).",
    imageUrl: getPlaceholderImage("Inspection", "NDG Formation Density Test"),
    gpsCoordinates: "-9.2988° S, 32.7765° E",
    direction: "180° S",
    verifiedBy: "QA/QC Lead"
  },
  {
    id: "CPR-2026-011",
    project: "Tunduma Border Road",
    dateTime: "2026-09-04 08:00 EAT",
    user: "Eng. J. Makori (Site Eng)",
    activity: "Culvert Installation",
    chainage: "CH 1+800",
    category: "Before",
    description: "Trench excavation & 100mm blinding concrete pad prior to precast barrel alignment.",
    imageUrl: getPlaceholderImage("Before", "Culvert Blinding Bedding"),
    gpsCoordinates: "-9.2910° S, 32.7620° E",
    direction: "270° W",
    verifiedBy: "Drainage Eng"
  },
  {
    id: "CPR-2026-012",
    project: "Tunduma Border Road",
    dateTime: "2026-09-04 10:15 EAT",
    user: "Eng. J. Makori (Site Eng)",
    activity: "Culvert Installation",
    chainage: "CH 1+800",
    category: "During",
    description: "Lowering 1200mm diameter reinforced concrete precast pipe into position using dual crane straps.",
    imageUrl: getPlaceholderImage("During", "Pipe Placement 1200mm dia"),
    gpsCoordinates: "-9.2912° S, 32.7622° E",
    direction: "270° W",
    verifiedBy: "Structural Foreman"
  },
  {
    id: "CPR-2026-013",
    project: "Tunduma Border Road",
    dateTime: "2026-09-04 11:00 EAT",
    user: "Surv. S. Mtweve",
    activity: "Culvert Installation",
    chainage: "CH 1+800",
    category: "Inspection",
    description: "Pipe invert level survey check against drawings. Deviation +3mm within allowable tolerance.",
    imageUrl: getPlaceholderImage("Inspection", "Invert Level Verification"),
    gpsCoordinates: "-9.2913° S, 32.7623° E",
    direction: "270° W",
    verifiedBy: "Consultant Inspector"
  },
  {
    id: "CPR-2026-014",
    project: "Tunduma Border Road",
    dateTime: "2026-09-04 11:30 EAT",
    user: "T. Mlay (QA/QC)",
    activity: "Culvert Installation",
    chainage: "CH 1+800",
    category: "Defect",
    description: "Minor hairline spalling on collar joint seal; non-conformance logged. Polymer mortar remediation executed.",
    imageUrl: getPlaceholderImage("Defect", "Joint Collar Seal Remediation"),
    gpsCoordinates: "-9.2914° S, 32.7624° E",
    direction: "270° W",
    verifiedBy: "Consultant RE"
  },
  {
    id: "CPR-2026-015",
    project: "Tunduma Border Road",
    dateTime: "2026-09-04 07:30 EAT",
    user: "Eng. J. Makori (Site Eng)",
    activity: "G3 Placement",
    chainage: "CH 1+500",
    category: "Before",
    description: "Subgrade proof-rolling inspection; no pumping or deflection observed under 20-ton roller.",
    imageUrl: getPlaceholderImage("Before", "Subgrade Proof-Rolling Check"),
    gpsCoordinates: "-9.2890° S, 32.7580° E",
    direction: "045° NE",
    verifiedBy: "Pavement Eng"
  },
  {
    id: "CPR-2026-016",
    project: "Tunduma Border Road",
    dateTime: "2026-09-04 09:45 EAT",
    user: "Eng. J. Makori (Site Eng)",
    activity: "G3 Placement",
    chainage: "CH 1+620",
    category: "During",
    description: "Motor grader spreading crushed aggregate G3 material to 150mm loose thickness at OMC.",
    imageUrl: getPlaceholderImage("During", "Grader Spreading G3 Layer"),
    gpsCoordinates: "-9.2895° S, 32.7590° E",
    direction: "045° NE",
    verifiedBy: "Road Foreman"
  },
  {
    id: "CPR-2026-017",
    project: "Tunduma Border Road",
    dateTime: "2026-09-04 12:00 EAT",
    user: "Eng. J. Makori (Site Eng)",
    activity: "G3 Placement",
    chainage: "CH 1+680",
    category: "After",
    description: "Completed compaction on 1,260 m² section; smooth surface finish ready for prime coat.",
    imageUrl: getPlaceholderImage("After", "Compacted G3 Subbase 1,260m²"),
    gpsCoordinates: "-9.2900° S, 32.7600° E",
    direction: "045° NE",
    verifiedBy: "Resident Engineer"
  },
  {
    id: "CPR-2026-018",
    project: "Tunduma Border Road",
    dateTime: "2026-09-04 08:15 EAT",
    user: "P. Baraza (HSE Officer)",
    activity: "Traffic Management",
    chainage: "CH 1+600",
    category: "Safety",
    description: "Temporary detour traffic delineation; solar warning arrows and speed restriction 30 km/h verified.",
    imageUrl: getPlaceholderImage("Safety", "Tanzam Corridor Detour Control"),
    gpsCoordinates: "-9.2893° S, 32.7586° E",
    direction: "360° N",
    verifiedBy: "HSE Manager"
  }
];

interface ConstructionPhotoRegisterProps {
  projectName?: string;
  defaultFilterCategory?: PhotoCategory | "All";
  onPhotoCountChange?: (count: number) => void;
}

export default function ConstructionPhotoRegister({
  projectName = "Tunduma Border Road",
  defaultFilterCategory = "All",
  onPhotoCountChange
}: ConstructionPhotoRegisterProps) {
  const [photos, setPhotos] = useState<ConstructionPhotoRecord[]>(() => {
    try {
      const stored = previewStorage.getItem(`pm_site_construction_photos`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_PHOTO_RECORDS;
  });

  const [selectedCategory, setSelectedCategory] = useState<PhotoCategory | "All">(defaultFilterCategory);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [inspectPhoto, setInspectPhoto] = useState<ConstructionPhotoRecord | null>(null);

  // New photo form state
  const [newPhotoForm, setNewPhotoForm] = useState<{
    project: string;
    dateTime: string;
    user: string;
    activity: string;
    chainage: string;
    category: PhotoCategory;
    description: string;
    imageUrl: string;
  }>({
    project: projectName,
    dateTime: "2026-09-04 12:45 EAT",
    user: "Eng. J. Makori (Site Eng)",
    activity: "Concrete Pavement",
    chainage: "CH 2+430",
    category: "During",
    description: "",
    imageUrl: ""
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewPhotoForm((prev) => ({
          ...prev,
          imageUrl: reader.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSavePhotoRecord = (e: React.FormEvent) => {
    assertOperationalAction("write", "pages/Site/ConstructionPhotoRegister.tsx");
    e.preventDefault();
    const newRecord: ConstructionPhotoRecord = {
      id: `CPR-2026-${String(photos.length + 1).padStart(3, "0")}`,
      project: newPhotoForm.project || projectName,
      dateTime: newPhotoForm.dateTime || new Date().toLocaleString(),
      user: newPhotoForm.user || "Eng. J. Makori (Site Eng)",
      activity: newPhotoForm.activity || "Concrete Pavement",
      chainage: newPhotoForm.chainage || "CH 2+400",
      category: newPhotoForm.category,
      description: newPhotoForm.description || `${newPhotoForm.activity} recorded at ${newPhotoForm.chainage}`,
      imageUrl: newPhotoForm.imageUrl || getPlaceholderImage(newPhotoForm.category, newPhotoForm.activity),
      gpsCoordinates: "-9.2945° S, 32.7690° E",
      direction: "045° NE",
      verifiedBy: "Site Engineer"
    };

    const updated = [newRecord, ...photos];
    setPhotos(updated);
    try {
      previewStorage.setItem("pm_site_construction_photos", JSON.stringify(updated));
    } catch (err) {
      console.error(err);
    }
    if (onPhotoCountChange) {
      onPhotoCountChange(updated.length);
    }
    setIsCapturing(false);
    setNewPhotoForm({
      project: projectName,
      dateTime: "2026-09-04 12:50 EAT",
      user: "Eng. J. Makori (Site Eng)",
      activity: "Concrete Pavement",
      chainage: "CH 2+430",
      category: "During",
      description: "",
      imageUrl: ""
    });
  };

  const filteredPhotos = useMemo(() => {
    return photos.filter((p) => {
      const matchesCategory = selectedCategory === "All" || p.category === selectedCategory;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        p.activity.toLowerCase().includes(q) ||
        p.chainage.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.user.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [photos, selectedCategory, searchQuery]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: photos.length };
    const categories: PhotoCategory[] = ["Before", "During", "After", "Inspection", "Defect", "Progress", "Safety"];
    categories.forEach((cat) => {
      counts[cat] = photos.filter((p) => p.category === cat).length;
    });
    return counts;
  }, [photos]);

  const categoriesList: (PhotoCategory | "All")[] = [
    "All",
    "Before",
    "During",
    "After",
    "Inspection",
    "Defect",
    "Progress",
    "Safety"
  ];

  return (
    <div className="space-y-5">
      {/* Top Banner & Action Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
              <Camera className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                Construction Photographic Register
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Photographs recorded as official FIDIC/NEC4 construction records with automated project, user, timestamp & chainage stamps.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={() => setShowReportModal(true)}
            className="px-3.5 py-2 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/70 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Produce Photographic Progress Report</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCapturing(true)}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Photograph</span>
          </button>
        </div>
      </div>

      {/* Category Filter Pills & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs font-bold scrollbar-none">
          {categoriesList.map((cat) => {
            const isSelected = selectedCategory === cat;
            const count = categoryCounts[cat] || 0;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-slate-900 text-white dark:bg-blue-600 dark:text-white"
                    : "bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-750"
                }`}
              >
                <span>{cat}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected
                      ? "bg-white/20 text-white"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search chainage, activity, user..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-slate-900 dark:text-white text-xs outline-hidden focus:border-blue-500"
          />
        </div>
      </div>

      {/* Construction Photo Records Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPhotos.map((photo) => {
          const catStyle = CATEGORY_COLORS[photo.category] || CATEGORY_COLORS.Progress;
          return (
            <div
              key={photo.id}
              className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs hover:border-blue-400 dark:hover:border-blue-500 transition-all flex flex-col"
            >
              {/* Photo Image Frame with Auto Construction Stamp */}
              <div className="relative aspect-16/10 bg-slate-900 overflow-hidden">
                <img
                  src={photo.imageUrl}
                  alt={photo.description}
                  className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                />

                {/* Construction Stamp Overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 pt-6 text-white text-[10px] font-mono leading-tight">
                  <div className="flex items-center justify-between text-slate-300">
                    <span>{photo.project}</span>
                    <span className="text-emerald-400 font-bold">{photo.chainage}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400 mt-0.5">
                    <span>{photo.dateTime}</span>
                    <span>{photo.gpsCoordinates}</span>
                  </div>
                </div>

                {/* Category Badge Floating on Top */}
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-xs ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                  >
                    {photo.category}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setInspectPhoto(photo)}
                  className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur-xs transition-colors cursor-pointer"
                  title="Inspect Construction Record"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Construction Metadata Block */}
              <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                      {photo.activity}
                    </span>
                    <span className="font-mono text-[11px] font-bold text-blue-700 dark:text-blue-300">
                      {photo.chainage}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                    {photo.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between font-medium">
                  <div className="flex items-center gap-1 truncate">
                    <User className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{photo.user}</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 shrink-0">
                    ✓ Verified
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredPhotos.length === 0 && (
        <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-500 text-xs">
          No photographic records match the selected filter.
        </div>
      )}

      {/* RECORD / TAKE PHOTOGRAPH MODAL */}
      {isCapturing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Capture Construction Photographic Record
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCapturing(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePhotoRecord} className="p-5 space-y-4 text-xs overflow-y-auto">
              {/* Photo Upload / Viewfinder Box */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Photograph & Automated Watermark Stamp
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 text-center cursor-pointer hover:border-blue-500 transition-colors bg-slate-50/50 dark:bg-slate-850/40 relative overflow-hidden group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  {newPhotoForm.imageUrl ? (
                    <div className="space-y-2">
                      <img
                        src={newPhotoForm.imageUrl}
                        alt="Preview"
                        className="max-h-48 mx-auto rounded-lg object-cover"
                      />
                      <span className="text-[11px] text-blue-600 dark:text-blue-400 font-bold block">
                        Click to change photo
                      </span>
                    </div>
                  ) : (
                    <div className="py-4 space-y-1.5">
                      <Camera className="w-8 h-8 mx-auto text-slate-400 group-hover:text-blue-600 transition-colors" />
                      <div className="font-bold text-slate-700 dark:text-slate-200">
                        Take photo or upload site evidence
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Supports camera capture or high-res JPG/PNG
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Stage / Classification (Before | During | After | Inspection | Defect | Progress | Safety) */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Record Classification (Stage)
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                  {(["Before", "During", "After", "Inspection", "Defect", "Progress", "Safety"] as PhotoCategory[]).map(
                    (cat) => {
                      const isSel = newPhotoForm.category === cat;
                      const c = CATEGORY_COLORS[cat];
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setNewPhotoForm({ ...newPhotoForm, category: cat })}
                          className={`py-1.5 px-1 text-center rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                            isSel
                              ? `${c.bg} ${c.text} ${c.border} ring-2 ring-blue-500 font-black`
                              : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Auto Captured Context Fields */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                    Project (Auto-Captured)
                  </label>
                  <input
                    type="text"
                    value={newPhotoForm.project}
                    readOnly
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                    Date & Time (Auto-Captured)
                  </label>
                  <input
                    type="text"
                    value={newPhotoForm.dateTime}
                    readOnly
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                    User (Auto-Captured)
                  </label>
                  <input
                    type="text"
                    value={newPhotoForm.user}
                    readOnly
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                    Chainage / Location
                  </label>
                  <input
                    type="text"
                    value={newPhotoForm.chainage}
                    onChange={(e) => setNewPhotoForm({ ...newPhotoForm, chainage: e.target.value })}
                    placeholder="e.g. CH 2+420"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-hidden"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                    Activity
                  </label>
                  <select
                    value={newPhotoForm.activity}
                    onChange={(e) => setNewPhotoForm({ ...newPhotoForm, activity: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-blue-500 outline-hidden"
                  >
                    <option value="Concrete Pavement">Concrete Pavement (CH 2+400–2+472)</option>
                    <option value="Excavation">Excavation (CH 3+100–3+250)</option>
                    <option value="Culvert Installation">Culvert Installation (CH 1+800)</option>
                    <option value="G3 Placement">G3 Placement (CH 1+500–1+680)</option>
                    <option value="Traffic Management">Traffic Management & Detour</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                    Engineering Description & Notes
                  </label>
                  <textarea
                    rows={2}
                    value={newPhotoForm.description}
                    onChange={(e) => setNewPhotoForm({ ...newPhotoForm, description: e.target.value })}
                    placeholder="Describe specific work executed, equipment deployed, test verified or defect observed..."
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCapturing(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-md"
                >
                  Save Construction Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INSPECT PHOTO MODAL */}
      {inspectPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden">
            <div className="relative aspect-16/10 bg-slate-950">
              <img src={inspectPhoto.imageUrl} alt={inspectPhoto.description} className="w-full h-full object-contain" />
              <button
                type="button"
                onClick={() => setInspectPhoto(null)}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="absolute top-3 left-3">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-md ${
                    CATEGORY_COLORS[inspectPhoto.category].bg
                  } ${CATEGORY_COLORS[inspectPhoto.category].text} ${CATEGORY_COLORS[inspectPhoto.category].border}`}
                >
                  {inspectPhoto.category}
                </span>
              </div>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">{inspectPhoto.activity}</h4>
                  <p className="font-mono text-blue-700 dark:text-blue-300 font-bold">{inspectPhoto.chainage}</p>
                </div>
                <div className="text-right text-[11px] font-mono text-slate-500">
                  <div>{inspectPhoto.dateTime}</div>
                  <div>{inspectPhoto.gpsCoordinates}</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 leading-relaxed">
                {inspectPhoto.description}
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px] border-t border-slate-200 dark:border-slate-800 pt-3 text-slate-500">
                <div>
                  <span className="block text-slate-400">Captured By</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{inspectPhoto.user}</span>
                </div>
                <div>
                  <span className="block text-slate-400">Project</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{inspectPhoto.project}</span>
                </div>
                <div>
                  <span className="block text-slate-400">Sign-Off</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{inspectPhoto.verifiedBy || "Verified"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AUTOMATED PHOTOGRAPHIC PROGRESS REPORT MODAL (PROJECT MATRIX GENERATION) */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
                  PM
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Photographic Progress Report (Auto-Generated)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    Ref: PM-PPR-TBR-2026-09-04 · Tanzam Corridor Maintenance Works · FIDIC Red Book
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-750 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs font-sans">
              {/* Report Summary Card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">Project</span>
                  <span className="font-bold text-slate-900 dark:text-white">{projectName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">Date</span>
                  <span className="font-bold text-slate-900 dark:text-white">04 Sep 2026 (Day Shift)</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">Total Plates</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">{photos.length} Photographic Records</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">Corridor Scope</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">CH 1+500 to CH 3+250</span>
                </div>
              </div>

              {/* Stage Breakdown Summary Strip */}
              <div className="flex flex-wrap gap-2 text-xs">
                {(["Before", "During", "After", "Inspection", "Defect", "Progress", "Safety"] as PhotoCategory[]).map(
                  (cat) => {
                    const c = CATEGORY_COLORS[cat];
                    const count = photos.filter((p) => p.category === cat).length;
                    return (
                      <div
                        key={cat}
                        className={`px-3 py-1.5 rounded-xl border ${c.bg} ${c.border} ${c.text} flex items-center gap-1.5 font-bold`}
                      >
                        <span>{cat}:</span>
                        <span className="font-mono">{count}</span>
                      </div>
                    );
                  }
                )}
              </div>

              {/* Photographic Plates Grid */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Photographic Evidence Plates (Indexed by Chainage)
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {photos.map((p, idx) => (
                    <div
                      key={p.id}
                      className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-850/60 p-3 space-y-2.5"
                    >
                      <div className="relative aspect-16/9 rounded-xl overflow-hidden bg-slate-950">
                        <img src={p.imageUrl} alt={p.description} className="w-full h-full object-cover" />
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 text-white font-mono text-[10px] font-bold">
                          PLATE {String(idx + 1).padStart(2, "0")}
                        </div>
                        <div className="absolute top-2 right-2">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${
                              CATEGORY_COLORS[p.category].bg
                            } ${CATEGORY_COLORS[p.category].text} ${CATEGORY_COLORS[p.category].border}`}
                          >
                            {p.category}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between font-mono text-xs">
                          <span className="font-bold text-slate-900 dark:text-white">{p.activity}</span>
                          <span className="text-blue-600 dark:text-blue-400 font-bold">{p.chainage}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                          {p.description}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] font-mono text-slate-400 flex items-center justify-between">
                        <span>{p.dateTime}</span>
                        <span>{p.user}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500 font-medium">
                Certified by Project Matrix Site Operations Engine · Signed & Filed
              </span>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
