Fix the "Seuran urheilijat tänään muissa kisoissa" feature on the homepage so it does not show empty when the only competitions today are the one being followed.

### Problem
When a user follows a competition (e.g. YAG) and that is the only competition with results today, the `excludeCompetitionId` filter removes all clubs → the dropdown shows "Ei seuroja tänään" even though there are results in the database.

### Solution
Modify `src/components/ClubTodaySection.tsx` so that when the excluded-clubs query returns empty for today, the component falls back to fetching clubs WITHOUT the exclusion and shows all results. The title changes from "muissa kisoissa" to just "Seuran urheilijat tänään" in this fallback mode.

### Changes
1. Add `showingAll` state that activates when `clubsQuery` returns empty but there IS an `excludeCompetitionId` and it is today.
2. Add a fallback `useQuery` that fetches all clubs (no exclusion) — enabled only when primary query is done and empty.
3. Update `resultsQuery` to use the same fallback logic (pass `undefined` instead of `excludeCompetitionId` when `showingAll`).
4. Update the section title to drop "muissa kisoissa" when `showingAll` is true.
5. Update dropdown loading/empty states to account for the fallback query.

No backend changes needed — this is purely a frontend presentation fix.