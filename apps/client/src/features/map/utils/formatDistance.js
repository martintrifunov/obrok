export const formatDistance = (meters) => {
  if (meters == null) return null;
  if (meters < 1000) return `${meters}m`;
  return `${(meters / 1000).toFixed(1)} km`;
};
