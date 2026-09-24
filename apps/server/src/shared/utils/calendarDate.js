export const APP_TIME_ZONE = "Europe/Skopje";

const ymdFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Today's calendar date in Skopje as a local-midnight Date, independent of the
 * server's TZ (the container runs in UTC, which is 1-2h behind Skopje).
 * @param {Date} [now]
 * @returns {Date}
 */
export const todayInAppTimeZone = (now = new Date()) => {
  const [y, m, d] = ymdFormatter.format(now).split("-").map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Holiday dates are stored as UTC midnight (z.coerce.date on "YYYY-MM-DD").
 * Converts one to a local-midnight Date for the same calendar day.
 * @param {Date} date
 * @returns {Date}
 */
export const utcDateToLocalCalendarDate = (date) =>
  new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

/**
 * UTC bounds covering the given local calendar days, inclusive, for querying
 * UTC-midnight date fields.
 * @param {Date} startDay
 * @param {Date} endDay
 * @returns {{ from: Date, to: Date }}
 */
export const utcRangeForCalendarDays = (startDay, endDay) => ({
  from: new Date(Date.UTC(startDay.getFullYear(), startDay.getMonth(), startDay.getDate())),
  to: new Date(
    Date.UTC(endDay.getFullYear(), endDay.getMonth(), endDay.getDate(), 23, 59, 59, 999),
  ),
});
