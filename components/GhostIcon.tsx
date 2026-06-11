interface GhostIconProps {
  size?: number;
  className?: string;
  variant?: "default" | "marker";
}

export function GhostIcon({
  size = 16,
  className = "",
  variant = "default",
}: GhostIconProps): React.ReactElement {
  const isMarker = variant === "marker";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label="Possible ghost"
      className={`${isMarker ? "drop-shadow-sm" : "drop-shadow"} ${className}`}
    >
      {!isMarker ? (
        <ellipse cx="12" cy="13" rx="8.5" ry="9.5" fill="#C4B5FD" opacity="0.45" />
      ) : null}
      <path
        d="M12 2.25c3.7 0 6.75 3 6.75 6.75V17.5c0 .85-.95 1.35-1.65.95l-1.85-1.05c-.5-.3-1.1-.3-1.6 0L12 19.1l-1.65-.95c-.5-.3-1.1-.3-1.6 0l-1.85 1.05c-.7.4-1.65-.1-1.65-.95V9c0-3.75 3.05-6.75 6.75-6.75Z"
        fill={isMarker ? "#FFFFFF" : "#F5F3FF"}
        stroke={isMarker ? "#DDD6FE" : "#8B5CF6"}
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <circle
        cx="9"
        cy="10.5"
        r="1.65"
        fill={isMarker ? "#5B21B6" : "#4C1D95"}
      />
      <circle
        cx="15"
        cy="10.5"
        r="1.65"
        fill={isMarker ? "#5B21B6" : "#4C1D95"}
      />
      <circle cx="9.55" cy="9.95" r="0.55" fill="#FFFFFF" />
      <circle cx="15.55" cy="9.95" r="0.55" fill="#FFFFFF" />
      <circle
        cx="12"
        cy="14.75"
        r="1.15"
        fill={isMarker ? "#5B21B6" : "#4C1D95"}
        opacity="0.85"
      />
    </svg>
  );
}
