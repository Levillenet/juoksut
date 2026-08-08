import { Link } from "@tanstack/react-router";

/** Yhteinen välilehtipalkki kilpailun järjestelysivuilla. */
export function OrganizerTabs({
  competitionId,
  active,
}: {
  competitionId: number;
  active: "toimitsijat" | "talkoot";
}) {
  const base =
    "flex-1 rounded-lg px-3 py-2 text-center text-sm font-semibold transition-colors";
  const on = "bg-primary text-primary-foreground";
  const off = "bg-muted text-muted-foreground hover:bg-secondary";
  return (
    <nav className="mt-3 flex gap-2 rounded-xl border bg-card p-1 shadow-sm">
      <Link
        to="/toimitsija/kisa/$competitionId"
        params={{ competitionId: String(competitionId) }}
        className={`${base} ${active === "toimitsijat" ? on : off}`}
      >
        Lajitoimitsijat
      </Link>
      <Link
        to="/toimitsija/talkoot/$competitionId"
        params={{ competitionId: String(competitionId) }}
        className={`${base} ${active === "talkoot" ? on : off}`}
      >
        Talkoot
      </Link>
    </nav>
  );
}
