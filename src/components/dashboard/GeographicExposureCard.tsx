import React from "react";
import ProjectLocationMapCard from "./ProjectLocationMapCard";
import { SupportedCurrency } from "../../config/currencies";

export interface GeographicExposureCardProps {
  activeProject?: any;
  allProjects?: any[];
  activeCompany?: any;
  onProjectChange?: (project: any) => void;
  selectedCurrency?: SupportedCurrency;
  className?: string;
  [key: string]: any;
}

export default function GeographicExposureCard(props: GeographicExposureCardProps) {
  return <ProjectLocationMapCard {...props} />;
}
