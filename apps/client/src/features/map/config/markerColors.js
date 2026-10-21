const MARKER_COLORS = {
  vero: "crimson",
  ramstore: "#2e7d32",
  stokomak: "#f4c430",
  kam: "#ff5fa2",
};

const normalizeChainKey = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const COLOR_ENTRIES = Object.entries(MARKER_COLORS).map(([key, color]) => ({
  key,
  color,
  normalizedKey: normalizeChainKey(key),
}));

export const getChainColor = (chainName, fallback = MARKER_COLORS.vero) => {
  const normalized = normalizeChainKey(chainName);
  if (!normalized) return fallback;

  const match = COLOR_ENTRIES.find(
    ({ normalizedKey }) =>
      normalized === normalizedKey || normalized.includes(normalizedKey),
  );

  return match?.color ?? fallback;
};

export default MARKER_COLORS;
