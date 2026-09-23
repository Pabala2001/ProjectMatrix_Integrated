import { routeViewPermissions } from "../../integration/routePolicy";
import React, { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Lock,
  Building,
  Briefcase,
  Layers,
  LucideIcon
} from "lucide-react";
import { usePermissions } from "../../hooks/usePermissions";
import { useLanguage } from "../../contexts/LanguageContext";
import { navigation, NavigationDomainItem, NavigationChildItem } from "../../config/navigation";
import { canAccessDirectory } from "../../config/accessControl";

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  isMobileOpen?: boolean;
  setIsMobileOpen?: (open: boolean) => void;
  activeCompany?: any;
  activeProject?: any;
  allProjects?: any[];
  onProjectChange?: (proj: any) => void;
  companyPersonnel?: any[];
}

export default function Sidebar({ 
  isCollapsed, 
  setIsCollapsed,
  isMobileOpen,
  setIsMobileOpen,
  activeCompany,
  activeProject,
  allProjects = [],
  onProjectChange,
  companyPersonnel = []
}: SidebarProps) {
  const { can, userRole, isCompanyAdmin } = usePermissions();
  const location = useLocation();
  const { t } = useLanguage();
  
  // Track open state for expandable domain items
  const [expandedDomains, setExpandedDomains] = useState<Record<string, boolean>>({
    Executive: true,
    Projects: true,
    Commercial: true,
    Resources: true,
    Governance: true,
    Intelligence: true
  });

  // Helper to determine active state for any path or alias
  const isPathActive = (targetHref: string): boolean => {
    const current = location.pathname;
    const search = location.search;
    const fullCurrent = current + search;

    if (targetHref === fullCurrent || targetHref === current) return true;

    if (targetHref === "/command") {
      return current === "/command" || current === "/command-centre";
    }
    if (targetHref === "/actions") {
      return current === "/actions";
    }
    if (targetHref === "/portfolio") {
      return current === "/portfolio" || current === "/project-map";
    }
    if (targetHref === "/projects") {
      return current === "/projects" || current === "/dashboard";
    }
    if (targetHref === "/controls/programme") {
      return current === "/controls/programme" || current === "/programme";
    }
    if (targetHref === "/commercial/boq") {
      return current === "/commercial/boq" || current === "/boq" || current === "/bill-of-quantities";
    }
    if (targetHref === "/commercial/costs") {
      return current === "/commercial/costs" || current === "/accounts";
    }
    if (targetHref === "/commercial/procurement") {
      return current === "/commercial/procurement" || current === "/procurement";
    }
    if (targetHref === "/commercial/certificates") {
      return current === "/commercial/certificates";
    }
    if (targetHref === "/site") {
      return current === "/site" || current.startsWith("/field/");
    }
    if (targetHref === "/engineering") {
      return current === "/engineering" || current.startsWith("/engineering/");
    }
    if (targetHref === "/hseq") {
      return current === "/hseq" || current.startsWith("/hseq/") || current === "/quality-control";
    }
    if (targetHref === "/governance/contracts") {
      return current === "/governance/contracts";
    }
    if (targetHref === "/governance/risks") {
      return current === "/governance/risks" || current === "/intelligence/risks";
    }
    if (targetHref === "/documents") {
      return current === "/documents" || current.startsWith("/documents/");
    }
    if (targetHref === "/intelligence/advisor") {
      return current === "/intelligence/advisor" || current === "/project-advisor";
    }
    if (targetHref === "/intelligence/reports") {
      return current === "/intelligence/reports" || current === "/reports" || current.startsWith("/reports/");
    }
    if (targetHref === "/intelligence/knowledge") {
      return current === "/intelligence/knowledge";
    }
    if (targetHref === "/administration") {
      return current === "/administration" || current.startsWith("/administration/") || current === "/governance/administration";
    }
    if (targetHref.startsWith("/resources")) {
      return current === "/resources" && (targetHref.includes("tab=") ? fullCurrent.includes(targetHref.split("?")[1]) : true);
    }

    if (current.startsWith(targetHref) && targetHref !== "/") {
      return true;
    }
    return false;
  };

  // Check if any child inside a domain is currently active
  const isDomainActive = (domain: NavigationDomainItem): boolean => {
    if (domain.href && isPathActive(domain.href)) return true;
    if (domain.children && domain.children.length > 0) {
      return domain.children.some(child => isPathActive(child.href));
    }
    return false;
  };

  // Check if a child navigation item is accessible
  const isItemAccessible = (item: NavigationChildItem | NavigationDomainItem): boolean => {
    if (item.permission === "billing.view") return can("billing.view");
    if (isCompanyAdmin) return true;
    if (item.unrestricted) return true;
    if (item.accessKey && canAccessDirectory(userRole, item.accessKey)) {
      return true;
    }
    if (item.href) {
      const [path,query=""] = item.href.split("?");
      return routeViewPermissions(path, query).some(permission => can(permission));
    }
    if (item.permission) return can(item.permission);
    return true;
  };

  // Section 1 & Section 56 Rule: Parent heading MUST remain visible whenever user has access to at least 1 child item
  const isDomainVisible = (domain: NavigationDomainItem): boolean => {
    if (domain.title === "Billing") return can("billing.view");
    if (isCompanyAdmin) return true;
    if (!domain.children || domain.children.length === 0) {
      return isItemAccessible(domain);
    }
    return domain.children.some(child => isItemAccessible(child));
  };

  // Automatically expand active domain groups when location changes
  useEffect(() => {
    navigation.forEach((item) => {
      if (item.children && isDomainActive(item)) {
        setExpandedDomains(prev => ({ ...prev, [item.title]: true }));
      }
    });
  }, [location.pathname]);

  const toggleDomain = (domainTitle: string) => {
    if (isCollapsed) {
      setIsCollapsed(false);
    }
    setExpandedDomains(prev => ({
      ...prev,
      [domainTitle]: !prev[domainTitle]
    }));
  };

  // Render a Single Nav Link Item
  const renderSingleLink = (
    item: NavigationChildItem, 
    isChild: boolean = false
  ) => {
    const IconComponent = item.icon || Layers;
    const hasAccess = isItemAccessible(item);
    const active = isPathActive(item.href);
    const paddingClass = isChild ? "px-2.5 py-2" : "px-3.5 py-2.5";

    if (!hasAccess) {
      // Show subtle locked row
      return (
        <div
          key={item.href}
          aria-disabled="true"
          tabIndex={-1}
          title={`Requires permission '${item.permission || "Restricted"}'. Your role: ${userRole}`}
          className={`group flex items-start gap-2.5 rounded-xl transition-all duration-200 relative text-slate-500/50 opacity-40 cursor-not-allowed select-none ${paddingClass}`}
        >
          <span className="w-5 min-w-[20px] flex items-center justify-center shrink-0 self-start mt-0.5">
            <IconComponent className="w-4 h-4 text-slate-500/60" />
          </span>
          
          {(!isCollapsed || isMobileOpen) && (
            <div className="flex items-start justify-between w-full min-w-0 text-left gap-2">
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[13.5px] font-semibold text-slate-500 leading-snug break-words">
                  {item.title}
                </span>
                {item.description && (
                  <span className="text-[11.5px] text-slate-600 font-normal leading-[1.35] line-clamp-2 break-words mt-1">
                    {item.description}
                  </span>
                )}
              </div>
              <Lock className="w-3.5 h-3.5 text-slate-500/80 shrink-0 mt-0.5" />
            </div>
          )}

          {isCollapsed && !isMobileOpen && (
            <div className="absolute left-16 scale-0 rounded-lg bg-[#0B172A] px-2.5 py-1 text-[10px] font-bold text-white border border-[#1E293B] shadow-lg transition-all duration-100 group-hover:scale-100 whitespace-nowrap z-50">
              {item.title} (Restricted)
            </div>
          )}
        </div>
      );
    }

    return (
      <NavLink
        key={item.href}
        to={item.href}
        onClick={() => setIsMobileOpen?.(false)}
        className={`
          group flex items-start gap-2.5 rounded-xl transition-all duration-200 relative text-left outline-hidden focus:ring-2 focus:ring-[#F59E0B]/50 ${paddingClass}
          ${active 
            ? "bg-[#162238] text-white font-bold shadow-xs" 
            : "text-[#94A3B8] hover:bg-[#162238]/80 hover:text-[#F8FAFC]"
          }
        `}
      >
        {active && (
          <motion.div
            layoutId="activeIndicator"
            className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[#F59E0B]"
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
          />
        )}

        <span className="w-5 min-w-[20px] flex items-center justify-center shrink-0 self-start mt-0.5">
          <IconComponent className={`w-4 h-4 transition-colors duration-200 ${active ? "text-[#F59E0B]" : "text-[#94A3B8] group-hover:text-[#F8FAFC]"}`} />
        </span>
        
        {(!isCollapsed || isMobileOpen) && (
          <motion.div
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.12 }}
            className="flex flex-1 items-start justify-between min-w-0 gap-2"
          >
            <div className="flex flex-col min-w-0 flex-1">
              <span className={`text-[13.5px] font-semibold leading-snug break-words transition-colors ${active ? "text-white" : "text-slate-200 group-hover:text-white"}`}>
                {item.title}
              </span>
              {item.description && (
                <span className="text-[11.5px] text-[#94A3B8] font-normal leading-[1.35] line-clamp-2 break-words mt-1">
                  {item.description}
                </span>
              )}
            </div>

            {item.badge && (
              <span className={`mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 whitespace-nowrap border ${item.badgeColor || "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
                {item.badge}
              </span>
            )}
          </motion.div>
        )}

        {isCollapsed && !isMobileOpen && (
          <div className="absolute left-16 scale-0 rounded-lg bg-[#0B172A] px-2.5 py-1.5 text-xs font-bold text-white border border-[#1E293B] shadow-xl transition-all duration-100 group-hover:scale-100 whitespace-nowrap z-50">
            <div>{item.title}</div>
            {item.description && <div className="text-[10px] text-slate-400 font-normal mt-0.5 max-w-[200px] whitespace-normal">{item.description}</div>}
          </div>
        )}
      </NavLink>
    );
  };

  // Render an Expandable Domain Group (Executive, Projects, Commercial, Resources, Governance, Intelligence)
  const renderDomainGroup = (domain: NavigationDomainItem) => {
    // Hide parent domain if user lacks access to all of its children
    if (!isDomainVisible(domain)) {
      return null;
    }

    const IconComponent = domain.icon || Layers;
    const isExpanded = !!expandedDomains[domain.title];
    const isGroupActive = isDomainActive(domain);

    return (
      <div key={domain.title} className="space-y-1">
        <button
          type="button"
          onClick={() => toggleDomain(domain.title)}
          aria-expanded={isExpanded}
          className={`w-full group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 text-left cursor-pointer select-none
            ${isGroupActive && !isExpanded 
              ? "bg-[#162238]/60 text-white font-bold" 
              : "text-[#94A3B8] hover:bg-[#162238] hover:text-[#F8FAFC]"
            }`}
        >
          <span className="w-5 min-w-[20px] flex items-center justify-center shrink-0">
            <IconComponent className={`w-4 h-4 transition-colors duration-200 ${isGroupActive ? "text-[#F59E0B]" : "text-[#94A3B8] group-hover:text-[#F8FAFC]"}`} />
          </span>
          
          {(!isCollapsed || isMobileOpen) && (
            <div className="flex items-center justify-between w-full min-w-0">
              <span className="uppercase font-bold tracking-wider text-[11.5px] text-slate-300 group-hover:text-white truncate">
                {domain.title}
              </span>
              <span className="text-slate-400 shrink-0 ml-2">
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </span>
            </div>
          )}

          {isCollapsed && !isMobileOpen && (
            <div className="absolute left-16 scale-0 rounded-lg bg-[#0B172A] px-2.5 py-1 text-[10px] font-bold text-white border border-[#1E293B] shadow-lg transition-all duration-100 group-hover:scale-100 whitespace-nowrap z-50">
              {domain.title}
            </div>
          )}
        </button>

        {/* Children Sub-links */}
        <motion.div
          initial={false}
          animate={{ 
            height: isExpanded && (!isCollapsed || isMobileOpen) ? "auto" : 0, 
            opacity: isExpanded ? 1 : 0 
          }}
          transition={{ duration: 0.18, ease: "easeInOut" }}
          className="overflow-hidden space-y-1 mt-2.5 pl-7"
        >
          {domain.children?.map((child) => renderSingleLink(child, true))}
        </motion.div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 top-16 bg-slate-950/70 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileOpen?.(false)}
        />
      )}

      <motion.aside
        animate={{ 
          width: isCollapsed ? 68 : 316,
        }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className={`
          flex flex-col border-r border-[#1E293B] bg-[#0B172A] text-[#F8FAFC] shadow-xs relative shrink-0 z-50
          fixed md:relative top-16 md:top-0 left-0 md:left-auto bottom-0 md:bottom-auto h-[calc(100vh-64px)]
          transition-transform duration-300 ease-in-out md:transform-none md:transition-none
          ${isMobileOpen ? "translate-x-0 w-[316px] max-w-[85vw]" : "-translate-x-full md:translate-x-0"}
        `}
        style={{
          width: isCollapsed ? 68 : 316
        }}
        id="projectmatrix-sidebar"
      >
        {/* Mobile Project Selector */}
        {isMobileOpen && (
          <div className="px-4 py-4 border-b border-[#1E293B] md:hidden space-y-3 shrink-0">
            <div className="flex items-center gap-2 text-xs text-amber-400 font-bold">
              <Building className="w-4 h-4 shrink-0 text-[#F59E0B]" />
              <span className="truncate">{activeCompany?.name || "No Company"}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300 font-bold">
              <Briefcase className="w-4 h-4 shrink-0 text-slate-400" />
              <select
                value={activeProject?.id || ""}
                onChange={(e) => {
                  const selected = allProjects.find((p) => p.id === e.target.value);
                  if (selected) {
                    onProjectChange?.(selected);
                    setIsMobileOpen?.(false);
                  }
                }}
                className="bg-[#162238] border border-[#1E293B] text-xs font-semibold text-white rounded-xl px-2 py-1.5 w-full cursor-pointer focus:outline-hidden"
              >
                {allProjects.length > 0 ? (
                  allProjects.map((proj) => (
                    <option key={proj.id} value={proj.id} className="text-slate-800 bg-white">
                      [{proj.code || proj.contract_code}] {proj.name}
                    </option>
                  ))
                ) : (
                  <option value="" className="text-slate-800 bg-white">No Projects Found</option>
                )}
              </select>
            </div>
          </div>
        )}

        {/* Scrollable Navigation List */}
        <nav className="flex-1 space-y-1.5 px-3 py-3.5 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {navigation.map((domainItem, index) => {
            const isVisible = isDomainVisible(domainItem);
            if (!isVisible) return null;

            return (
              <React.Fragment key={domainItem.title}>
                {domainItem.children ? renderDomainGroup(domainItem) : renderSingleLink(domainItem as any)}
                {index < navigation.length - 1 && (
                  <div className="my-2.5 border-t border-[#1E293B]/70" />
                )}
              </React.Fragment>
            );
          })}
        </nav>

        {/* Collapse/Expand Footer Button */}
        <div className="p-3 border-t border-[#1E293B] hidden md:flex items-center justify-between shrink-0">
          {!isCollapsed && (
            <div className="text-[10.5px] font-mono text-slate-400 truncate">
              Enterprise RBAC v3.0
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#1E293B] bg-[#0B172A] text-[#94A3B8] hover:bg-[#162238] hover:text-white transition-colors shadow-xs cursor-pointer ml-auto"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </motion.aside>
    </>
  );
}
