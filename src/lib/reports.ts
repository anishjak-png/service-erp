export type ReportPeriod = "today" | "week" | "month" | "year";

const REPORT_PERIODS: ReportPeriod[] = ["today", "week", "month", "year"];

export function isReportPeriod(value: string): value is ReportPeriod {
  return REPORT_PERIODS.includes(value as ReportPeriod);
}

export function istCalendarDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function istMidnight(isoDate: string) {
  return new Date(`${isoDate}T00:00:00+05:30`);
}

function addCalendarDays(isoDate: string, days: number) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`;
}

/** Shop calendar (IST). Search "today" and dashboard Today use this. */
export function getPeriodRange(period: ReportPeriod) {
  const today = istCalendarDay();
  const tomorrowStart = istMidnight(addCalendarDays(today, 1));

  if (period === "today") {
    return { start: istMidnight(today), end: tomorrowStart };
  }

  if (period === "week") {
    const [y, m, d] = today.split("-").map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
    const monday = addCalendarDays(today, -daysFromMonday);
    return { start: istMidnight(monday), end: tomorrowStart };
  }

  const [year, month] = today.split("-").map(Number);
  if (period === "month") {
    const startIso = `${year}-${pad2(month)}-01`;
    const nextMonth =
      month === 12 ? `${year + 1}-01-01` : `${year}-${pad2(month + 1)}-01`;
    return { start: istMidnight(startIso), end: istMidnight(nextMonth) };
  }

  return {
    start: istMidnight(`${year}-01-01`),
    end: istMidnight(`${year + 1}-01-01`),
  };
}

export function daysAgo(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

export function periodLabel(period: ReportPeriod): string {
  switch (period) {
    case "today":
      return "Today";
    case "week":
      return "This week";
    case "month":
      return "This month";
    case "year":
      return "This year";
  }
}

/**
 * Given status history newest-first, return the status immediately before
 * Delivered (skipping leading Delivered rows). Used to classify return closures.
 */
export function previousStatusBeforeDelivered(
  historyDesc: Array<{ status: string }>
): string | null {
  let i = 0;
  while (i < historyDesc.length && historyDesc[i].status === "Delivered") {
    i += 1;
  }
  return historyDesc[i]?.status ?? null;
}

export function wasDeliveredFromReturn(
  historyDesc: Array<{ status: string }>
): boolean {
  return previousStatusBeforeDelivered(historyDesc) === "Return";
}
