import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { ThemeConfig } from '../types';
import { INITIAL_THEME } from '../data/initialData';
import { subscribeToFirestoreStoreConfig, saveFirestoreStoreConfig } from '../services/firebase';

/**
 * Calculates whether a given CSS color is perceived as dark or light
 * based on the standard luminance formula.
 */
export function isColorDark(color?: string): boolean {
  if (!color) return false;
  const c = color.trim().toLowerCase();
  if (c === 'transparent' || c === 'inherit') return false;
  if (c === 'white' || c === '#fff' || c === '#ffffff') return false;
  if (c === 'black' || c === '#000' || c === '#000000') return true;

  // Hex format (#RGB or #RRGGBB)
  if (c.startsWith('#')) {
    let hex = c.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map((x) => x + x).join('');
    }
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      return brightness < 155;
    }
  }

  // RGB or RGBA format
  const rgbMatch = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness < 155;
  }

  return false;
}

/**
 * Applies theme properties directly to CSS variables and document head
 * for instant, 0-latency styling across the entire platform.
 */
export function applyThemeToDocument(theme: ThemeConfig) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // 1. Tipografía y Google Fonts
  const selectedFont = theme.fontFamily || 'Montserrat';
  document.body.style.fontFamily = `'${selectedFont}', sans-serif`;
  root.style.fontFamily = `'${selectedFont}', sans-serif`;
  root.style.setProperty('--font-family', `'${selectedFont}', sans-serif`);
  root.style.setProperty('--font-display', `'${selectedFont}', sans-serif`);

  const fontLinkId = 'pampero-dynamic-font';
  let linkEl = document.getElementById(fontLinkId) as HTMLLinkElement | null;
  if (!linkEl) {
    linkEl = document.createElement('link');
    linkEl.id = fontLinkId;
    linkEl.rel = 'stylesheet';
    document.head.appendChild(linkEl);
  }
  const fontQuery = encodeURIComponent(selectedFont).replace(/%20/g, '+');
  const targetHref = `https://fonts.googleapis.com/css2?family=${fontQuery}:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,700&display=swap`;
  if (linkEl.href !== targetHref) {
    linkEl.href = targetHref;
  }

  // 2. Colores y variables de marca
  const primary = theme.buttonBgColor || theme.primaryColor || '#18231C';
  const accent = theme.accentColor || '#FDB813';
  const bg = theme.backgroundColor || '#F5F2EC';
  const text = theme.catalogTextColor || theme.textColor || '#22201D';
  const catalogTitle = theme.catalogTitleColor || theme.textColor || '#18231C';
  const headerBg = theme.headerBgColor || '#FFFFFF';
  const darkNav = isColorDark(headerBg);
  const headerText = theme.headerTextColor || (darkNav ? '#F5F2EC' : '#18231C');
  const hubBg = theme.hubBgColor || theme.panelBgColor || theme.primaryColor || '#18231C';
  const darkHub = isColorDark(hubBg);
  const hubText = theme.hubTextColor || theme.panelTextColor || (darkHub ? '#F5F2EC' : '#18231C');
  const cardBg = theme.cardBgColor || theme.panelBgColor || '#FAF8F5';
  const cardBorder = theme.cardBorderColor || '#DCD4C9';
  const buttonText = theme.buttonTextColor || (isColorDark(primary) ? '#FFFFFF' : '#18231C');

  root.style.setProperty('--background', bg);
  root.style.setProperty('--foreground', text);
  root.style.setProperty('--primary', primary);
  root.style.setProperty('--primary-foreground', headerText);
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-foreground', buttonText);
  root.style.setProperty('--btn-bg', primary);
  root.style.setProperty('--btn-text', buttonText);
  root.style.setProperty('--card', cardBg);
  root.style.setProperty('--border', cardBorder);
  root.style.setProperty('--header-bg', headerBg);
  root.style.setProperty('--header-text', headerText);
  root.style.setProperty('--hub-bg', hubBg);
  root.style.setProperty('--hub-text', hubText);
  root.style.setProperty('--catalog-title', catalogTitle);
  root.style.setProperty('--catalog-text', text);

  if (theme.seasonBadgeBg) root.style.setProperty('--season-badge-bg', theme.seasonBadgeBg);
  if (theme.seasonBadgeText) root.style.setProperty('--season-badge-text', theme.seasonBadgeText);
  if (theme.discountBadgeBg) root.style.setProperty('--discount-badge-bg', theme.discountBadgeBg);
  if (theme.discountBadgeText) root.style.setProperty('--discount-badge-text', theme.discountBadgeText);
}

