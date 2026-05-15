import { Radio, ChevronRight, Check } from "lucide-react";

import { useTodayCompetitions } from "@/lib/competition-list";
import { useCompetitionId } from "@/lib/competition-store";

export function LiveCompetitionsSection() {
  const { list, loading, error } = useTodayCompetitions();
  const [activeId, setActiveId] = useCompetitionId();

  if (loading || error) return null;
  if (list.length === 0) return null;

  return (
    <section className="mb-4 rounded-xl border bg-card shadow-sm">
      <header className="flex items-center gap-2 border-b px-4 py-2.5">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
        </span>
        <Radio className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Käynnissä olevat kisat</h2>
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
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-secondary ${
                  isActive ? "bg-secondary/60" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold leading-tight">
                    {c.Name}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {[c.OrganizationName, c.Location].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {isActive ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
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
