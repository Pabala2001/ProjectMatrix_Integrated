import React from "react";

export interface ProjectMatrixLogoProps {
  className?: string;
  style?: React.CSSProperties;
  theme?: "dark" | "light" | "auto";
}

export default function ProjectMatrixLogo({ className, style, theme = "dark" }: ProjectMatrixLogoProps) {
  const isLight = theme === "light";
  
  const primaryColor = isLight ? "#07182E" : "#FFFFFF";
  const accentColor = "#FF6B00"; // Signature Project Matrix Amber / Orange
  const building3Color = isLight ? "#64748B" : "#E2E8F0";

  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 520 90"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: "block", ...style }}
    >
      {/* ========================================== */}
      {/* 1. CRANE AND FOUNDATION LINES              */}
      {/* ========================================== */}
      
      {/* Lower foundation line: Perfectly horizontal, 110px x 2px */}
      <line
        x1="12"
        y1="76"
        x2="122"
        y2="76"
        stroke={primaryColor}
        strokeWidth="2"
        strokeLinecap="square"
      />

      {/* Upper foundation immediately beneath crane mast: 28px x 4px */}
      <rect
        x="21"
        y="71"
        width="28"
        height="4"
        fill={primaryColor}
      />

      {/* Crane base plate: 24px x 4px */}
      <rect
        x="23"
        y="67"
        width="24"
        height="4"
        fill={primaryColor}
      />

      {/* ========================================== */}
      {/* 2. CRANE MAST (LATTICE STEEL)              */}
      {/* ========================================== */}
      
      {/* Parallel vertical lines: 14px outer width, x=28 and x=42 */}
      <line x1="28" y1="25" x2="28" y2="67" stroke={primaryColor} strokeWidth="2" />
      <line x1="42" y1="25" x2="42" y2="67" stroke={primaryColor} strokeWidth="2" />

      {/* Lattice X-Bracing: 7 cells of 6px height from y=25 to y=67 */}
      <line x1="28" y1="25" x2="42" y2="31" stroke={primaryColor} strokeWidth="1.5" />
      <line x1="42" y1="25" x2="28" y2="31" stroke={primaryColor} strokeWidth="1.5" />
      
      <line x1="28" y1="31" x2="42" y2="37" stroke={primaryColor} strokeWidth="1.5" />
      <line x1="42" y1="31" x2="28" y2="37" stroke={primaryColor} strokeWidth="1.5" />

      <line x1="28" y1="37" x2="42" y2="43" stroke={primaryColor} strokeWidth="1.5" />
      <line x1="42" y1="37" x2="28" y2="43" stroke={primaryColor} strokeWidth="1.5" />

      <line x1="28" y1="43" x2="42" y2="49" stroke={primaryColor} strokeWidth="1.5" />
      <line x1="42" y1="43" x2="28" y2="49" stroke={primaryColor} strokeWidth="1.5" />

      <line x1="28" y1="49" x2="42" y2="55" stroke={primaryColor} strokeWidth="1.5" />
      <line x1="42" y1="49" x2="28" y2="55" stroke={primaryColor} strokeWidth="1.5" />

      <line x1="28" y1="55" x2="42" y2="61" stroke={primaryColor} strokeWidth="1.5" />
      <line x1="42" y1="55" x2="28" y2="61" stroke={primaryColor} strokeWidth="1.5" />

      <line x1="28" y1="61" x2="42" y2="67" stroke={primaryColor} strokeWidth="1.5" />
      <line x1="42" y1="61" x2="28" y2="67" stroke={primaryColor} strokeWidth="1.5" />

      {/* ========================================== */}
      {/* 3. OPERATOR CABIN                          */}
      {/* ========================================== */}
      <rect
        x="20"
        y="25"
        width="8"
        height="8"
        fill={primaryColor}
      />

      {/* ========================================== */}
      {/* 4. CRANE JIB & TRIANGULAR LATTICE TRUSS    */}
      {/* ========================================== */}
      {/* Top horizontal edge */}
      <line x1="35" y1="18" x2="93" y2="18" stroke={primaryColor} strokeWidth="2" />
      
      {/* Bottom horizontal edge */}
      <line x1="35" y1="25" x2="93" y2="25" stroke={primaryColor} strokeWidth="2" />

      {/* Zigzag bracing triangles in main arm */}
      <path
        d="M 35 25 L 43.2 18 L 51.4 25 L 59.6 18 L 67.8 25 L 76.0 18 L 84.2 25 L 92.4 18"
        stroke={primaryColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Taper end plate */}
      <line x1="93" y1="18" x2="93" y2="25" stroke={primaryColor} strokeWidth="1.5" />

      {/* ========================================== */}
      {/* 5. COUNTER JIB & WEIGHT                    */}
      {/* ========================================== */}
      <line x1="19" y1="19" x2="35" y2="19" stroke={primaryColor} strokeWidth="1.5" />
      <line x1="19" y1="25" x2="35" y2="25" stroke={primaryColor} strokeWidth="1.5" />
      
      {/* Bracing cells */}
      <line x1="19" y1="19" x2="27" y2="25" stroke={primaryColor} strokeWidth="1" />
      <line x1="27" y1="19" x2="35" y2="25" stroke={primaryColor} strokeWidth="1" />
      <line x1="27" y1="25" x2="19" y2="19" stroke={primaryColor} strokeWidth="1" />

      {/* Counterweight */}
      <rect
        x="9"
        y="18"
        width="10"
        height="8"
        fill={primaryColor}
      />

      {/* ========================================== */}
      {/* 6. CRANE PEAK                              */}
      {/* ========================================== */}
      <polygon
        points="29,18 35,8 41,18"
        stroke={primaryColor}
        strokeWidth="1.5"
        fill="none"
      />
      {/* Peak internal support */}
      <line x1="35" y1="8" x2="35" y2="18" stroke={primaryColor} strokeWidth="1.5" />

      {/* ========================================== */}
      {/* 7. HOIST CABLE & HOOK                      */}
      {/* ========================================== */}
      <line x1="80" y1="25" x2="80" y2="37" stroke={primaryColor} strokeWidth="2" />

      {/* Hook in signature orange/amber */}
      <path
        d="M 80 37 A 1.2 1.2 0 1 1 80 39.4 A 2.2 2.2 0 0 1 78.4 43.5 C 77 43.5 76 42.2 76 41 C 76 40 76.8 39.2 77.5 39.2 C 78 39.2 78.5 39.5 78.5 40"
        stroke={accentColor}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />

      {/* ========================================== */}
      {/* 8. BUILDING GROUP                          */}
      {/* ========================================== */}
      {/* BUILDING 1 (Left): Signature Orange */}
      <path
        d="M 52 76 V 50 L 61 53 V 76 Z"
        fill={accentColor}
      />

      {/* BUILDING 2 (Middle): Primary color */}
      <path
        d="M 65 76 V 45 L 77 48 V 76 Z"
        fill={primaryColor}
      />

      {/* BUILDING 3 (Right): Subtle secondary shade */}
      <path
        d="M 81 76 V 58 L 93 62 V 76 Z"
        fill={building3Color}
      />

      {/* ========================================== */}
      {/* 9. WORDMARK                                */}
      {/* ========================================== */}
      <text
        x="138"
        y="55"
        fill={primaryColor}
        fontFamily="'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
        fontSize="38"
        fontWeight="700"
        letterSpacing="-0.03em"
      >
        Project<tspan fill={accentColor}>Matrix</tspan>
      </text>
    </svg>
  );
}

