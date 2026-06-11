interface BusIconProps {
  routeNumber?: string;
  size?: number;
  className?: string;
  isActive?: boolean;
}

export function BusIcon({
  routeNumber,
  size = 32,
  className = "",
  isActive = false,
}: BusIconProps): React.ReactElement {
  const label = routeNumber
    ? `Bus route ${routeNumber}`
    : "Bus estimated position";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label={label}
      className={`transition-transform duration-200 ${
        isActive ? "scale-110" : "scale-100"
      } ${className}`}
    >
      <rect x="4" y="8" width="24" height="16" rx="3" fill="#DC2626" />
      <rect x="6" y="10" width="8" height="6" rx="1" fill="#FEE2E2" />
      <rect x="18" y="10" width="8" height="6" rx="1" fill="#FEE2E2" />
      <circle cx="10" cy="26" r="3" fill="#1F2937" />
      <circle cx="22" cy="26" r="3" fill="#1F2937" />
      <rect x="14" y="6" width="4" height="3" rx="1" fill="#B91C1C" />
      {routeNumber && routeNumber.length <= 4 ? (
        <text
          x="16"
          y="19"
          textAnchor="middle"
          fontSize="7"
          fontWeight="700"
          fill="#FFFFFF"
          fontFamily="Arial, sans-serif"
        >
          {routeNumber}
        </text>
      ) : null}
    </svg>
  );
}
