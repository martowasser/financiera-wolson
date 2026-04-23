// Business timezone for day-boundary decisions (period close, "today", etc).
// Stored date-only fields (Prisma @db.Date) are always UTC midnight — but
// what "today" means depends on the operator's wall clock, not UTC.
export const BUSINESS_TZ = 'America/Argentina/Buenos_Aires';

// Returns a Date set to UTC midnight of the current business-timezone day.
// Suitable for Prisma @db.Date columns.
export function businessToday(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()).split('-');
  return new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
}

// Normalize an arbitrary Date to UTC midnight of its business-timezone day.
export function toBusinessDate(date: Date): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date).split('-');
  return new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
}
