"use client";

import { useState } from "react";

interface ShareLinkButtonProps {
  url: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}

export function ShareLinkButton({
  url,
  label = "Copy link",
  copiedLabel = "Link copied",
  className = "",
}: ShareLinkButtonProps): React.ReactElement {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  };

  return (
    <button
      type="button"
      onClick={() => {
        void handleCopy();
      }}
      className={`min-h-11 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 ${className}`}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
