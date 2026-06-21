"use client";

import { useCallback, useState } from "react";
import { useLiveRefreshClock } from "@/hooks/useLiveRefreshClock";

export function useManualRefreshCooldown(cooldownMs: number): {
  isOnCooldown: boolean;
  cooldownRemainingMs: number;
  triggerCooldown: () => void;
} {
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const now = useLiveRefreshClock(cooldownUntil !== null);

  const isOnCooldown = cooldownUntil !== null && now < cooldownUntil;
  const cooldownRemainingMs =
    isOnCooldown && cooldownUntil !== null ? cooldownUntil - now : 0;

  const triggerCooldown = useCallback(() => {
    setCooldownUntil(Date.now() + cooldownMs);
  }, [cooldownMs]);

  return {
    isOnCooldown,
    cooldownRemainingMs,
    triggerCooldown,
  };
}
