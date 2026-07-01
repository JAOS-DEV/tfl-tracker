export interface MapTileConfig {
  url: string;
  attribution: string;
}

const DEFAULT_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const DEFAULT_ATTRIBUTION = "© OpenStreetMap contributors";

export function getMapTileConfig(
  env: Record<string, string | undefined> = process.env,
): MapTileConfig {
  return {
    url: env.NEXT_PUBLIC_MAP_TILE_URL?.trim() || DEFAULT_TILE_URL,
    attribution:
      env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION?.trim() || DEFAULT_ATTRIBUTION,
  };
}
