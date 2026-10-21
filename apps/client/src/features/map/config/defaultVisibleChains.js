import MARKER_COLORS from "@/features/map/config/markerColors";

const FALLBACK = ["Vero", "Ramstore"];

const normalizeChainName = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const toDisplayChainName = (key) => {
  const normalized = key.toLowerCase();
  if (normalized === "kam") return "KAM";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

export const KNOWN_CHAIN_NAMES = Object.keys(MARKER_COLORS).map(
  toDisplayChainName,
);

const CHAIN_NAME_BY_LOWER = new Map(
  KNOWN_CHAIN_NAMES.map((name) => [normalizeChainName(name), name]),
);

export const toCanonicalChainName = (name) => {
  if (typeof name !== "string") return null;
  return CHAIN_NAME_BY_LOWER.get(normalizeChainName(name)) ?? null;
};

const parseDefaultVisibleChains = () => {
  const raw = import.meta.env.VITE_DEFAULT_VISIBLE_CHAINS;
  if (!raw) return FALLBACK;

  const requested = raw
    .split(",")
    .map((s) => normalizeChainName(s))
    .filter(Boolean);

  if (requested.length === 0) return FALLBACK;

  const valid = KNOWN_CHAIN_NAMES.filter((name) =>
    requested.includes(normalizeChainName(name)),
  );

  return valid.length > 0 ? valid : FALLBACK;
};

export const DEFAULT_VISIBLE_CHAINS = parseDefaultVisibleChains();
