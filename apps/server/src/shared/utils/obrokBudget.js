const DAILY_ALLOWANCE = 140;
const FULL_WEEK_DAYS = 6; // Monday through Saturday
const FULL_WEEK_BUDGET = DAILY_ALLOWANCE * FULL_WEEK_DAYS;

const dayOfWeekIndex = (date) => {
  const d = date.getDay();
  return d === 0 ? 7 : d;
};

const isMonSat = (date) => {
  const dow = dayOfWeekIndex(date);
  return dow >= 1 && dow <= 6;
};

const startOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getMondayOfWeek = (date) => {
  const d = startOfDay(date);
  const dow = dayOfWeekIndex(d);
  d.setDate(d.getDate() - (dow - 1));
  return d;
};

const getSaturdayOfWeek = (date) => {
  const mon = getMondayOfWeek(date);
  mon.setDate(mon.getDate() + 5);
  return mon;
};

const countHolidaysInRange = (start, end, holidays) => {
  let count = 0;
  for (const h of holidays) {
    const hd = startOfDay(new Date(h));
    if (hd >= start && hd <= end && isMonSat(hd)) {
      count++;
    }
  }
  return count;
};

const daysInRange = (start, end) => {
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    if (isMonSat(d)) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
};

export const calculateWeeklyBudget = (referenceDate, holidays = []) => {
  const ref = startOfDay(new Date(referenceDate));
  const monday = getMondayOfWeek(ref);
  const saturday = getSaturdayOfWeek(ref);

  const monthOfMonday = monday.getMonth();
  const monthOfSaturday = saturday.getMonth();

  if (monthOfMonday === monthOfSaturday) {
    const holidayCount = countHolidaysInRange(monday, saturday, holidays);
    const workDays = FULL_WEEK_DAYS - holidayCount;
    return {
      budget: workDays * DAILY_ALLOWANCE,
      workDays,
      holidays: holidayCount,
      segments: null,
    };
  }

  const lastDayOfOldMonth = new Date(
    monday.getFullYear(),
    monthOfMonday + 1,
    0,
  );
  const firstDayOfNewMonth = new Date(
    saturday.getFullYear(),
    monthOfSaturday,
    1,
  );

  const seg1Days = daysInRange(monday, lastDayOfOldMonth);
  const seg1Holidays = countHolidaysInRange(monday, lastDayOfOldMonth, holidays);
  const seg1Work = seg1Days - seg1Holidays;

  const seg2Days = daysInRange(firstDayOfNewMonth, saturday);
  const seg2Holidays = countHolidaysInRange(firstDayOfNewMonth, saturday, holidays);
  const seg2Work = seg2Days - seg2Holidays;

  const totalWork = seg1Work + seg2Work;

  return {
    budget: totalWork * DAILY_ALLOWANCE,
    workDays: totalWork,
    holidays: seg1Holidays + seg2Holidays,
    segments: [
      { days: seg1Work, budget: seg1Work * DAILY_ALLOWANCE },
      { days: seg2Work, budget: seg2Work * DAILY_ALLOWANCE },
    ],
  };
};

export { DAILY_ALLOWANCE, FULL_WEEK_BUDGET };
