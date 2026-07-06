/**
 * Theme tokens from design_guidelines.json
 */
export const theme = {
  color: {
    surface: "#0B0E14",
    onSurface: "#E0E3EB",
    surfaceSecondary: "#131722",
    onSurfaceSecondary: "#A0A8B8",
    surfaceTertiary: "#1E222D",
    onSurfaceTertiary: "#C1C8D7",
    brand: "#00D9FF",
    brandSecondary: "#00FF88",
    brandTertiary: "#003344",
    success: "#00FF88",
    warning: "#FFB800",
    error: "#FF3B30",
    info: "#00D9FF",
    border: "#2A2E39",
    borderStrong: "#363C4E",
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  radius: { sm: 6, md: 12, lg: 16, pill: 999 },
  font: {
    sm: 12,
    base: 14,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
};

export const gradeColor = (q: string) => {
  switch (q) {
    case "A+": return theme.color.brandSecondary;
    case "A": return theme.color.brand;
    case "B": return theme.color.warning;
    default: return theme.color.onSurfaceSecondary;
  }
};

export const actionColor = (a: string) => {
  if (a === "BUY") return theme.color.brandSecondary;
  if (a === "SELL") return theme.color.error;
  return theme.color.warning;
};
