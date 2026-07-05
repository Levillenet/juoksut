import { Radio, ChevronRight, Check } from "lucide-react";

import { useTodayCompetitions } from "@/lib/competition-list";
import { useCompetitionId } from "@/lib/competition-store";

export function LiveCompetitionsSection() {
  const { list, loading, error } = useTodayCompetitions();
  const [activeId, setActiveId] = useCompetitionId();

  if (loading || error) return null;
  if (list.length === 0) return null;

  const hasActiveCompetition = list.some((c) => c.Id === activeId);

  return (
    <section
      className={`mb-4 overflow-hidden rounded-xl border bg-card shadow-sm transition-colors ${
        hasActiveCompetition ? "border-destructive/50 shadow-md" : ""
      }`}
    >
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <span className="relative flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-2 ring-destructive/35">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-70" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-destructive" />
        </span>
        <Radio className="h-4 w-4 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-extrabold leading-tight">
            Seurannassa oleva kilpailu
          </h2>
          <p className="mt-0.5 text-xs font-medium text-muted-foreground">
            Valitse kilpailu, jota haluat seurata.
          </p>
        </div>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {list.length} kpl
        </span>
      </header>
      <ul className="divide-y">
        {list.map((c) => {
          const isActive = c.Id === activeId;
          return (
            <li key={c.Id}>
              <button
                type="button"
                onClick={() => setActiveId(c.Id)}
                className={`flex w-full items-center gap-3 border-l-4 px-4 py-3 text-left transition-colors ${
                  isActive
                    ? "border-l-destructive bg-destructive/10 hover:bg-destructive/15"
                    : "border-l-transparent hover:border-l-destructive/40 hover:bg-secondary"
                }`}
              >
                <span
                  className={`relative flex shrink-0 items-center justify-center rounded-full ${
                    isActive ? "h-5 w-5 ring-2 ring-destructive/35" : "h-3 w-3"
                  }`}
                  aria-hidden="true"
                >
                  {isActive && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-60" />
                  )}
                  <span
                    className={`relative inline-flex rounded-full ${
                      isActive ? "h-3.5 w-3.5 bg-destructive" : "h-2 w-2 bg-muted-foreground/45"
                    }`}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-sm leading-tight ${
                      isActive ? "font-extrabold text-foreground" : "font-semibold"
                    }`}
                  >
                    {c.Name}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {[c.OrganizationName, c.Location].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {isActive ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-destructive px-2.5 py-1 text-[11px] font-black text-destructive-foreground shadow-sm">
                    <Check className="h-3 w-3" />
                    Seurataan
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-primary">
                    Seuraa
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
