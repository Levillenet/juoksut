/** Stable composite key for an athlete: surname|firstname|organizationId.
 * Must match the format used by the harvester
 * (src/routes/api/public/hooks/harvest-results.ts) so that allocations from
 * the live tuloslista API can be joined against rows in athlete_results. */
export function athleteKey(
  surname: string | null | undefined,
  firstname: string | null | undefined,
  orgId: number | null | undefined,
): string {
  return `${surname ?? ""}|${firstname ?? ""}|${orgId ?? ""}`;
}
