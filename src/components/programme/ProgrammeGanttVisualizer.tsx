import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { EngineActivity, ProjectCalendar, RelationshipType, ActivityType } from "../../types/programmeEngine";
import { parseDate, formatDate, calendarDaysDiff } from "../../services/cpmEngine";
import { 
  Calendar, 
  ZoomIn, 
  ZoomOut, 
  Flame, 
  Eye, 
  Maximize2, 
  Minimize2,
  Layers, 
  ArrowRight, 
  Info,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Filter, 
  SlidersHorizontal, 
  Target, 
  Sparkles, 
  Link as LinkIcon,
  Columns,
  FolderTree,
  ChevronUp,
  X,
  Edit3,
  ExternalLink,
  SplitSquareVertical,
  Check,
  CalendarDays,
  ShieldCheck
} from "lucide-react";

interface ProgrammeGanttVisualizerProps {
  activities: EngineActivity[];
  dataDate: string;
  calendars: Record<string, ProjectCalendar>;
  programmeStart?: string;
  programmeFinish?: string;
  onSelectActivity?: (id: string) => void;
  selectedActivityId?: string | null;
  onEditActivity?: (activity: EngineActivity) => void;
  onViewActivity?: (activity: EngineActivity) => void;
  onDeleteActivity?: (id: string) => void;
}

const ROW_HEIGHT = 42; // Standard pixel height for both table and gantt rows for pixel-perfect alignment

/**
 * Generate orthogonal path with smooth rounded corner fillets (like MS Project / Primavera P6)
 */
function generateOrthogonalPath(points: { x: number; y: number }[], radius = 3.5): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const dxIn = curr.x - prev.x;
    const dyIn = curr.y - prev.y;
    const dxOut = next.x - curr.x;
    const dyOut = next.y - curr.y;

    const lenIn = Math.hypot(dxIn, dyIn);
    const lenOut = Math.hypot(dxOut, dyOut);

    if (lenIn === 0 || lenOut === 0) {
      d += ` L ${curr.x} ${curr.y}`;
      continue;
    }

    const dirInX = dxIn / lenIn;
    const dirInY = dyIn / lenIn;
    const dirOutX = dxOut / lenOut;
    const dirOutY = dyOut / lenOut;

    const r = Math.min(radius, lenIn / 2, lenOut / 2);

    if (r <= 0.5 || (dirInX === dirOutX && dirInY === dirOutY)) {
      d += ` L ${curr.x} ${curr.y}`;
    } else {
      const p1x = curr.x - dirInX * r;
      const p1y = curr.y - dirInY * r;
      const p2x = curr.x + dirOutX * r;
      const p2y = curr.y + dirOutY * r;

      d += ` L ${p1x} ${p1y} Q ${curr.x} ${curr.y} ${p2x} ${p2y}`;
    }
  }

  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

