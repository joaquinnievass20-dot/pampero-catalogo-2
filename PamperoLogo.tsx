import React from 'react';

interface PamperoLogoProps {
  customUrl?: string;
  className?: string;
  imageClassName?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  height?: number;
  showSubtitle?: boolean;
  variant?: 'dark' | 'light';
  onDarkBackground?: boolean;
}

export const PamperoLogo: React.FC<PamperoLogoProps> = ({
  customUrl,
  className = '',
  imageClassName = '',
  size = 'md',
  variant,
  onDarkBackground,
}) => {
  // Always default strictly to official static logo
  const officialLogo = '/logo-oficial.png.png';
  const resolvedUrl = (customUrl && customUrl.trim() !== '') ? customUrl.trim() : officialLogo;
  const isLight = variant === 'light' || onDarkBackground;

  return (
    <div 
      className={`inline-flex items-center justify-center shrink-0 ${className}`}
    >
      <img
        src={resolvedUrl}
        alt="PAMPERO OFICIAL"
        className={`h-14 w-auto object-contain shrink-0 ${isLight ? 'brightness-0 invert filter' : ''} ${imageClassName}`.trim()}
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
