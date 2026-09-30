import MARKER_COLORS, { getChainColor } from "@/features/map/config/markerColors";

export const getClusterGradient = (cluster, supercluster) => {
  if (!cluster || !supercluster) return null;

  try {
    const leaves = supercluster.getLeaves(cluster.id, Infinity);
    const chainCountMap = {};

    leaves.forEach((leaf) => {
      const chainName = leaf.properties?.chainName;
      if (!chainName) return;
      const normalizedName = chainName.trim().toLowerCase();
      chainCountMap[normalizedName] =
        (chainCountMap[normalizedName] || 0) + 1;
    });

    const chainNames = Object.keys(chainCountMap).sort();
    if (chainNames.length === 0) return null;

    const chainColors = chainNames.map((chainKey) =>
      getChainColor(chainKey, MARKER_COLORS.vero),
    );

    if (chainColors.length === 1) {
      return chainColors[0];
    }

    const wrappedColors = [...chainColors, chainColors[0]];
    const gradientStops = wrappedColors
      .map((color, idx) => {
        const percentage = (idx / (wrappedColors.length - 1)) * 100;
        return `${color} ${percentage}%`;
      })
      .join(", ");

    return `conic-gradient(from 0deg, ${gradientStops})`;
  } catch {
    return null;
  }
};

export const getMarkerColor = (chainName = "") => {
  return getChainColor(chainName, MARKER_COLORS.vero);
};
