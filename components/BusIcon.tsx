interface BusIconVariant {
  variant?: "live" | "faded" | "ghost";
}

const bodyColors = {
  live: "#DC2626",
  faded: "#DC2626",
  ghost: "#9CA3AF",
} as const;

const roofColors = {
  live: "#B91C1C",
  faded: "#B91C1C",
  ghost: "#6B7280",
} as const;

interface BusIconGraphicProps extends BusIconVariant {
  routeNumber?: string;
}

export function BusIconGraphic({
  routeNumber,
  variant = "live",
}: BusIconGraphicProps): React.ReactElement {
  return (
    <>
      <rect x="4" y="8" width="24" height="16" rx="3" fill={bodyColors[variant]} />
      <rect
        x="6"
        y="10"
        width="8"
        height="6"
        rx="1"
        fill="#FEE2E2"
        opacity={variant === "ghost" ? 0.7 : 1}
      />
      <rect
        x="18"
        y="10"
        width="8"
        height="6"
        rx="1"
        fill="#FEE2E2"
        opacity={variant === "ghost" ? 0.7 : 1}
      />
      <circle cx="10" cy="26" r="3" fill="#1F2937" />
      <circle cx="22" cy="26" r="3" fill="#1F2937" />
      <rect x="14" y="6" width="4" height="3" rx="1" fill={roofColors[variant]} />
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
    </>
  );
}

interface BusIconProps extends BusIconGraphicProps {
  size?: number;
  className?: string;
  isActive?: boolean;
}

export function BusIcon({
  routeNumber,
  size = 32,
  className = "",
  isActive = false,
  variant = "live",
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
      <BusIconGraphic routeNumber={routeNumber} variant={variant} />
    </svg>
  );
}

interface EmbeddedBusIconProps extends BusIconGraphicProps {
  size?: number;
  isActive?: boolean;
  ariaLabel: string;
}

export function EmbeddedBusIcon({
  routeNumber,
  size = 32,
  isActive = false,
  variant = "live",
  ariaLabel,
}: EmbeddedBusIconProps): React.ReactElement {
  return (
    <svg
      x={0}
      y={0}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label={ariaLabel}
      className={isActive ? "scale-110" : undefined}
      style={{ overflow: "visible" }}
    >
      <BusIconGraphic routeNumber={routeNumber} variant={variant} />
    </svg>
  );
}
