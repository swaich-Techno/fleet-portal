import {
  REGULAR_END_MINUTES,
  REGULAR_START_MINUTES
} from "./constants";

const FALLBACK_HOURLY_TECHS = new Set(["Ali", "Victor"]);

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function roundToTwo(value) {
  return Number(value.toFixed(2));
}

function intervalMinutes(start, end) {
  return Math.max(end - start, 0);
}

function overlapMinutes(start, end, rangeStart, rangeEnd) {
  return Math.max(Math.min(end, rangeEnd) - Math.max(start, rangeStart), 0);
}

function clampToDay(value) {
  return Math.max(0, Math.min(value, 24 * 60));
}

function nthWeekdayOfMonth(year, monthIndex, weekday, occurrence) {
  const firstDay = new Date(year, monthIndex, 1);
  const offset = (7 + weekday - firstDay.getDay()) % 7;
  return new Date(year, monthIndex, 1 + offset + (occurrence - 1) * 7);
}

function lastWeekdayOfMonth(year, monthIndex, weekday) {
  const lastDay = new Date(year, monthIndex + 1, 0);
  const offset = (7 + lastDay.getDay() - weekday) % 7;
  return new Date(year, monthIndex, lastDay.getDate() - offset);
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}

function observedHoliday(year, monthIndex, day, name) {
  const actualDate = new Date(year, monthIndex, day);

  if (actualDate.getDay() === 6) {
    actualDate.setDate(actualDate.getDate() - 1);
  } else if (actualDate.getDay() === 0) {
    actualDate.setDate(actualDate.getDate() + 1);
  }

  return { key: dateKey(actualDate), name };
}

const holidayCache = new Map();

function getHolidayMap(year) {
  if (holidayCache.has(year)) {
    return holidayCache.get(year);
  }

  const holidays = {};
  const addHoliday = ({ key, name }) => {
    holidays[key] = name;
  };
  const addDynamicHoliday = (date, name) => {
    holidays[dateKey(date)] = name;
  };

  addHoliday(observedHoliday(year, 0, 1, "New Year's Day"));
  addDynamicHoliday(nthWeekdayOfMonth(year, 0, 1, 3), "Martin Luther King Jr. Day");
  addDynamicHoliday(nthWeekdayOfMonth(year, 1, 1, 3), "Washington's Birthday");
  addDynamicHoliday(lastWeekdayOfMonth(year, 4, 1), "Memorial Day");
  addHoliday(observedHoliday(year, 5, 19, "Juneteenth"));
  addHoliday(observedHoliday(year, 6, 4, "Independence Day"));
  addDynamicHoliday(nthWeekdayOfMonth(year, 8, 1, 1), "Labor Day");
  addDynamicHoliday(nthWeekdayOfMonth(year, 9, 1, 2), "Columbus Day");
  addHoliday(observedHoliday(year, 10, 11, "Veterans Day"));
  addDynamicHoliday(nthWeekdayOfMonth(year, 10, 4, 4), "Thanksgiving Day");
  addHoliday(observedHoliday(year, 11, 25, "Christmas Day"));

  holidayCache.set(year, holidays);
  return holidays;
}

export function parseDateParts(dateString = "") {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  return {
    year,
    month,
    day,
    date: new Date(year, month - 1, day)
  };
}

export function normalizeTime(value = "") {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return "";
  }

  const match = /^(\d{1,2}):(\d{2})/.exec(trimmed);

  if (!match) {
    return "";
  }

  return `${pad(Number(match[1]))}:${match[2]}`;
}

export function parseTimeToMinutes(value = "") {
  const normalized = normalizeTime(value);

  if (!normalized) {
    return null;
  }

  const [hours, minutes] = normalized.split(":").map(Number);
  return hours * 60 + minutes;
}

export function inferPayType(technicianName = "") {
  return FALLBACK_HOURLY_TECHS.has(technicianName) ? "hourly" : "salary";
}

export function getHolidayName(dateString) {
  const parsedDate = parseDateParts(dateString);

  if (!parsedDate) {
    return null;
  }

  return (
    getHolidayMap(parsedDate.year)[dateString] ||
    getHolidayMap(parsedDate.year + 1)[dateString] ||
    null
  );
}

function calculateTravelAfterMinutes(start, end, isAfterOnlyDay) {
  const normalizedStart = clampToDay(start);
  const normalizedEnd = clampToDay(end);
  const totalMinutes = intervalMinutes(normalizedStart, normalizedEnd);

  if (totalMinutes <= 0) {
    return 0;
  }

  if (isAfterOnlyDay) {
    return totalMinutes;
  }

  const regularMinutes = overlapMinutes(
    normalizedStart,
    normalizedEnd,
    REGULAR_START_MINUTES,
    REGULAR_END_MINUTES
  );

  return totalMinutes - regularMinutes;
}

export function normalizeJob(job = {}) {
  const technicianName = job.technicianName || job.technician || "";

  return {
    id: String(job._id || job.id || ""),
    technicianId: job.technicianId ? String(job.technicianId) : "",
    technicianName,
    payType: job.payType || inferPayType(technicianName),
    date: job.date || "",
    customer: job.customer || "",
    issue: job.issue || "",
    location: job.location || "",
    dispatchTime: normalizeTime(job.dispatchTime),
    arrivalTime: normalizeTime(job.arrivalTime),
    finishedTime: normalizeTime(job.finishedTime),
    etaToHours: toNumber(job.etaToHours ?? job.etaToHr),
    etaToMinutes: toNumber(job.etaToMinutes ?? job.etaToMin),
    etaFromHours: toNumber(job.etaFromHours ?? job.etaFromHr),
    etaFromMinutes: toNumber(job.etaFromMinutes ?? job.etaFromMin),
    etaFromDestination:
      job.etaFromDestination === "next_job" || job.destination === "Next Job"
        ? "next_job"
        : "home",
    createdById: job.createdById ? String(job.createdById) : "",
    createdByName: job.createdByName || "",
    createdByUsername: job.createdByUsername || "",
    createdAt: job.createdAt || null,
    updatedAt: job.updatedAt || null
  };
}