export const ProgrammeGanttVisualizer: React.FC<ProgrammeGanttVisualizerProps> = ({
  activities,
  dataDate,
  calendars,
  programmeStart,
  programmeFinish,
  onSelectActivity,
  selectedActivityId,
  onEditActivity,
  onViewActivity,
  onDeleteActivity
}) => {
  // Timeline zoom
  const [zoomLevel, setZoomLevel] = useState<"day" | "week" | "month">("week");
  const [customDayWidth, setCustomDayWidth] = useState<number | null>(null);

  // Gantt visual layers
  const [showLinks, setShowLinks] = useState(true);
  const [showCriticalGlow, setShowCriticalGlow] = useState(true);
  const [showBaseline0, setShowBaseline0] = useState(true);
  const [showBaseline1, setShowBaseline1] = useState(false);
  const [showFloatWhiskers, setShowFloatWhiskers] = useState(true);
  const [showWeekendStripes, setShowWeekendStripes] = useState(true);
  const [showLagLabels, setShowLagLabels] = useState(true);

  // Split-screen pane layout (default 44% table / 56% Gantt)
  const [splitPercent, setSplitPercent] = useState<number>(44);
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Columns visibility state
  // Default visible columns: WBS, Activity Name, Duration, Start Date, Finish Date, % Complete
  const [visibleColumns, setVisibleColumns] = useState<{
    wbs: boolean;
    name: boolean;
    duration: boolean;
    start: boolean;
    finish: boolean;
    progress: boolean;
    totalFloat: boolean;
    freeFloat: boolean;
    status: boolean;
    critical: boolean;
    predecessors: boolean;
    successors: boolean;
    calendar: boolean;
  }>({
    wbs: true,
    name: true,
    duration: true,
    start: true,
    finish: true,
    progress: true,
    totalFloat: false,
    freeFloat: false,
    status: false,
    critical: false,
    predecessors: false,
    successors: false,
    calendar: false
  });

  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);

  // WBS Hierarchy & Collapse State
  const [collapsedWbsNodes, setCollapsedWbsNodes] = useState<Set<string>>(new Set());

  // Activity Details Panel Drawer State
  const [isDetailsPanelOpen, setIsDetailsPanelOpen] = useState(true);
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);

  // Synchronized scroll refs
  const leftTableScrollRef = useRef<HTMLDivElement>(null);
  const leftTableHeaderRef = useRef<HTMLDivElement>(null);
  const rightGanttScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingScrollRef = useRef(false);

  // Synchronize vertical & horizontal scrolling
  const handleLeftScroll = () => {
    if (isSyncingScrollRef.current) return;
    isSyncingScrollRef.current = true;
    if (rightGanttScrollRef.current && leftTableScrollRef.current) {
      rightGanttScrollRef.current.scrollTop = leftTableScrollRef.current.scrollTop;
    }
    if (leftTableHeaderRef.current && leftTableScrollRef.current) {
      leftTableHeaderRef.current.scrollLeft = leftTableScrollRef.current.scrollLeft;
    }
    isSyncingScrollRef.current = false;
  };

  const handleHeaderScroll = () => {
    if (isSyncingScrollRef.current) return;
    isSyncingScrollRef.current = true;
    if (leftTableScrollRef.current && leftTableHeaderRef.current) {
      leftTableScrollRef.current.scrollLeft = leftTableHeaderRef.current.scrollLeft;
    }
    isSyncingScrollRef.current = false;
  };

  const handleRightScroll = () => {
    if (isSyncingScrollRef.current) return;
    isSyncingScrollRef.current = true;
    if (leftTableScrollRef.current && rightGanttScrollRef.current) {
      leftTableScrollRef.current.scrollTop = rightGanttScrollRef.current.scrollTop;
    }
    isSyncingScrollRef.current = false;
  };

  // Drag divider logic
  const handleDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingDivider(true);

    const startX = e.clientX;
    const startPercent = splitPercent;
    const containerWidth = containerRef.current?.getBoundingClientRect().width || 1200;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = (deltaX / containerWidth) * 100;
      const nextPercent = Math.max(22, Math.min(65, startPercent + deltaPercent));
      setSplitPercent(nextPercent);
    };

    const handleMouseUp = () => {
      setIsDraggingDivider(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Calculate WBS Hierarchy tree and levels for each activity
  const { hierarchyMap, summaryNodeIds, maxHierarchyLevel } = useMemo(() => {
    const map = new Map<string, { level: number; hasChildren: boolean; parentId: string | null }>();
    const summaryIds = new Set<string>();
    let maxLevel = 1;

    // First pass: detect parent/child by wbsCode or parentId
    activities.forEach(act => {
      let level = 1;
      let parentId: string | null = act.parentId || null;

      if (act.wbsCode) {
        const dotParts = act.wbsCode.split(".");
        if (dotParts.length > 1) {
          level = dotParts.length;
        }
      }

      if (act.activityType === "Summary") {
        summaryIds.add(act.id);
      }

      if (level > maxLevel) maxLevel = level;
      map.set(act.id, { level, hasChildren: false, parentId });
    });

    // Check if any activity is parent of others based on WBS prefix or parentId
    activities.forEach(act => {
      const isParentByCode = activities.some(
        other => other.id !== act.id && other.wbsCode?.startsWith(act.wbsCode + ".")
      );
      const isParentById = activities.some(other => other.parentId === act.id);

      if (isParentByCode || isParentById || act.activityType === "Summary") {
        summaryIds.add(act.id);
        const cur = map.get(act.id);
        if (cur) {
          cur.hasChildren = true;
        }
      }
    });

    return { hierarchyMap: map, summaryNodeIds: summaryIds, maxHierarchyLevel: Math.max(3, maxLevel) };
  }, [activities]);

  // Expand / Collapse WBS Hierarchy Level helper
  const handleSetHierarchyLevel = (level: number) => {
    const toCollapse = new Set<string>();
    summaryNodeIds.forEach(id => {
      const info = hierarchyMap.get(id);
      if (info && info.level >= level) {
        toCollapse.add(id);
      }
    });
    setCollapsedWbsNodes(toCollapse);
  };

  const handleExpandAll = () => {
    setCollapsedWbsNodes(new Set());
  };

  const handleCollapseAll = () => {
    setCollapsedWbsNodes(new Set(summaryNodeIds));
  };

  const toggleCollapseWbsNode = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCollapsedWbsNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Filter activities by visibility based on collapsed parent nodes
  const visibleActivities = useMemo(() => {
    if (collapsedWbsNodes.size === 0) return activities;

    return activities.filter(act => {
      // Check if act has an ancestor that is collapsed
      for (const collapsedId of collapsedWbsNodes) {
        const collapsedAct = activities.find(a => a.id === collapsedId);
        if (!collapsedAct) continue;

        if (collapsedAct.id === act.id) {
          // The summary node itself is visible
          return true;
        }

        // Child by parentId
        if (act.parentId === collapsedId) return false;

        // Child by WBS Code prefix (e.g. 1.1 is child of 1)
        if (collapsedAct.wbsCode && act.wbsCode && act.wbsCode.startsWith(collapsedAct.wbsCode + ".")) {
          return false;
        }
      }
      return true;
    });
  }, [activities, collapsedWbsNodes]);

  // Day width in pixels according to zoom level
  const dayWidth = useMemo(() => {
    if (customDayWidth !== null) return customDayWidth;
    switch (zoomLevel) {
      case "day": return 34;
      case "week": return 14;
      case "month": return 5;
    }
  }, [zoomLevel, customDayWidth]);

  // Determine overall timeline date bounds from synchronized programmeStart & programmeFinish
  const { minDate, maxDate, totalCalendarDays } = useMemo(() => {
    let earliest: Date;
    let latest: Date;

    if (programmeStart && parseDate(programmeStart)) {
      earliest = parseDate(programmeStart)!;
    } else {
      earliest = parseDate(dataDate) || new Date();
      activities.forEach(act => {
        [
          act.earlyStart, 
          act.earlyFinish, 
          act.actualStart,
          act.actualFinish,
          act.plannedStart,
          act.plannedFinish,
          act.lateStart,
          act.lateFinish,
          act.forecastStart, 
          act.forecastFinish, 
          act.baseline0?.baselineStart, 
          act.baseline0?.baselineFinish, 
          act.baseline1?.baselineStart, 
          act.baseline1?.baselineFinish
        ].forEach(dStr => {
          if (!dStr) return;
          const d = parseDate(dStr);
          if (d && d < earliest) earliest = d;
        });
      });
    }

    if (programmeFinish && parseDate(programmeFinish)) {
      latest = parseDate(programmeFinish)!;
    } else {
      latest = parseDate(dataDate) || new Date();
      activities.forEach(act => {
        [
          act.earlyStart, 
          act.earlyFinish, 
          act.actualStart,
          act.actualFinish,
          act.plannedStart,
          act.plannedFinish,
          act.lateStart,
          act.lateFinish,
          act.forecastStart, 
          act.forecastFinish, 
          act.baseline0?.baselineStart, 
          act.baseline0?.baselineFinish, 
          act.baseline1?.baselineStart, 
          act.baseline1?.baselineFinish
        ].forEach(dStr => {
          if (!dStr) return;
          const d = parseDate(dStr);
          if (d && d > latest) latest = d;
        });
      });
    }

    // Set min/max X-axis scale with padding days for clean timeline margin
    const minD = new Date(earliest);
    minD.setDate(minD.getDate() - 10);
    const maxD = new Date(latest);
    maxD.setDate(maxD.getDate() + 20);

    const totalDays = Math.max(30, calendarDaysDiff(maxD, minD));
    return { minDate: minD, maxDate: maxD, totalCalendarDays: totalDays };
  }, [activities, dataDate, programmeStart, programmeFinish]);

  const timelineWidth = totalCalendarDays * dayWidth;

  // Calculate pixel position from date string
  const getXPosition = useCallback((dateStr?: string | null): number => {
    if (!dateStr) return 0;
    const d = parseDate(dateStr);
    if (!d) return 0;
    const diff = calendarDaysDiff(d, minDate);
    return Math.max(0, diff * dayWidth);
  }, [minDate, dayWidth]);

  const dataDateX = getXPosition(dataDate);
  const programmeStartX = programmeStart ? getXPosition(programmeStart) : null;
  const programmeFinishX = programmeFinish ? getXPosition(programmeFinish) + dayWidth : null;

  // Timescale Headers
  const { majorHeaders, minorHeaders, weekendDays } = useMemo(() => {
    const majors: { label: string; left: number; width: number }[] = [];
    const minors: { label: string; date: Date; left: number; width: number; isWeekend: boolean }[] = [];
    const weekends: { left: number; width: number }[] = [];

    const cur = new Date(minDate);
    let curMonth = -1;
    let curYear = -1;
    let monthStartIdx = 0;
    let monthLabel = "";

    for (let i = 0; i < totalCalendarDays; i++) {
      const dayOfWeek = cur.getDay(); // 0 is Sun, 6 is Sat
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const leftPx = i * dayWidth;

      if (isWeekend) {
        weekends.push({ left: leftPx, width: dayWidth });
      }

      let minorLabel = "";
      if (zoomLevel === "day" || dayWidth >= 28) {
        const dayLetter = ["S", "M", "T", "W", "T", "F", "S"][dayOfWeek];
        minorLabel = `${dayLetter} ${cur.getDate()}`;
      } else if (zoomLevel === "week" || dayWidth >= 10) {
        if (dayOfWeek === 1 || i === 0) {
          minorLabel = `${cur.getDate()} ${cur.toLocaleString("default", { month: "short" })}`;
        }
      } else {
        if (cur.getDate() === 1 || i === 0) {
          minorLabel = cur.toLocaleString("default", { month: "short" });
        }
      }

      minors.push({
        label: minorLabel,
        date: new Date(cur),
        left: leftPx,
        width: dayWidth,
        isWeekend
      });

      if (cur.getMonth() !== curMonth || cur.getFullYear() !== curYear) {
        if (curMonth !== -1) {
          majors.push({
            label: monthLabel,
            left: monthStartIdx * dayWidth,
            width: (i - monthStartIdx) * dayWidth
          });
        }
        curMonth = cur.getMonth();
        curYear = cur.getFullYear();
        monthStartIdx = i;
        monthLabel = `${cur.toLocaleString("default", { month: "long" })} ${curYear}`;
      }

      cur.setDate(cur.getDate() + 1);
    }

    if (curMonth !== -1) {
      majors.push({
        label: monthLabel,
        left: monthStartIdx * dayWidth,
        width: (totalCalendarDays - monthStartIdx) * dayWidth
      });
    }

    return { majorHeaders: majors, minorHeaders: minors, weekendDays: weekends };
  }, [minDate, totalCalendarDays, dayWidth, zoomLevel]);

  // Fast index map for visible activities
  const visibleActivityIndexMap = useMemo(() => {
    const map = new Map<string, { activity: EngineActivity; index: number }>();
    visibleActivities.forEach((act, idx) => {
      map.set(act.id, { activity: act, index: idx });
      if (act.wbsCode) map.set(act.wbsCode, { activity: act, index: idx });
    });
    return map;
  }, [visibleActivities]);

  // Selected activity object & its network context
  const selectedActivity = useMemo(() => {
    if (!selectedActivityId) return null;
    return activities.find(a => a.id === selectedActivityId) || null;
  }, [activities, selectedActivityId]);

  // Highlight sets for selected activity's logic network
  const { predecessorIds, successorIds } = useMemo(() => {
    if (!selectedActivityId) {
      return { predecessorIds: new Set<string>(), successorIds: new Set<string>() };
    }

    const pIds = new Set<string>();
    const sIds = new Set<string>();

    if (selectedActivity?.predecessors) {
      selectedActivity.predecessors.forEach(p => pIds.add(p.predecessorId));
    }

    activities.forEach(other => {
      if (other.predecessors?.some(p => p.predecessorId === selectedActivityId)) {
        sIds.add(other.id);
      }
    });

    return { predecessorIds: pIds, successorIds: sIds };
  }, [activities, selectedActivityId, selectedActivity]);

  // COMPUTE ORTHOGONAL PLANNING SOFTWARE LOGIC LINKS ON GANTT
  const dependencyLinks = useMemo(() => {
    if (!showLinks) return [];

    const links: {
      id: string;
      predId: string;
      succId: string;
      predName: string;
      succName: string;
      predWbs: string;
      succWbs: string;
      type: RelationshipType;
      lag: number;
      isCritical: boolean;
      isSelected: boolean;
      pathD: string;
      arrowType: "right" | "left";
      arrowX: number;
      arrowY: number;
      labelX: number;
      labelY: number;
    }[] = [];

    visibleActivities.forEach((succAct, succIdx) => {
      (succAct.predecessors || []).forEach((predLink, linkIdx) => {
        // Predecessor must be currently visible in the Gantt row layout
        const lookup = visibleActivityIndexMap.get(predLink.predecessorId);
        if (!lookup) return;

        const predAct = lookup.activity;
        const predIdx = lookup.index;

        const relType: RelationshipType = predLink.type || "FS";
        const lag = predLink.lag || 0;
        const isCritRel = predAct.isCritical && succAct.isCritical;
        const isSelected = selectedActivityId === predAct.id || selectedActivityId === succAct.id;

        // Activity geometry on Gantt
        const isPredMilestone = predAct.activityType === "StartMilestone" || predAct.activityType === "FinishMilestone" || predAct.originalDuration === 0;
        const isSuccMilestone = succAct.activityType === "StartMilestone" || succAct.activityType === "FinishMilestone" || succAct.originalDuration === 0;

        const predStartX = getXPosition(predAct.earlyStart);
        const predEndX = isPredMilestone ? predStartX : getXPosition(predAct.earlyFinish) + dayWidth;

        const succStartX = getXPosition(succAct.earlyStart);
        const succEndX = isSuccMilestone ? succStartX : getXPosition(succAct.earlyFinish) + dayWidth;

        const predY = predIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
        const succY = succIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

        let points: { x: number; y: number }[] = [];
        let arrowType: "right" | "left" = "right";

        const MARGIN = 10;
        const ROW_GUTTER_OFFSET = ROW_HEIGHT / 2 - 3;

        // 1. FS: Finish-to-Start (Exit right edge -> Enter left edge)
        if (relType === "FS") {
          arrowType = "right";
          const startX = predEndX;
          const startY = predY;
          const endX = succStartX;
          const endY = succY;

          if (endX >= startX + 16) {
            const midX = Math.max(startX + 8, Math.min(startX + 20, (startX + endX) / 2));
            points = [
              { x: startX, y: startY },
              { x: midX, y: startY },
              { x: midX, y: endY },
              { x: endX, y: endY }
            ];
          } else {
            const channelY = endY > startY ? startY + ROW_GUTTER_OFFSET : startY - ROW_GUTTER_OFFSET;
            points = [
              { x: startX, y: startY },
              { x: startX + MARGIN, y: startY },
              { x: startX + MARGIN, y: channelY },
              { x: endX - MARGIN, y: channelY },
              { x: endX - MARGIN, y: endY },
              { x: endX, y: endY }
            ];
          }
        } 
        // 2. SS: Start-to-Start (Exit left edge -> Enter left edge)
        else if (relType === "SS") {
          arrowType = "right";
          const startX = predStartX;
          const startY = predY;
          const endX = succStartX;
          const endY = succY;

          const leftX = Math.min(startX, endX) - 14;
          points = [
            { x: startX, y: startY },
            { x: leftX, y: startY },
            { x: leftX, y: endY },
            { x: endX, y: endY }
          ];
        } 
        // 3. FF: Finish-to-Finish (Exit right edge -> Enter right edge)
        else if (relType === "FF") {
          arrowType = "left";
          const startX = predEndX;
          const startY = predY;
          const endX = succEndX;
          const endY = succY;

          const rightX = Math.max(startX, endX) + 16;
          points = [
            { x: startX, y: startY },
            { x: rightX, y: startY },
            { x: rightX, y: endY },
            { x: endX, y: endY }
          ];
        } 
        // 4. SF: Start-to-Finish (Exit left edge -> Enter right edge)
        else if (relType === "SF") {
          arrowType = "left";
          const startX = predStartX;
          const startY = predY;
          const endX = succEndX;
          const endY = succY;

          if (endX < startX - 16) {
            const midX = (startX + endX) / 2;
            points = [
              { x: startX, y: startY },
              { x: midX, y: startY },
              { x: midX, y: endY },
              { x: endX, y: endY }
            ];
          } else {
            const channelY = endY > startY ? startY + ROW_GUTTER_OFFSET : startY - ROW_GUTTER_OFFSET;
            points = [
              { x: startX, y: startY },
              { x: startX - MARGIN, y: startY },
              { x: startX - MARGIN, y: channelY },
              { x: endX + MARGIN + 4, y: channelY },
              { x: endX + MARGIN + 4, y: endY },
              { x: endX, y: endY }
            ];
          }
        }

        const pathD = generateOrthogonalPath(points, 3.5);

        let labelX = points[0].x;
        let labelY = points[0].y;
        if (points.length >= 4) {
          labelX = points[2].x;
          labelY = (points[1].y + points[2].y) / 2;
        } else if (points.length >= 2) {
          labelX = (points[0].x + points[1].x) / 2;
          labelY = (points[0].y + points[1].y) / 2;
        }

        links.push({
          id: `link-${predAct.id}-${succAct.id}-${relType}-${linkIdx}`,
          predId: predAct.id,
          succId: succAct.id,
          predName: predAct.name,
          succName: succAct.name,
          predWbs: predAct.wbsCode,
          succWbs: succAct.wbsCode,
          type: relType,
          lag,
          isCritical: isCritRel,
          isSelected,
          pathD,
          arrowType,
          arrowX: points[points.length - 1].x,
          arrowY: points[points.length - 1].y,
          labelX,
          labelY
        });
      });
    });

    return links;
  }, [visibleActivities, visibleActivityIndexMap, getXPosition, dayWidth, selectedActivityId, showLinks]);

  // Scroll Actions
  const scrollToActivity = (actId: string) => {
    const lookup = visibleActivityIndexMap.get(actId);
    if (!lookup) return;
    const act = lookup.activity;
    const idx = lookup.index;

    const actX = getXPosition(act.earlyStart);
    const actY = idx * ROW_HEIGHT;

    if (rightGanttScrollRef.current) {
      rightGanttScrollRef.current.scrollTo({
        left: Math.max(0, actX - 180),
        top: Math.max(0, actY - 120),
        behavior: "smooth"
      });
    }
  };

  const scrollToDataDate = () => {
    if (rightGanttScrollRef.current) {
      rightGanttScrollRef.current.scrollTo({
        left: Math.max(0, dataDateX - 220),
        behavior: "smooth"
      });
    }
  };

  const scrollToDate = (dateStr?: string | null) => {
    if (!dateStr || !rightGanttScrollRef.current) return;
    const x = getXPosition(dateStr);
    rightGanttScrollRef.current.scrollTo({
      left: Math.max(0, x - 180),
      behavior: "smooth"
    });
  };

  const handleFitProgramme = () => {
    const containerW = rightGanttScrollRef.current?.clientWidth || 800;
    if (totalCalendarDays > 0 && containerW > 100) {
      const targetDayWidth = Math.max(3, Math.floor((containerW - 60) / totalCalendarDays));
      setCustomDayWidth(targetDayWidth);
      setZoomLevel("month");
      if (rightGanttScrollRef.current) {
        const startX = programmeStart ? getXPosition(programmeStart) : 0;
        rightGanttScrollRef.current.scrollTo({ left: Math.max(0, startX - 40), behavior: "smooth" });
      }
    }
  };

  const handleZoomIn = () => {
    setCustomDayWidth(prev => {
      const cur = prev !== null ? prev : dayWidth;
      return Math.min(60, Math.round(cur * 1.25));
    });
  };

  const handleZoomOut = () => {
    setCustomDayWidth(prev => {
      const cur = prev !== null ? prev : dayWidth;
      return Math.max(3, Math.round(cur * 0.8));
    });
  };

  return (
    <div 
      ref={containerRef}
      id="programme-gantt-workspace" 
      className="w-full flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm animate-fade-in font-sans overflow-hidden"
    >
      {/* 1. TOP PLANNING CONTROLS RIBBON */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 flex flex-wrap items-center justify-between gap-3 select-none">
        {/* Left Section: WBS Hierarchy Controls */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-200/60 dark:bg-slate-800 border border-slate-300/60 dark:border-slate-700 font-extrabold text-slate-700 dark:text-slate-300">
            <FolderTree className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span className="text-[11px] uppercase tracking-wider">Hierarchy:</span>
          </div>

          <div className="inline-flex items-center bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-0.5 text-xs shadow-2xs font-bold">
            <button
              onClick={() => handleSetHierarchyLevel(1)}
              className="px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              title="Collapse to Level 1 summary items only"
            >
              Level 1
            </button>
            <button
              onClick={() => handleSetHierarchyLevel(2)}
              className="px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              title="Expand down to Level 2"
            >
              Level 2
            </button>
            <button
              onClick={() => handleSetHierarchyLevel(3)}
              className="px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              title="Expand down to Level 3"
            >
              Level 3
            </button>
            <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
            <button
              onClick={handleExpandAll}
              className="px-2.5 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/60 text-blue-600 dark:text-blue-400 transition-colors cursor-pointer"
              title="Expand all activities"
            >
              Expand All
            </button>
            <button
              onClick={handleCollapseAll}
              className="px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
              title="Collapse all summary groups"
            >
              Collapse All
            </button>
          </div>

          {/* Logic Links & Critical Path Switches */}
          <div className="flex items-center gap-1.5 ml-2">
            <label 
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                showLinks 
                  ? "bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 shadow-2xs" 
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500"
              }`}
            >
              <input 
                type="checkbox" 
                checked={showLinks} 
                onChange={e => setShowLinks(e.target.checked)} 
                className="sr-only" 
              />
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Dependencies ({dependencyLinks.length})</span>
            </label>

            <label 
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                showCriticalGlow 
                  ? "bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 shadow-2xs" 
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500"
              }`}
            >
              <input 
                type="checkbox" 
                checked={showCriticalGlow} 
                onChange={e => setShowCriticalGlow(e.target.checked)} 
                className="sr-only" 
              />
              <Flame className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>Critical Path</span>
            </label>

            <label 
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                showFloatWhiskers 
                  ? "bg-teal-50 dark:bg-teal-950/60 border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 shadow-2xs" 
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500"
              }`}
            >
              <input 
                type="checkbox" 
                checked={showFloatWhiskers} 
                onChange={e => setShowFloatWhiskers(e.target.checked)} 
                className="sr-only" 
              />
              <span className="w-2.5 border-b-2 border-dashed border-teal-600" />
              <span>Float</span>
            </label>
          </div>
        </div>

        {/* Right Section: Timeline Navigation & Zoom */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          {/* Configure Columns Popover Button */}
          <div className="relative">
            <button
              onClick={() => setIsColumnPickerOpen(!isColumnPickerOpen)}
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Configure visible columns in Activity Table"
            >
              <Columns className="w-3.5 h-3.5 text-slate-500" />
              <span>Columns</span>
            </button>

            {isColumnPickerOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl z-50 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-700">
                  <span className="text-xs font-black text-slate-800 dark:text-white">Visible Columns</span>
                  <button 
                    onClick={() => setIsColumnPickerOpen(false)}
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {[
                    { key: "wbs", label: "WBS Code (Default)" },
                    { key: "name", label: "Activity Name (Default)" },
                    { key: "duration", label: "Duration OD (Default)" },
                    { key: "start", label: "Start Date (Default)" },
                    { key: "finish", label: "Finish Date (Default)" },
                    { key: "progress", label: "% Complete (Default)" },
                    { key: "totalFloat", label: "Total Float" },
                    { key: "freeFloat", label: "Free Float" },
                    { key: "status", label: "Status" },
                    { key: "critical", label: "Criticality" },
                    { key: "predecessors", label: "Predecessors" },
                    { key: "successors", label: "Successors" },
                    { key: "calendar", label: "Calendar" }
                  ].map(col => (
                    <label key={col.key} className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer text-[11px] font-medium text-slate-700 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={(visibleColumns as any)[col.key]}
                        onChange={e => setVisibleColumns(prev => ({ ...prev, [col.key]: e.target.checked }))}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <span>{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Timeline Jump & Fit Buttons */}
          <button
            onClick={scrollToDataDate}
            className="px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
            title={`Scroll timeline to Status Date (${dataDate})`}
          >
            <Target className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Today</span>
          </button>

          <button
            onClick={handleFitProgramme}
            className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
            title="Fit entire project dates into visible timeline width"
          >
            <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Fit Programme</span>
          </button>

          {/* Synchronized Programme Start & Finish Indicator */}
          {programmeStart && programmeFinish && (
            <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 bg-slate-100/90 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-mono shadow-2xs">
              <span className="text-slate-400 font-sans font-bold uppercase tracking-wider text-[9px]">Scale:</span>
              <button 
                onClick={() => scrollToDate(programmeStart)}
                className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                title={`Jump to Programme Start (${programmeStart})`}
              >
                {programmeStart}
              </button>
              <span className="text-slate-400">→</span>
              <button 
                onClick={() => scrollToDate(programmeFinish)}
                className="font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                title={`Jump to Programme Finish (${programmeFinish})`}
              >
                {programmeFinish}
              </button>
            </div>
          )}

          {/* Day / Week / Month Timescale Selector */}
          <div className="inline-flex bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-300/70 dark:border-slate-700 text-xs font-bold">
            <button
              onClick={() => { setZoomLevel("day"); setCustomDayWidth(null); }}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                zoomLevel === "day" && customDayWidth === null
                  ? "bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-xs" 
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Day
            </button>
            <button
              onClick={() => { setZoomLevel("week"); setCustomDayWidth(null); }}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                zoomLevel === "week" && customDayWidth === null
                  ? "bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-xs" 
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Week
            </button>
            <button
              onClick={() => { setZoomLevel("month"); setCustomDayWidth(null); }}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                zoomLevel === "month" && customDayWidth === null
                  ? "bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-xs" 
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Month
            </button>
          </div>

          {/* Zoom +/- Buttons */}
          <div className="inline-flex bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-0.5 shadow-2xs">
            <button
              onClick={handleZoomIn}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. MAIN SPLIT-SCREEN WORKSPACE BODY */}
      <div className="flex w-full overflow-hidden min-h-[560px] max-h-[760px] relative select-none">
        {/* LEFT PANE: Professional WBS Activity Table (~38% default) */}
        <div 
          style={{ width: `${splitPercent}%` }}
          className="shrink-0 border-r border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col z-10 overflow-hidden"
        >
          {/* Table Header (Height 56px matching Gantt dual-tier timescale) */}
          <div 
            ref={leftTableHeaderRef}
            onScroll={handleHeaderScroll}
            className="h-14 border-b border-slate-300 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-800/90 flex items-center text-[10px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 shadow-2xs divide-x divide-slate-200 dark:divide-slate-700 overflow-x-auto scrollbar-none min-w-full w-max"
          >
            <div className="w-9 px-1 text-center shrink-0">#</div>
            {visibleColumns.wbs && <div className="w-20 px-2 shrink-0">WBS</div>}
            {visibleColumns.name && <div className="w-56 min-w-[180px] px-2.5 truncate shrink-0">Activity Name</div>}
            {visibleColumns.duration && <div className="w-14 px-1 text-center shrink-0">Dur</div>}
            {visibleColumns.start && <div className="w-22 px-1 text-center shrink-0">Start Date</div>}
            {visibleColumns.finish && <div className="w-22 px-1 text-center shrink-0">Finish Date</div>}
            {visibleColumns.progress && <div className="w-16 px-1 text-center shrink-0">% Done</div>}
            
            {/* Optional columns */}
            {visibleColumns.totalFloat && <div className="w-14 px-1 text-center shrink-0">TF</div>}
            {visibleColumns.freeFloat && <div className="w-14 px-1 text-center shrink-0">FF</div>}
            {visibleColumns.status && <div className="w-20 px-1 text-center shrink-0">Status</div>}
            {visibleColumns.critical && <div className="w-16 px-1 text-center shrink-0">Critical</div>}
            {visibleColumns.predecessors && <div className="w-24 px-1 text-center shrink-0">Preds</div>}
            {visibleColumns.successors && <div className="w-24 px-1 text-center shrink-0">Succs</div>}
            {visibleColumns.calendar && <div className="w-14 px-1 text-center shrink-0">Cal</div>}
          </div>

          {/* Table Rows (Synchronized Vertical Scroll) */}
          <div 
            ref={leftTableScrollRef}
            onScroll={handleLeftScroll}
            className="overflow-y-auto overflow-x-auto flex-1 divide-y divide-slate-200/80 dark:divide-slate-800/80 scrollbar-none"
          >
            {visibleActivities.map((act, index) => {
              const isSelected = selectedActivityId === act.id;
              const isPred = predecessorIds.has(act.id);
              const isSucc = successorIds.has(act.id);
              const isSummary = act.activityType === "Summary" || summaryNodeIds.has(act.id);
              const isMilestone = act.activityType === "StartMilestone" || act.activityType === "FinishMilestone" || act.originalDuration === 0;
              const isCollapsed = collapsedWbsNodes.has(act.id);
              const level = hierarchyMap.get(act.id)?.level || 1;

              return (
                <div
                  key={`tbl-row-${act.id}-${index}`}
                  id={`programme-act-row-${act.id}`}
                  onClick={() => {
                    onSelectActivity?.(act.id);
                    scrollToActivity(act.id);
                  }}
                  onDoubleClick={() => onViewActivity ? onViewActivity(act) : onEditActivity?.(act)}
                  style={{ height: `${ROW_HEIGHT}px` }}
                  className={`flex items-center text-xs transition-colors cursor-pointer divide-x divide-slate-200/50 dark:divide-slate-800/50 min-w-full w-max shrink-0 ${
                    isSelected 
                      ? "bg-blue-100/80 dark:bg-blue-950/70 font-semibold border-l-4 border-l-blue-600" 
                      : isPred
                        ? "bg-emerald-50/70 dark:bg-emerald-950/40 border-l-4 border-l-emerald-500"
                        : isSucc
                          ? "bg-purple-50/70 dark:bg-purple-950/40 border-l-4 border-l-purple-500"
                          : act.isCritical 
                            ? "bg-rose-50/40 dark:bg-rose-950/30 hover:bg-rose-50/80" 
                            : index % 2 === 0
                              ? "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                              : "bg-slate-50/40 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  {/* Row Sort Index */}
                  <div className="w-9 px-1 text-center font-mono text-[10px] text-slate-400 shrink-0">
                    {act.sortOrder || index + 1}
                  </div>

                  {/* WBS Code with Hierarchy Indentation & Chevron */}
                  {visibleColumns.wbs && (
                    <div 
                      style={{ paddingLeft: `${Math.min(48, (level - 1) * 12 + 6)}px` }}
                      className="w-20 pr-1.5 flex items-center gap-1 font-mono text-[10px] font-bold text-blue-700 dark:text-blue-400 truncate shrink-0"
                    >
                      {isSummary && (
                        <button
                          type="button"
                          onClick={(e) => toggleCollapseWbsNode(act.id, e)}
                          className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 cursor-pointer"
                        >
                          {isCollapsed ? (
                            <ChevronRight className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>
                      )}
                      <span className="truncate" title={act.wbsCode}>{act.wbsCode}</span>
                    </div>
                  )}

                  {/* Activity Name (up to 2 lines where needed, with visual type icon) */}
                  {visibleColumns.name && (
                    <div className="w-56 min-w-[180px] px-2.5 flex items-center gap-2 overflow-hidden shrink-0">
                      {isSummary ? (
                        <div className="w-2.5 h-2.5 bg-slate-800 dark:bg-slate-200 rounded-xs shrink-0" title="WBS Summary Task" />
                      ) : isMilestone ? (
                        <div className="w-2.5 h-2.5 rotate-45 bg-purple-600 dark:bg-purple-400 shrink-0" title="Milestone" />
                      ) : act.isCritical ? (
                        <div className="w-2 h-2 rounded-xs bg-rose-600 animate-pulse shrink-0" title="Critical Path Task" />
                      ) : (
                        <div className="w-2 h-2 rounded-xs bg-blue-500 shrink-0" title="Standard Task" />
                      )}

                      <div className="min-w-0 flex-1">
                        <span 
                          className={`line-clamp-2 break-words text-[11px] leading-tight ${
                            isSummary 
                              ? "font-extrabold text-slate-900 dark:text-white" 
                              : act.isCritical 
                                ? "font-bold text-rose-900 dark:text-rose-200" 
                                : "font-medium text-slate-800 dark:text-slate-100"
                          }`}
                          title={act.name}
                        >
                          {act.name}
                        </span>
                      </div>

                      {/* Logic Relationship Badges */}
                      {isPred && (
                        <span className="shrink-0 px-1 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-black text-[8px] uppercase">
                          Pred
                        </span>
                      )}
                      {isSucc && (
                        <span className="shrink-0 px-1 py-0.2 rounded bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-black text-[8px] uppercase">
                          Succ
                        </span>
                      )}
                    </div>
                  )}

                  {/* Duration (OD) */}
                  {visibleColumns.duration && (
                    <div className="w-14 px-1 text-center font-mono font-bold text-[10px] text-slate-700 dark:text-slate-300 shrink-0">
                      {act.originalDuration}d
                    </div>
                  )}

                  {/* Start Date */}
                  {visibleColumns.start && (
                    <div 
                      className="w-22 px-1 text-center font-mono text-[10px] font-medium text-slate-700 dark:text-slate-300 truncate shrink-0" 
                      title={act.earlyStart || act.plannedStart || "-"}
                    >
                      {act.earlyStart || act.plannedStart || "-"}
                    </div>
                  )}

                  {/* Finish Date */}
                  {visibleColumns.finish && (
                    <div 
                      className="w-22 px-1 text-center font-mono text-[10px] font-medium text-slate-700 dark:text-slate-300 truncate shrink-0" 
                      title={act.earlyFinish || act.plannedFinish || "-"}
                    >
                      {act.earlyFinish || act.plannedFinish || "-"}
                    </div>
                  )}

                  {/* % Complete */}
                  {visibleColumns.progress && (
                    <div className="w-16 px-1 flex flex-col items-center justify-center shrink-0">
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden flex">
                        <div 
                          className={`h-full ${
                            act.progress === 100 
                              ? "bg-emerald-500" 
                              : act.isCritical 
                                ? "bg-rose-500" 
                                : "bg-blue-500"
                          }`}
                          style={{ width: `${act.progress}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-mono font-bold text-slate-500 mt-0.5">{act.progress}%</span>
                    </div>
                  )}

                  {/* Optional Columns */}
                  {visibleColumns.totalFloat && (
                    <div className="w-14 px-1 text-center font-mono font-bold text-[10px] shrink-0">
                      <span className={act.totalFloat <= 0 ? "text-rose-600" : act.totalFloat <= 5 ? "text-amber-600" : "text-slate-600"}>
                        {act.totalFloat}d
                      </span>
                    </div>
                  )}
                  {visibleColumns.freeFloat && (
                    <div className="w-14 px-1 text-center font-mono text-[10px] text-slate-500 shrink-0">
                      {act.freeFloat !== undefined ? `${act.freeFloat}d` : "-"}
                    </div>
                  )}
                  {visibleColumns.status && (
                    <div className="w-20 px-1 text-center shrink-0">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 truncate block">
                        {act.status}
                      </span>
                    </div>
                  )}
                  {visibleColumns.critical && (
                    <div className="w-16 px-1 text-center shrink-0">
                      {act.isCritical ? (
                        <span className="px-1 py-0.5 rounded bg-rose-600 text-white text-[8px] font-black">CRIT</span>
                      ) : (
                        <span className="text-slate-400 text-[9px]">NO</span>
                      )}
                    </div>
                  )}
                  {visibleColumns.predecessors && (
                    <div className="w-24 px-1 text-[9px] font-mono text-slate-500 truncate shrink-0">
                      {(act.predecessors || []).map(p => `${p.predecessorId}(${p.type})`).join(", ") || "-"}
                    </div>
                  )}
                  {visibleColumns.successors && (
                    <div className="w-24 px-1 text-[9px] font-mono text-slate-500 truncate shrink-0">
                      {activities.filter(a => a.predecessors?.some(p => p.predecessorId === act.id)).map(a => a.wbsCode || a.id).join(", ") || "-"}
                    </div>
                  )}
                  {visibleColumns.calendar && (
                    <div className="w-14 px-1 text-center font-mono text-[9px] text-slate-500 shrink-0">
                      {act.calendarId?.replace("cal-", "")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* DRAGGABLE DIVIDER BETWEEN ACTIVITY TABLE & GANTT */}
        <div
          onMouseDown={handleDividerMouseDown}
          className={`w-2 hover:w-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-blue-500 dark:hover:bg-blue-500 transition-colors cursor-col-resize z-20 shrink-0 flex items-center justify-center relative ${
            isDraggingDivider ? "bg-blue-600 dark:bg-blue-600 w-2.5 ring-2 ring-blue-400" : ""
          }`}
          title="Drag horizontally to resize Activity Table and Gantt split panes"
        >
          <div className="w-0.5 h-8 bg-slate-400 dark:bg-slate-600 rounded-full" />
        </div>

        {/* RIGHT PANE: Interactive Gantt Timeline (~62% default) */}
        <div 
          ref={rightGanttScrollRef}
          onScroll={handleRightScroll}
          className="flex-1 overflow-x-auto overflow-y-auto relative bg-slate-50/20 dark:bg-slate-950/40"
        >
          <div style={{ width: `${timelineWidth}px` }} className="relative">
            {/* 1. Dual-Tier Timescale Header (Height 56px) */}
            <div className="h-14 border-b border-slate-300 dark:border-slate-800 bg-slate-100/95 dark:bg-slate-800/95 sticky top-0 z-30 flex flex-col select-none shadow-xs">
              {/* Major Timescale Tier (Months / Years) */}
              <div className="h-7 border-b border-slate-200 dark:border-slate-700 relative flex items-center bg-slate-200/60 dark:bg-slate-800">
                {majorHeaders.map((m, idx) => (
                  <div
                    key={`major-${idx}`}
                    style={{ left: `${m.left}px`, width: `${m.width}px` }}
                    className="absolute h-full border-r border-slate-300 dark:border-slate-600 px-2 flex items-center text-[10px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 truncate"
                  >
                    {m.label}
                  </div>
                ))}
              </div>

              {/* Minor Timescale Tier (Days / Weeks) */}
              <div className="h-7 relative flex items-center">
                {minorHeaders.map((m, idx) => (
                  <div
                    key={`minor-${idx}`}
                    style={{ left: `${m.left}px`, width: `${m.width}px` }}
                    className={`absolute h-full border-r border-slate-200/80 dark:border-slate-700/60 flex items-center justify-center text-[9px] font-mono text-slate-600 dark:text-slate-400 ${
                      m.isWeekend ? "bg-slate-200/40 dark:bg-slate-800/40 text-slate-400" : ""
                    }`}
                  >
                    {m.label}
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Weekend Shading Grid */}
            {showWeekendStripes && weekendDays.map((w, idx) => (
              <div
                key={`wknd-${idx}`}
                style={{
                  left: `${w.left}px`,
                  width: `${w.width}px`,
                  top: "56px",
                  height: `${visibleActivities.length * ROW_HEIGHT}px`
                }}
                className="absolute bg-slate-200/20 dark:bg-slate-800/20 pointer-events-none z-0 border-r border-slate-200/30 dark:border-slate-800/30"
              />
            ))}

            {/* 3. Today / Data Date Status Line */}
            <div 
              style={{ left: `${dataDateX}px`, height: `${visibleActivities.length * ROW_HEIGHT + 56}px` }} 
              className="absolute top-0 w-0.5 bg-blue-600 dark:bg-blue-500 z-30 pointer-events-none"
            >
              <div className="sticky top-14 bg-blue-600 dark:bg-blue-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-b shadow-md uppercase tracking-wider -translate-x-1/2 whitespace-nowrap">
                Today: {dataDate}
              </div>
            </div>

            {/* Programme Start Marker */}
            {programmeStartX !== null && (
              <div 
                style={{ left: `${programmeStartX}px`, height: `${visibleActivities.length * ROW_HEIGHT + 56}px` }} 
                className="absolute top-0 w-0.5 border-l-2 border-dashed border-emerald-500 z-20 pointer-events-none"
              >
                <div className="sticky top-14 bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-b shadow-md uppercase tracking-wider -translate-x-1/2 whitespace-nowrap">
                  Prog Start: {programmeStart}
                </div>
              </div>
            )}

            {/* Programme Finish Marker */}
            {programmeFinishX !== null && (
              <div 
                style={{ left: `${programmeFinishX}px`, height: `${visibleActivities.length * ROW_HEIGHT + 56}px` }} 
                className="absolute top-0 w-0.5 border-l-2 border-dashed border-purple-600 dark:border-purple-400 z-20 pointer-events-none"
              >
                <div className="sticky top-14 bg-purple-600 dark:bg-purple-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-b shadow-md uppercase tracking-wider -translate-x-1/2 whitespace-nowrap">
                  Prog Finish: {programmeFinish}
                </div>
              </div>
            )}

            {/* 4. Orthogonal SVG Dependency Connector Lines Overlay */}
            {showLinks && (
              <svg 
                className="absolute inset-0 w-full pointer-events-none z-20"
                style={{ height: `${visibleActivities.length * ROW_HEIGHT + 56}px`, top: "56px" }}
              >
                <defs>
                  {/* Standard Forward Arrow (Right ►) */}
                  <marker 
                    id="gantt-arrow-normal" 
                    viewBox="0 0 10 10" 
                    refX="8" 
                    refY="5" 
                    markerWidth="6" 
                    markerHeight="6" 
                    orient="auto"
                  >
                    <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#475569" />
                  </marker>

                  {/* Critical Path Arrow (Right ►) */}
                  <marker 
                    id="gantt-arrow-critical" 
                    viewBox="0 0 10 10" 
                    refX="8" 
                    refY="5" 
                    markerWidth="6.5" 
                    markerHeight="6.5" 
                    orient="auto"
                  >
                    <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#DC2626" />
                  </marker>

                  {/* Selected / Highlighted Arrow (Right ►) */}
                  <marker 
                    id="gantt-arrow-highlight" 
                    viewBox="0 0 10 10" 
                    refX="8" 
                    refY="5" 
                    markerWidth="7" 
                    markerHeight="7" 
                    orient="auto"
                  >
                    <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#2563EB" />
                  </marker>

                  {/* Leftward Arrow for FF / SF (Left ◄) */}
                  <marker 
                    id="gantt-arrow-left-normal" 
                    viewBox="0 0 10 10" 
                    refX="2" 
                    refY="5" 
                    markerWidth="6" 
                    markerHeight="6" 
                    orient="auto"
                  >
                    <path d="M 8 1.5 L 0 5 L 8 8.5 z" fill="#475569" />
                  </marker>

                  <marker 
                    id="gantt-arrow-left-critical" 
                    viewBox="0 0 10 10" 
                    refX="2" 
                    refY="5" 
                    markerWidth="6.5" 
                    markerHeight="6.5" 
                    orient="auto"
                  >
                    <path d="M 8 1.5 L 0 5 L 8 8.5 z" fill="#DC2626" />
                  </marker>

                  <marker 
                    id="gantt-arrow-left-highlight" 
                    viewBox="0 0 10 10" 
                    refX="2" 
                    refY="5" 
                    markerWidth="7" 
                    markerHeight="7" 
                    orient="auto"
                  >
                    <path d="M 8 1.5 L 0 5 L 8 8.5 z" fill="#2563EB" />
                  </marker>
                </defs>

                {/* Render Orthogonal Lines */}
                {dependencyLinks.map((link, linkIdx) => {
                  const isHovered = hoveredLinkId === link.id;
                  const isHighlighted = link.isSelected || isHovered;
                  const hasSelection = !!selectedActivityId;

                  let strokeColor = "#64748B"; // slate-500
                  let strokeWidth = 1.3;
                  let markerEnd = link.arrowType === "left" ? "url(#gantt-arrow-left-normal)" : "url(#gantt-arrow-normal)";
                  let opacity = hasSelection && !isHighlighted ? 0.2 : 0.85;

                  if (link.isCritical) {
                    strokeColor = "#DC2626"; // red-600
                    strokeWidth = isHighlighted ? 2.4 : 1.6;
                    markerEnd = link.arrowType === "left" ? "url(#gantt-arrow-left-critical)" : "url(#gantt-arrow-critical)";
                    opacity = hasSelection && !isHighlighted ? 0.3 : 0.95;
                  }

                  if (isHighlighted) {
                    strokeColor = "#2563EB"; // blue-600
                    strokeWidth = 2.6;
                    markerEnd = link.arrowType === "left" ? "url(#gantt-arrow-left-highlight)" : "url(#gantt-arrow-highlight)";
                    opacity = 1;
                  }

                  return (
                    <g 
                      key={`dep-link-${link.id}-${linkIdx}`}
                      className="transition-all duration-150 cursor-pointer pointer-events-auto"
                      onMouseEnter={() => setHoveredLinkId(link.id)}
                      onMouseLeave={() => setHoveredLinkId(null)}
                      onClick={() => onSelectActivity?.(link.succId)}
                    >
                      {/* Invisible wider hit-target stroke for easy click */}
                      <path
                        d={link.pathD}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={10}
                      />

                      {/* Visible Crisp Orthogonal Dependency Link */}
                      <path
                        d={link.pathD}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        strokeDasharray={link.type === "FS" ? "none" : link.type === "SS" ? "4,2" : link.type === "FF" ? "6,2" : "2,2"}
                        markerEnd={markerEnd}
                        opacity={opacity}
                      />

                      {/* Lead/Lag Badge */}
                      {showLagLabels && (link.lag !== 0 || isHighlighted) && (
                        <g transform={`translate(${link.labelX}, ${link.labelY})`}>
                          <rect
                            x={-14}
                            y={-7}
                            width={28}
                            height={14}
                            rx={3}
                            fill={isHighlighted ? "#2563EB" : link.isCritical ? "#DC2626" : "#475569"}
                            className="shadow-xs"
                          />
                          <text
                            x={0}
                            y={3}
                            textAnchor="middle"
                            fill="#FFFFFF"
                            fontSize="8"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            {link.type}{link.lag > 0 ? `+${link.lag}d` : link.lag < 0 ? `${link.lag}d` : ""}
                          </text>
                        </g>
                      )}

                      <title>
                        {`${link.predWbs} (${link.predName}) → ${link.succWbs} (${link.succName})\nLogic: ${link.type}${link.lag ? ` (Lag: ${link.lag}d)` : ""}\nStatus: ${link.isCritical ? "Critical Path Driving" : "Standard Sequence"}`}
                      </title>
                    </g>
                  );
                })}
              </svg>
            )}

            {/* 5. Activity Bars, Summary Bars, & Milestones */}
            <div className="relative divide-y divide-slate-200/60 dark:divide-slate-800/60 z-10">
              {visibleActivities.map((act, idx) => {
                const isSelected = selectedActivityId === act.id;
                const isPred = predecessorIds.has(act.id);
                const isSucc = successorIds.has(act.id);
                const isSummary = act.activityType === "Summary" || summaryNodeIds.has(act.id);
                const isMilestone = act.activityType === "StartMilestone" || act.activityType === "FinishMilestone" || act.originalDuration === 0;

                // Coordinates
                const esX = getXPosition(act.earlyStart);
                const efX = isMilestone ? esX : getXPosition(act.earlyFinish) + dayWidth;
                const barWidth = Math.max(isMilestone ? 14 : dayWidth, efX - esX);

                // Baseline 0
                const b0StartX = getXPosition(act.baseline0?.baselineStart);
                const b0EndX = getXPosition(act.baseline0?.baselineFinish) + dayWidth;
                const b0Width = Math.max(dayWidth, b0EndX - b0StartX);

                // Total Float extension
                const lfX = act.lateFinish ? getXPosition(act.lateFinish) + dayWidth : efX;
                const floatWidth = Math.max(0, lfX - efX);

                return (
                  <div
                    key={`gantt-bar-row-${act.id}-${idx}`}
                    id={`gantt-bar-row-${act.id}`}
                    onClick={() => {
                      onSelectActivity?.(act.id);
                      scrollToActivity(act.id);
                    }}
                    onDoubleClick={() => onViewActivity ? onViewActivity(act) : onEditActivity?.(act)}
                    style={{ height: `${ROW_HEIGHT}px` }}
                    className={`relative flex items-center transition-colors ${
                      isSelected 
                        ? "bg-blue-50/60 dark:bg-blue-950/40" 
                        : isPred
                          ? "bg-emerald-50/40 dark:bg-emerald-950/20"
                          : isSucc
                            ? "bg-purple-50/40 dark:bg-purple-950/20"
                            : idx % 2 === 0
                              ? "bg-transparent"
                              : "bg-slate-50/30 dark:bg-slate-900/20"
                    }`}
                  >
                    {/* Total Float Whisker */}
                    {showFloatWhiskers && !isMilestone && !isSummary && floatWidth > 2 && (
                      <div
                        style={{
                          left: `${efX}px`,
                          width: `${floatWidth}px`,
                          top: "20px"
                        }}
                        className="absolute h-0.5 border-b-2 border-dashed border-teal-500/80 dark:border-teal-400/80 z-0 pointer-events-none"
                        title={`Total Float: ${act.totalFloat}d (Late Finish: ${act.lateFinish})`}
                      >
                        <div className="absolute right-0 top-[-4px] w-1.5 h-2.5 border-r-2 border-teal-500" />
                      </div>
                    )}

                    {/* Baseline 0 Ghost Bar */}
                    {showBaseline0 && act.baseline0 && !isMilestone && !isSummary && (
                      <div
                        style={{
                          left: `${b0StartX}px`,
                          width: `${b0Width}px`,
                          bottom: "3px",
                          height: "3.5px"
                        }}
                        className="absolute rounded-xs bg-slate-500/80 dark:bg-slate-400/80 border border-slate-600/50 z-5"
                        title={`Baseline 0 (Contract): ${act.baseline0.baselineStart} → ${act.baseline0.baselineFinish}`}
                      />
                    )}

                    {/* Summary / WBS Bracket Bar */}
                    {isSummary ? (
                      <div
                        style={{
                          left: `${esX}px`,
                          width: `${barWidth}px`,
                          height: "10px",
                          top: "16px"
                        }}
                        className="absolute z-15 flex flex-col cursor-pointer pointer-events-auto"
                        title={`${act.wbsCode} - ${act.name} (WBS Summary)\nDuration: ${act.originalDuration}d\nDates: ${act.earlyStart} → ${act.earlyFinish}`}
                      >
                        <div className="h-2.5 bg-slate-800 dark:bg-slate-200 relative">
                          {/* Left downward triangle wing */}
                          <div 
                            className="absolute left-0 bottom-[-5px] w-0 h-0 border-solid"
                            style={{
                              borderLeft: "5px solid transparent",
                              borderRight: "5px solid transparent",
                              borderTop: "5px solid #1e293b"
                            }}
                          />
                          {/* Right downward triangle wing */}
                          <div 
                            className="absolute right-0 bottom-[-5px] w-0 h-0 border-solid"
                            style={{
                              borderLeft: "5px solid transparent",
                              borderRight: "5px solid transparent",
                              borderTop: "5px solid #1e293b"
                            }}
                          />
                        </div>
                      </div>
                    ) : isMilestone ? (
                      /* Milestone Diamond */
                      <div
                        style={{ left: `${esX - 8}px` }}
                        className={`absolute w-4 h-4 rotate-45 shadow-sm z-20 cursor-pointer transition-transform hover:scale-125 ${
                          act.isCritical 
                            ? "bg-rose-600 border-2 border-white dark:border-slate-900 ring-2 ring-rose-400/60" 
                            : isSelected
                              ? "bg-blue-600 border-2 border-white dark:border-slate-900 ring-2 ring-blue-400/60"
                              : "bg-purple-600 border-2 border-white dark:border-slate-900"
                        }`}
                        title={`${act.wbsCode} - ${act.name}\nMilestone Date: ${act.earlyStart}\nStatus: ${act.isCritical ? "Critical Milestone" : "Milestone"}`}
                      />
                    ) : (
                      /* Standard / Critical Task Bar */
                      <div
                        style={{
                          left: `${esX}px`,
                          width: `${barWidth}px`,
                          height: "20px"
                        }}
                        className={`absolute rounded-[3px] shadow-xs z-15 flex items-center overflow-hidden cursor-pointer transition-all ${
                          act.isCritical && showCriticalGlow
                            ? "bg-gradient-to-b from-rose-500 to-rose-600 border border-rose-700 text-white ring-2 ring-rose-400/60"
                            : act.status === "Complete"
                              ? "bg-gradient-to-b from-emerald-500 to-emerald-600 border border-emerald-700 text-white"
                              : isSelected
                                ? "bg-gradient-to-b from-blue-600 to-blue-700 border border-blue-800 text-white ring-2 ring-blue-400/60"
                                : isPred
                                  ? "bg-gradient-to-b from-emerald-600 to-emerald-700 border border-emerald-800 text-white ring-1 ring-emerald-400"
                                  : isSucc
                                    ? "bg-gradient-to-b from-purple-600 to-purple-700 border border-purple-800 text-white ring-1 ring-purple-400"
                                    : "bg-gradient-to-b from-blue-500 to-blue-600 border border-blue-700 text-white"
                        }`}
                        title={`${act.wbsCode} - ${act.name}\nDuration: ${act.originalDuration}d | Progress: ${act.progress}%\nEarly Start: ${act.earlyStart} | Early Finish: ${act.earlyFinish}\nTotal Float: ${act.totalFloat}d (${act.isCritical ? "CRITICAL" : "Non-Critical"})`}
                      >
                        {/* Progress Fill inside bar */}
                        {act.progress > 0 && (
                          <div
                            style={{ width: `${act.progress}%` }}
                            className={`absolute left-0 top-0 bottom-0 ${
                              act.isCritical 
                                ? "bg-rose-900/80" 
                                : act.status === "Complete" 
                                  ? "bg-emerald-900/80" 
                                  : "bg-blue-900/80"
                            }`}
                          />
                        )}

                        {/* Bar percentage label inside if wide enough */}
                        {barWidth > 64 && (
                          <span className="relative z-20 px-2 truncate text-[10px] font-bold text-white drop-shadow-xs">
                            {act.progress > 0 ? `${act.progress}%` : act.name}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Outside Bar Label (Right-side activity name) */}
                    <div
                      style={{
                        left: `${(isMilestone ? esX + 12 : efX + 8)}px`
                      }}
                      className="absolute z-10 flex items-center gap-1.5 whitespace-nowrap pointer-events-none"
                    >
                      <span className={`text-[11px] ${
                        isSummary 
                          ? "font-extrabold text-slate-900 dark:text-white" 
                          : act.isCritical 
                            ? "font-bold text-rose-700 dark:text-rose-300" 
                            : "font-medium text-slate-700 dark:text-slate-300"
                      }`}>
                        {act.name}
                      </span>
                      {act.progress > 0 && (
                        <span className="text-[10px] font-mono text-slate-400">
                          ({act.progress}%)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 3. ACTIVITY DETAILS PANEL & DIAGNOSTICS DRAWER */}
      {selectedActivity && isDetailsPanelOpen && (
        <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/95 p-4 flex flex-col select-none animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-mono text-xs font-black">
                {selectedActivity.wbsCode}
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white truncate max-w-xl">
                {selectedActivity.name}
              </h3>
              {selectedActivity.isCritical && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-600 text-white font-black text-[10px]">
                  <Flame className="w-3 h-3" />
                  <span>CRITICAL PATH</span>
                </span>
              )}
              <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold">
                {selectedActivity.status}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onEditActivity?.(selectedActivity)}
                className="px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Activity</span>
              </button>
              <button
                onClick={() => setIsDetailsPanelOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                title="Minimize Details Panel"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mt-3">
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Duration & Progress</span>
              <div className="text-xs font-black font-mono text-slate-800 dark:text-slate-200 mt-0.5">
                OD: {selectedActivity.originalDuration}d | RD: {selectedActivity.remainingDuration}d
              </div>
              <span className="text-[10px] text-blue-600 font-bold block mt-0.5">
                {selectedActivity.progress}% Complete
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Early Dates (CPM)</span>
              <div className="text-xs font-black font-mono text-blue-700 dark:text-blue-300 mt-0.5">
                {selectedActivity.earlyStart || "-"} → {selectedActivity.earlyFinish || "-"}
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">Forward Pass</span>
            </div>

            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Late Dates (CPM)</span>
              <div className="text-xs font-black font-mono text-purple-700 dark:text-purple-300 mt-0.5">
                {selectedActivity.lateStart || "-"} → {selectedActivity.lateFinish || "-"}
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">Backward Pass</span>
            </div>

            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Float Margins</span>
              <div className="text-xs font-black font-mono text-slate-800 dark:text-slate-200 mt-0.5">
                Total Float: <span className={selectedActivity.totalFloat <= 0 ? "text-rose-600 font-black" : "text-emerald-600 font-black"}>{selectedActivity.totalFloat}d</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                Free Float: {selectedActivity.freeFloat !== undefined ? `${selectedActivity.freeFloat}d` : "-"}
              </span>
            </div>

            {/* Predecessors Jump List */}
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Predecessors ({selectedActivity.predecessors?.length || 0})
              </span>
              <div className="mt-1 flex flex-wrap gap-1 max-h-12 overflow-y-auto">
                {selectedActivity.predecessors?.length ? (
                  selectedActivity.predecessors.map((p, pIdx) => {
                    const predAct = activities.find(a => a.id === p.predecessorId);
                    return (
                      <button
                        key={pIdx}
                        onClick={() => {
                          onSelectActivity?.(p.predecessorId);
                          scrollToActivity(p.predecessorId);
                        }}
                        className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-mono text-[9px] font-bold hover:underline cursor-pointer"
                        title={predAct?.name}
                      >
                        {predAct?.wbsCode || p.predecessorId} ({p.type}{p.lag ? `+${p.lag}d` : ""})
                      </button>
                    );
                  })
                ) : (
                  <span className="text-[10px] text-slate-400">None (Start Node)</span>
                )}
              </div>
            </div>

            {/* Successors Jump List */}
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Successors ({successorIds.size})
              </span>
              <div className="mt-1 flex flex-wrap gap-1 max-h-12 overflow-y-auto">
                {successorIds.size > 0 ? (
                  Array.from<string>(successorIds).map((sId: string, sIdx: number) => {
                    const succAct = activities.find(a => a.id === sId);
                    return (
                      <button
                        key={sIdx}
                        onClick={() => {
                          onSelectActivity?.(sId);
                          scrollToActivity(sId);
                        }}
                        className="px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300 font-mono text-[9px] font-bold hover:underline cursor-pointer"
                        title={succAct?.name}
                      >
                        {succAct?.wbsCode || sId}
                      </button>
                    );
                  })
                ) : (
                  <span className="text-[10px] text-slate-400">None (Terminal Node)</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. PLANNING SOFTWARE LEGEND FOOTER */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600 dark:text-slate-400 select-none">
        <div className="flex items-center flex-wrap gap-4 font-medium text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-2 rounded-[2px] bg-blue-600 border border-blue-700" />
            <span>Task Bar</span>
          </span>

          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-2 rounded-[2px] bg-rose-600 border border-rose-700 ring-1 ring-rose-400/50" />
            <span className="font-bold text-rose-600 dark:text-rose-400">Critical Path</span>
          </span>

          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-1.5 bg-slate-800 dark:bg-slate-200 rounded-xs" />
            <span>Summary Bar</span>
          </span>

          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rotate-45 bg-purple-600" />
            <span>Milestone (0d)</span>
          </span>

          <span className="flex items-center gap-1.5">
            <span className="w-4 border-b-2 border-dashed border-teal-500" />
            <span>Float Lines</span>
          </span>

          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-slate-500 relative flex items-center justify-end">
              <span className="w-1.5 h-1.5 border-t border-r border-slate-700 rotate-45" />
            </span>
            <span>FS/SS/FF/SF Dependencies</span>
          </span>
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
          <span>{visibleActivities.length} of {activities.length} activities displayed</span>
          <span>•</span>
          <span>{formatDate(minDate)} → {formatDate(maxDate)}</span>
        </div>
      </div>
    </div>
  );
};
