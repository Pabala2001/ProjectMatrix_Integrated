/**
 * ProjectMatrix Unified Design System Tokens
 * Strict reduced palette adhering to enterprise precision:
 * Primary UI: Deep Navy (#0B172A), Surface Grey (#F7F8FA), Border (#E6E9EF), Primary Text (#172033), Secondary Text (#667085)
 * Brand Accent: Amber/Gold (#F59E0B)
 * Semantic Meaning: Green (Healthy/Approved), Amber (Warning), Red (Critical), Blue (Information)
 */

export const tokens = {
  color: {
    // Primary UI Surfaces & Canvas
    canvas: "#F7F8FA",
    surface: "#FFFFFF",
    sidebar: "#0B172A",
    headerBg: "#0B172A",
    cardBg: "#FFFFFF",

    // Typography
    text: "#172033",
    secondary: "#667085",
    muted: "#667085",

    // Structural Borders
    border: "#E6E9EF",
    borderSubtle: "#F2F4F7",

    // Primary UI & CTA Default
    primary: "#0B172A",

    // Brand Accent (Strictly for Primary CTA, Active Navigation, Commercial emphasis, Ask Advisor)
    accent: "#F59E0B",
    brandAmber: "#F59E0B",

    // Strictly Semantic Colors
    success: "#10B981",  // Healthy / Approved
    warning: "#F59E0B",  // Warning
    critical: "#EF4444", // Critical / Danger
    info: "#3B82F6",     // Information
  },
  typography: {
    fontSans: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    fontMono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
  shadows: {
    xs: "0 1px 2px 0 rgba(11, 23, 42, 0.04)",
    sm: "0 1px 3px 0 rgba(11, 23, 42, 0.08), 0 1px 2px 0 rgba(11, 23, 42, 0.04)",
    md: "0 4px 8px -2px rgba(11, 23, 42, 0.08), 0 2px 4px -2px rgba(11, 23, 42, 0.04)",
    lg: "0 12px 16px -4px rgba(11, 23, 42, 0.08), 0 4px 6px -2px rgba(11, 23, 42, 0.03)",
  },
  radius: {
    sm: "6px",
    md: "10px",
    lg: "16px",
    xl: "20px",
    pill: "9999px"
  }
};

export default tokens;