export function calculateJobBreakdown(jobInput, sameDayCount = 1) {
  const job = normalizeJob(jobInput);
  const arrivalMinutes = parseTimeToMinutes(job.arrivalTime);
  const finishedMinutes = parseTimeToMinutes(job.finishedTime);

  if (
    arrivalMinutes === null ||
    finishedMinutes === null ||
    finishedMinutes <= arrivalMinutes
  ) {
    return {
      regularMinutes: 0,
      afterMinutes: 0,
      regularHours: 0,
      afterHours: 0,
      totalHours: 0,
      singleJobDay: sameDayCount === 1,
      isSunday: false,
      holidayName: null
    };
  }

  const parsedDate = parseDateParts(job.date);
  const holidayName = getHolidayName(job.date);
  const isSunday = parsedDate ? parsedDate.date.getDay() === 0 : false;
  const isAfterOnlyDay = Boolean(isSunday || holidayName);
  const singleJobDay = sameDayCount === 1;

  const jobMinutes = intervalMinutes(arrivalMinutes, finishedMinutes);
  let regularMinutes = 0;
  let afterMinutes = 0;

  if (isAfterOnlyDay) {
    afterMinutes += jobMinutes;
  } else if (singleJobDay) {
    regularMinutes += jobMinutes;
  } else {
    const regularWindowMinutes = overlapMinutes(
      arrivalMinutes,
      finishedMinutes,
      REGULAR_START_MINUTES,
      REGULAR_END_MINUTES
    );

    regularMinutes += regularWindowMinutes;
    afterMinutes += jobMinutes - regularWindowMinutes;
  }

  const etaToMinutes = toNumber(job.etaToHours) * 60 + toNumber(job.etaToMinutes);
  const etaFromMinutes =
    toNumber(job.etaFromHours) * 60 + toNumber(job.etaFromMinutes);

  if (etaToMinutes > 0) {
    afterMinutes += calculateTravelAfterMinutes(
      arrivalMinutes - etaToMinutes,
      arrivalMinutes,
      isAfterOnlyDay
    );
  }

  if (etaFromMinutes > 0) {
    afterMinutes += calculateTravelAfterMinutes(
      finishedMinutes,
      finishedMinutes + etaFromMinutes,
      isAfterOnlyDay
    );
  }

  return {
    regularMinutes,
    afterMinutes,
    regularHours: roundToTwo(regularMinutes / 60),
    afterHours: roundToTwo(afterMinutes / 60),
    totalHours: roundToTwo((regularMinutes + afterMinutes) / 60),
    singleJobDay,
    isSunday,
    holidayName
  };
}

export function enrichJobsWithPayroll(rawJobs = []) {
  const jobs = rawJobs.map(normalizeJob);
  const dailyCounts = {};

  jobs.forEach((job) => {
    const key = `${job.technicianName}::${job.date}`;
    dailyCounts[key] = (dailyCounts[key] || 0) + 1;
  });

  return jobs.map((job) => ({
    ...job,
    payroll: calculateJobBreakdown(
      job,
      dailyCounts[`${job.technicianName}::${job.date}`] || 1
    )
  }));
}

export function buildPayrollSummary(rawJobs = [], technicians = []) {
  const jobs =
    rawJobs.length > 0 && rawJobs[0]?.payroll ? rawJobs : enrichJobsWithPayroll(rawJobs);
  const summaryMap = {};

  technicians.forEach((technician, index) => {
    summaryMap[technician.name] = {
      name: technician.name,
      payType: technician.payType || inferPayType(technician.name),
      active: technician.active !== false,
      sortOrder: technician.sortOrder ?? index,
      regularHours: 0,
      afterHours: 0,
      totalHours: 0,
      jobCount: 0
    };
  });

  jobs.forEach((job) => {
    if (!job.technicianName) {
      return;
    }

    if (!summaryMap[job.technicianName]) {
      summaryMap[job.technicianName] = {
        name: job.technicianName,
        payType: job.payType || inferPayType(job.technicianName),
        active: true,
        sortOrder: 999,
        regularHours: 0,
        afterHours: 0,
        totalHours: 0,
        jobCount: 0
      };
    }

    const current = summaryMap[job.technicianName];
    current.regularHours = roundToTwo(current.regularHours + job.payroll.regularHours);
    current.afterHours = roundToTwo(current.afterHours + job.payroll.afterHours);
    current.totalHours = roundToTwo(current.totalHours + job.payroll.totalHours);
    current.jobCount += 1;
  });

  return Object.values(summaryMap).sort((left, right) => {
    if ((left.sortOrder ?? 999) !== (right.sortOrder ?? 999)) {
      return (left.sortOrder ?? 999) - (right.sortOrder ?? 999);
    }

    return left.name.localeCompare(right.name);
  });
}

export function formatHours(value) {
  return Number(value || 0).toFixed(2);
}
