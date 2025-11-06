const DEFAULT_TIME_ZONE =
  process.env.NEXT_PUBLIC_APP_TIMEZONE ||
  process.env.APP_TIMEZONE ||
  'Australia/Sydney';

type ZonedDateInput = {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
  millisecond?: number;
};

type DayRange = {
  date: string;
  start: string;
  end: string;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

const getFormatter = (timeZone: string) => {
  if (!formatterCache.has(timeZone)) {
    formatterCache.set(
      timeZone,
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    );
  }

  return formatterCache.get(timeZone)!;
};

const getTimeZoneParts = (date: Date, timeZone: string) => {
  const formatter = getFormatter(timeZone);
  const parts = formatter.formatToParts(date);
  const result: Record<string, string> = {};

  for (const part of parts) {
    if (part.type !== 'literal') {
      result[part.type] = part.value;
    }
  }

  return result as {
    year: string;
    month: string;
    day: string;
    hour: string;
    minute: string;
    second: string;
  };
};

const getTimeZoneOffset = (date: Date, timeZone: string) => {
  const parts = getTimeZoneParts(date, timeZone);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  return asUtc - date.getTime();
};

const zonedTimeToUtc = (input: ZonedDateInput, timeZone: string) => {
  const {
    year,
    month,
    day,
    hour = 0,
    minute = 0,
    second = 0,
    millisecond = 0
  } = input;

  const utcDate = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second, millisecond)
  );

  const offset = getTimeZoneOffset(utcDate, timeZone);
  return new Date(utcDate.getTime() - offset);
};

const formatDateString = (parts: {
  year: string;
  month: string;
  day: string;
}) => `${parts.year}-${parts.month}-${parts.day}`;

export const getLocalDayRange = (
  options?: Partial<{ date: Date; timeZone: string }>
): DayRange => {
  const date = options?.date ?? new Date();
  const timeZone = options?.timeZone ?? DEFAULT_TIME_ZONE;
  const parts = getTimeZoneParts(date, timeZone);

  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);

  const start = zonedTimeToUtc(
    { year, month, day, hour: 0, minute: 0, second: 0, millisecond: 0 },
    timeZone
  );
  const end = zonedTimeToUtc(
    { year, month, day, hour: 23, minute: 59, second: 59, millisecond: 999 },
    timeZone
  );

  return {
    date: formatDateString(parts),
    start: start.toISOString(),
    end: end.toISOString()
  };
};

export const getUtcRangeForDate = (
  dateString: string,
  timeZone: string = DEFAULT_TIME_ZONE
) => {
  const [yearRaw, monthRaw, dayRaw] = dateString.split('-').map(Number);

  if (Number.isNaN(yearRaw) || Number.isNaN(monthRaw) || Number.isNaN(dayRaw)) {
    throw new Error(`Invalid date string: ${dateString}`);
  }

  const start = zonedTimeToUtc(
    {
      year: yearRaw,
      month: monthRaw,
      day: dayRaw,
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0
    },
    timeZone
  );
  const end = zonedTimeToUtc(
    {
      year: yearRaw,
      month: monthRaw,
      day: dayRaw,
      hour: 23,
      minute: 59,
      second: 59,
      millisecond: 999
    },
    timeZone
  );

  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
};

export const getDefaultTimeZone = () => DEFAULT_TIME_ZONE;
