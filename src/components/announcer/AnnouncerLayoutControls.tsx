import { Settings2, RotateCcw, ArrowUp, ArrowDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  COLUMN_LABELS,
  resetViewLayout,
  useAnnouncerViewLayout,
  type AnnouncerColumnId,
  type AnnouncerView,
} from "@/lib/announcer-layout-store";

interface Props {
  view: AnnouncerView;
  /** Show "Sarakkeita rinnakkain" picker. Hide on single-section views (live). */
  showColumnsPerRow?: boolean;
  /** Show live-section controls (columns 1-3, top N, default open). */
  showLiveControls?: boolean;
}

export function AnnouncerLayoutControls({
  view,
  showColumnsPerRow = true,
  showLiveControls = false,
}: Props) {
  const [layout, setLayout] = useAnnouncerViewLayout(view);

  const toggleVisible = (id: AnnouncerColumnId) => {
    setLayout({
      ...layout,
      columns: layout.columns.map((c) =>
        c.id === id ? { ...c, visible: !c.visible } : c,
      ),
    });
  };

  const setWidth = (id: AnnouncerColumnId, w: number) => {
    setLayout({
      ...layout,
      columns: layout.columns.map((c) => (c.id === id ? { ...c, width: w } : c)),
    });
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...layout.columns];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setLayout({ ...layout, columns: next });
  };

  const visibleCount = layout.columns.filter((c) => c.visible).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          Asettelu
          <span className="text-xs text-muted-foreground">
            ({visibleCount} {visibleCount === 1 ? "osio" : "osiota"})
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] max-h-[80vh] overflow-y-auto">
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Osiot ja leveydet</h3>
              <button
                onClick={() => resetViewLayout(view)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3" />
                Palauta
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Asetukset tallentuvat käyttäjätilillesi ja seuraavat sinua laitteille.
            </p>
          </div>

          <div className="space-y-3">
            {layout.columns.map((col, idx) => (
              <div key={col.id} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Checkbox
                      checked={col.visible}
                      onCheckedChange={() => toggleVisible(col.id)}
                    />
                    {COLUMN_LABELS[col.id]}
                  </label>
                  <div className="flex gap-1">
                    <button
                      onClick={() => move(idx, -1)}
                      disabled={idx === 0}
                      className="rounded p-1 hover:bg-secondary disabled:opacity-30"
                      aria-label="Siirrä ylöspäin"
                    >
                      <ArrowUp className="h-3 w-3 -rotate-90" />
                    </button>
                    <button
                      onClick={() => move(idx, 1)}
                      disabled={idx === layout.columns.length - 1}
                      className="rounded p-1 hover:bg-secondary disabled:opacity-30"
                      aria-label="Siirrä alaspäin"
                    >
                      <ArrowDown className="h-3 w-3 -rotate-90" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="w-14 text-xs text-muted-foreground">Leveys</span>
                  <Slider
                    value={[col.width]}
                    min={1}
                    max={5}
                    step={1}
                    onValueChange={(v) => setWidth(col.id, v[0] ?? 1)}
                    disabled={!col.visible}
                    className="flex-1"
                  />
                  <span className="w-6 text-right text-xs tabular-nums">{col.width}</span>
                </div>
              </div>
            ))}
          </div>

          {showColumnsPerRow && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">Osioita rinnakkain</span>
              </div>
              <div className="flex gap-1 rounded-full border border-border bg-card p-1 text-xs font-medium">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    onClick={() =>
                      setLayout({ ...layout, columnsPerRow: n as 1 | 2 | 3 })
                    }
                    className={`flex-1 rounded-full px-3 py-1.5 transition-colors ${
                      layout.columnsPerRow === n
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Ylimääräiset osiot siirtyvät alemmaksi uudelle riville.
              </p>
            </div>
          )}

          {showLiveControls && (
            <div className="space-y-3 rounded-md border border-primary/40 bg-primary/5 p-3">
              <h4 className="text-sm font-semibold">Käynnissä-lajien näyttö</h4>

              <div>
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  Lajeja rinnakkain
                </span>
                <div className="flex gap-1 rounded-full border border-border bg-card p-1 text-xs font-medium">
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      onClick={() =>
                        setLayout({ ...layout, liveColumns: n as 1 | 2 | 3 })
                      }
                      className={`flex-1 rounded-full px-3 py-1.5 transition-colors ${
                        layout.liveColumns === n
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  Tuloksia per laji
                </span>
                <div className="flex gap-1 rounded-full border border-border bg-card p-1 text-xs font-medium">
                  {([5, 10, "all"] as const).map((n) => (
                    <button
                      key={String(n)}
                      onClick={() => setLayout({ ...layout, liveLimit: n })}
                      className={`flex-1 rounded-full px-3 py-1.5 transition-colors ${
                        layout.liveLimit === n
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      {n === "all" ? "Kaikki" : `Top ${n}`}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center justify-between gap-2 text-sm">
                <span>Avaa kaikki oletuksena</span>
                <Checkbox
                  checked={layout.liveDefaultOpen}
                  onCheckedChange={(v) =>
                    setLayout({ ...layout, liveDefaultOpen: v === true })
                  }
                />
              </label>
            </div>
          )}

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium">Sivun maksimileveys</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {layout.maxWidth}px
              </span>
            </div>
            <Slider
              value={[layout.maxWidth]}
              min={1000}
              max={2400}
              step={50}
              onValueChange={(v) => setLayout({ ...layout, maxWidth: v[0] ?? 1900 })}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
