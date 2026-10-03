import React from 'react';

interface DiscordPixelIconProps {
  className?: string;
  size?: number;
}

export const DiscordPixelIcon: React.FC<DiscordPixelIconProps> = ({
  className = 'w-5 h-5',
  size = 24,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      shapeRendering="crispEdges"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Pixel-art Discord Clyde logo constructed with block pixels */}
      <rect x="5" y="4" width="14" height="2" />
      <rect x="3" y="6" width="18" height="2" />
      <rect x="2" y="8" width="20" height="7" />
      <rect x="3" y="15" width="18" height="2" />
      <rect x="4" y="17" width="4" height="3" />
      <rect x="16" y="17" width="4" height="3" />
      <rect x="8" y="17" width="8" height="1" />
      <rect x="6" y="20" width="2" height="1" />
      <rect x="16" y="20" width="2" height="1" />

      {/* Eyes Cutouts */}
      <rect x="6" y="10" width="3" height="4" fill="#0c0707" />
      <rect x="15" y="10" width="3" height="4" fill="#0c0707" />

      {/* Smile/Cutout beneath */}
      <rect x="10" y="14" width="4" height="1" fill="#0c0707" />
    </svg>
  );
};
