import React, { createContext, useContext } from "react";
import { useLocation, useOutletContext } from "react-router-dom";
import { ProjectHeader, ProjectSection } from "../ui/ProjectHeader";

export interface ProjectShellProps {
  project?: any;
  section?: ProjectSection | string;
  children: React.ReactNode;
  activeCompany?: any;
  className?: string;
  actions?: React.ReactNode;
}

const ProjectShellContext = createContext<boolean>(false);

/**
 * Universal ProjectShell
 * Wraps project pages in the unified ProjectHeader and prevents nested duplication.
 */
export default function ProjectShell({
  project: propProject,
  section: propSection,
  children,
  className = "",
  actions
}: ProjectShellProps) {
  const isNested = useContext(ProjectShellContext);
  const location = useLocation();
  const context = useOutletContext<any>() || {};

  // If already rendered inside an outer ProjectShell, simply render children to avoid duplicate header card
  if (isNested) {
    return <div className={`min-w-0 ${className}`}>{children}</div>;
  }

  // Resolve active project from prop, context, or context project list
  const project = propProject || context.activeProject || (context.allProjects && context.allProjects.length > 0 ? context.allProjects[0] : null);

  const section = (propSection || "").toLowerCase() as ProjectSection;

  return (
    <ProjectShellContext.Provider value={true}>
      <div className={`space-y-6 pb-12 w-full max-w-[1520px] mx-auto ${className}`} id="project-shell-root">
        {/* Universal Standard Project Header */}
        <ProjectHeader
          project={project}
          activeSection={section}
          actions={actions}
        />

        {/* Main Page Content */}
        <div className="min-w-0">
          {children}
        </div>
      </div>
    </ProjectShellContext.Provider>
  );
}

export { ProjectShell, ProjectShellContext };

