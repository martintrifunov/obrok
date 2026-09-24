// Scraper-owned rows carry a lastSeenAt stamp and are overwritten on the next scrape,
// so only hand-added rows (explicit null) are editable.
export const isManualPrice = (marketProduct) => marketProduct.lastSeenAt === null;
