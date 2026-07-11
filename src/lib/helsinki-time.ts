const HELSINKI_HOUR = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Helsinki",
  hour: "2-digit",
  hour12: false,
});

/** True when background Tuloslista origin polling is allowed in Finland time. */
export function isTuloslistaPollingWindow(now = new Date()): boolean {
  const hour = Number(HELSINKI_HOUR.format(now));
  return Number.isFinite(hour) && hour >= 9 && hour < 21;
}
