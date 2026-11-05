/**
 * ============================================================================
 * LENS BI — Central Unified Color & Design Tokens (الملف الأساسي لتوحيد الألوان)
 * ============================================================================
 * المصدر الموحد لجميع ألوان المنصة للثيمين (الأبيض والداكن).
 * يُستخدم برمجياً في المكونات، الرسوم البيانية (ECharts)، وتنسيقات CSS.
 */

export interface ThemeColors {
  bgApp: string;
  bgCanvas: string;
  bgCard: string;
  bgCardHover: string;
  bgHeader: string;
  bgSidebar: string;
  bgSurface: string;
  bgSurfaceSoft: string;
  bgInput: string;
  bgHover: string;
  bgActive: string;

  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textSubtle: string;
  textHeading: string;
  textInverse: string;

  borderCard: string;
  borderDefault: string;
  borderSubtle: string;
  borderInput: string;

  shadowCard: string;
  shadowClay: string;
  shadowGlow: string;

  // Chart specific
  chartText: string;
  chartSplitLine: string;
  chartTooltipBg: string;
  chartTooltipBorder: string;
}

export const THEME_TOKENS: Record<'light' | 'dark', ThemeColors> = {
  // ─── الثيم الداكن (Dark Mode — Modern Slate & Purple) ─────────────────────────
  dark: {
    bgApp: '#090d16',
    bgCanvas: '#0b1120',
    bgCard: '#0f172a',
    bgCardHover: '#1e293b',
    bgHeader: '#0f172a',
    bgSidebar: '#0f172a',
    bgSurface: '#1e293b',
    bgSurfaceSoft: '#172033',
    bgInput: '#090d16',
    bgHover: '#1e293b',
    bgActive: '#334155',

    textPrimary: '#f8fafc',
    textSecondary: '#cbd5e1',
    textMuted: '#94a3b8',
    textSubtle: '#64748b',
    textHeading: '#ffffff',
    textInverse: '#0f172a',

    borderCard: 'rgba(255, 255, 255, 0.10)',
    borderDefault: 'rgba(255, 255, 255, 0.10)',
    borderSubtle: 'rgba(255, 255, 255, 0.06)',
    borderInput: '#334155',

    shadowCard: '0 10px 30px -5px rgba(0, 0, 0, 0.5)',
    shadowClay: '0 16px 36px -6px rgba(0, 0, 0, 0.65), 0 8px 18px -3px rgba(0, 0, 0, 0.45)',
    shadowGlow: '0 0 20px rgba(14, 165, 233, 0.25)',

    chartText: '#94a3b8',
    chartSplitLine: '#1e293b',
    chartTooltipBg: 'rgba(15, 23, 42, 0.95)',
    chartTooltipBorder: '#334155'
  },

  // ─── الثيم الأبيض (Light Mode — باقر Pristine White & Claymorphism 2.0) ──────
  light: {
    bgApp: '#f1f5f9',
    bgCanvas: '#f1f5f9',
    bgCard: '#ffffff',
    bgCardHover: '#ffffff',
    bgHeader: '#ffffff',
    bgSidebar: '#ffffff',
    bgSurface: '#ffffff',
    bgSurfaceSoft: '#f8fafc',
    bgInput: '#f8fafc',
    bgHover: '#f1f5f9',
    bgActive: '#e2e8f0',

    textPrimary: '#0f172a',
    textSecondary: '#1e293b',
    textMuted: '#64748b',
    textSubtle: '#94a3b8',
    textHeading: '#0f172a',
    textInverse: '#ffffff',

    borderCard: 'rgba(226, 232, 240, 0.85)',
    borderDefault: '#e2e8f0',
    borderSubtle: '#f1f5f9',
    borderInput: '#cbd5e1',

    shadowCard: '0 4px 14px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.04)',
    shadowClay: '8px 8px 20px rgba(162, 178, 204, 0.25), -6px -6px 16px rgba(255, 255, 255, 0.9)',
    shadowGlow: '0 4px 14px rgba(37, 99, 235, 0.15)',

    chartText: '#334155',
    chartSplitLine: '#e2e8f0',
    chartTooltipBg: '#ffffff',
    chartTooltipBorder: '#cbd5e1'
  }
};

/**
 * جلب حزمة الألوان الحالية بالاعتماد على الثيم النشط
 */
export const getThemeColors = (theme: 'light' | 'dark' = 'dark'): ThemeColors => {
  return THEME_TOKENS[theme] || THEME_TOKENS.dark;
};