export interface ThemeContextType {
  theme: ThemeConfig;
  updateTheme: (newTheme: Partial<ThemeConfig> | ThemeConfig, persistRemote?: boolean) => void;
  resetToOfficial: () => void;
  isDarkHeader: boolean;
  isDarkNav: (bgColor?: string) => boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: ThemeConfig;
  onThemeChanged?: (theme: ThemeConfig) => void;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  initialTheme,
  onThemeChanged,
}) => {
  const [theme, setTheme] = useState<ThemeConfig>(() => {
    if (initialTheme) return initialTheme;
    try {
      const saved = localStorage.getItem('pampero_theme_config') || localStorage.getItem('pampero_catalog_theme');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.headerBgColor === '#18231C') {
          parsed.headerBgColor = '#FFFFFF';
          parsed.headerTextColor = '#18231C';
        }
        return { ...INITIAL_THEME, ...parsed };
      }
    } catch {}
    return INITIAL_THEME;
  });

  const debounceTimerRef = useRef<any>(null);

  // Apply to document on mount and whenever theme changes
  useEffect(() => {
    applyThemeToDocument(theme);
    if (onThemeChanged) {
      onThemeChanged(theme);
    }
  }, [theme, onThemeChanged]);

  // Real-time Firestore configuration listener for theme changes across devices
  useEffect(() => {
    const unsub = subscribeToFirestoreStoreConfig((remoteConfig) => {
      if (remoteConfig && remoteConfig.theme) {
        setTheme((prev) => {
          // Guard: prevent re-render loop if theme is identical
          if (JSON.stringify(prev) === JSON.stringify(remoteConfig.theme)) {
            return prev;
          }
          const merged = { ...prev, ...remoteConfig.theme };
          applyThemeToDocument(merged);
          try {
            localStorage.setItem('pampero_theme_config', JSON.stringify(merged));
            localStorage.setItem('pampero_catalog_theme', JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }
    });

    return () => unsub();
  }, []);

  const updateTheme = (newThemeOrPartial: Partial<ThemeConfig> | ThemeConfig, persistRemote: boolean = true) => {
    setTheme((prev) => {
      const merged: ThemeConfig = { ...prev, ...newThemeOrPartial };

      // 1. Immediately apply to DOM / CSS variables for instant 60fps update
      applyThemeToDocument(merged);

      // 2. Immediately save to localStorage
      try {
        localStorage.setItem('pampero_theme_config', JSON.stringify(merged));
        localStorage.setItem('pampero_catalog_theme', JSON.stringify(merged));
        if (merged.customLogoUrl) {
          localStorage.setItem('pampero_custom_logo', merged.customLogoUrl);
        }
        if (merged.logoHeight) {
          localStorage.setItem('pampero_logo_height', merged.logoHeight.toString());
        }
      } catch {}

      // 3. Debounce save to Firestore to prevent infinite loops and saturation
      if (persistRemote) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
          saveFirestoreStoreConfig({ theme: merged });
        }, 500);
      }

      return merged;
    });
  };

  const resetToOfficial = () => {
    updateTheme(INITIAL_THEME, true);
  };

  const isDarkHeader = isColorDark(theme.headerBgColor || '#FFFFFF');

  return (
    <ThemeContext.Provider
      value={{
        theme,
        updateTheme,
        resetToOfficial,
        isDarkHeader,
        isDarkNav: (bgColor?: string) => isColorDark(bgColor || theme.headerBgColor || '#FFFFFF'),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    // Graceful fallback if called outside ThemeProvider
    return {
      theme: INITIAL_THEME,
      updateTheme: () => {},
      resetToOfficial: () => {},
      isDarkHeader: false,
      isDarkNav: () => false,
    };
  }
  return context;
};
