export const isManualPrice = (marketProduct) =>
  marketProduct.lastSeenAt === null;

export const marketLabel = (market) =>
  market
    ? `${market.name}${market.chain?.name ? ` (${market.chain.name})` : ""}`
    : "Unknown market";
