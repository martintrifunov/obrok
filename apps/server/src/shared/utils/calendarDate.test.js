import { describe, it, expect } from "vitest";
import {
  todayInAppTimeZone,
  utcDateToLocalCalendarDate,
  utcRangeForCalendarDays,
} from "./calendarDate.js";

const ymd = (d) => [d.getFullYear(), d.getMonth() + 1, d.getDate()];

describe("todayInAppTimeZone", () => {
  it("is already Monday in Skopje while UTC is still Sunday (summer time)", () => {
    // 2026-09-27 is a Sunday; 23:30Z is 01:30 Monday in Skopje (UTC+2).
    expect(ymd(todayInAppTimeZone(new Date("2026-09-27T23:30:00Z")))).toEqual([2026, 9, 28]);
  });

  it("is already Monday in Skopje while UTC is still Sunday (winter time)", () => {
    // 2026-10-25 is a Sunday; 23:30Z is 00:30 Monday in Skopje (UTC+1).
    expect(ymd(todayInAppTimeZone(new Date("2026-10-25T23:30:00Z")))).toEqual([2026, 10, 26]);
  });

  it("returns local midnight", () => {
    const d = todayInAppTimeZone(new Date("2026-09-24T12:00:00Z"));
    expect([d.getHours(), d.getMinutes()]).toEqual([0, 0]);
  });
});

describe("utcDateToLocalCalendarDate", () => {
  it("keeps the calendar day of a UTC-midnight holiday", () => {
    expect(ymd(utcDateToLocalCalendarDate(new Date("2026-10-03T00:00:00Z")))).toEqual([
      2026, 10, 3,
    ]);
  });
});

describe("utcRangeForCalendarDays", () => {
  it("covers Saturday's UTC-midnight holiday", () => {
    const { from, to } = utcRangeForCalendarDays(new Date(2026, 8, 28), new Date(2026, 9, 3));
    const saturdayHoliday = new Date("2026-10-03T00:00:00Z");

    expect(from.toISOString()).toBe("2026-09-28T00:00:00.000Z");
    expect(saturdayHoliday >= from && saturdayHoliday <= to).toBe(true);
    expect(to.toISOString()).toBe("2026-10-03T23:59:59.999Z");
  });
});
