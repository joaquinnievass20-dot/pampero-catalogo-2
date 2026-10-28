import React from 'react';
import { isColorDark } from '../context/ThemeContext';

interface PamperoLogoProps {
  customUrl?: string;
  customLogoUrl?: string;
  className?: string;
  imageClassName?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  height?: number;
  showSubtitle?: boolean;
  variant?: 'dark' | 'light';
  onDarkBackground?: boolean;
  navBgColor?: string;
}

export const PamperoLogo: React.FC<PamperoLogoProps> = ({
  customUrl,
  customLogoUrl,
  className = '',
  imageClassName = '',
  size = 'md',
  height,
  variant,
  onDarkBackground,
  navBgColor,
}) => {
  // Always default strictly to official static logo
  const officialLogo = '/logo-oficial.png.png';
  const urlCandidate = customLogoUrl || customUrl;
  const resolvedUrl = (urlCandidate && urlCandidate.trim() !== '') ? urlCandidate.trim() : officialLogo;

  // Automated Light/Dark logic:
  // If explicitly specified, respect it.
  // Otherwise, if navBgColor is passed, calculate luminance.
  // Otherwise, inspect document's CSS variable --header-bg or theme from localStorage.
  let isLight = false;
  if (onDarkBackground !== undefined) {
    isLight = onDarkBackground;
  } else if (variant !== undefined) {
    isLight = variant === 'light';
  } else if (navBgColor) {
    isLight = isColorDark(navBgColor);
  } else if (typeof window !== 'undefined') {
    try {
      const headerBg = document.documentElement.style.getPropertyValue('--header-bg') || 
                       localStorage.getItem('pampero_header_bg');
      if (headerBg) {
        isLight = isColorDark(headerBg);
      }
    } catch {}
  }

  // Calculate pixel height
  const pixelHeight = height 
    ? `${height}px` 
    : size === 'sm' ? '32px' 
    : size === 'lg' ? '48px' 
    : size === 'xl' ? '56px' 
    : '40px';

  return (
    <div 
      className={`inline-flex items-center justify-center shrink-0 ${className}`}
    >
      <img
        src={resolvedUrl}
        alt="PAMPERO OFICIAL"
        style={{ height: pixelHeight }}
        className={`w-auto object-contain shrink-0 transition-all duration-200 ${isLight ? 'brightness-0 invert filter' : ''} ${imageClassName}`.trim()}
        onError={(e) => {
          // Guaranteed fallback strictly to static official logo
          if (e.currentTarget.src !== window.location.origin + officialLogo) {
            e.currentTarget.src = officialLogo;
          }
        }}
      />
    </div>
  );
};
