interface GhostIconProps {
  size?: number;
  className?: string;
}

export function GhostIcon({
  size = 16,
  className = "",
}: GhostIconProps): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label="Possible ghost"
      className={className}
    >
      <path
        d="M12 2c3.9 0 7 3.1 7 7v8.5c0 .8-.9 1.3-1.6.9l-1.9-1.1c-.5-.3-1.1-.3-1.6 0L12 19.8l-1.9-1.1c-.5-.3-1.1-.3-1.6 0L6.6 19.4c-.7.4-1.6-.1-1.6-.9V9c0-3.9 3.1-7 7-7Z"
        fill="currentColor"
        className="text-zinc-400 dark:text-zinc-300"
      />
      <circle cx="9" cy="11" r="1.3" fill="#111827" />
      <circle cx="15" cy="11" r="1.3" fill="#111827" />
      <path
        d="M10 14.5c.7.8 2.3.8 3 0"
        stroke="#111827"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
