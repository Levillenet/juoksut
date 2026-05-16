import { useEffect, useState } from "react";
import { ChevronUp, ChevronDown, EyeOff, Eye, Radio } from "lucide-react";
import {
  markTickerRead,
  setTickerEnabled,
  useTickerStore,
  type TickerMessage,
} from "@/lib/ticker-store";

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function LiveTicker() {
  const { messages, enabled, lastReadAt, unreadCount } = useTickerStore();
  const [expanded, setExpanded] = useState(false);
  const latest = messages[0];

  // Animate latest message by keying it.
  const latestKey = latest?.id ?? "empty";

  useEffect(() => {
    if (expanded) markTickerRead();
  }, [expanded, messages.length]);

  if (!enabled) {
    return (
      <button
        onClick={() => setTickerEnabled(true)}
        className="fixed bottom-3 right-3 z-40 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold shadow-lg hover:bg-secondary"
        aria-label="Näytä live ticker"
      >
        <Eye className="h-3.5 w-3.5" />
        Näytä live ticker
        {unreadCount > 0 && (
          <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-primary-foreground">
            {unreadCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <>
      {/* History panel (slides up from the bar) */}
      {expanded && (
        <div className="fixed inset-x-0 bottom-11 z-40 border-t border-border bg-card/95 backdrop-blur animate-fade-in">
          <div className="mx-auto max-h-[40vh] max-w-[1600px] overflow-y-auto px-4 py-3">
            {messages.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Ei viestejä vielä.
              </p>
            ) : (
              <ol className="space-y-1.5">
                {messages.map((m) => (
                  <MessageRow key={m.id} m={m} unread={m.timestamp > lastReadAt} />
                ))}
              </ol>
            )}
          </div>
        </div>
      )}

      {/* The bar itself */}
      <div className="fixed inset-x-0 bottom-0 z-50 h-11 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-full max-w-[1600px] items-center gap-2 px-3 sm:px-4">
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-primary">
            <Radio className="h-3 w-3 animate-pulse" />
            Live
          </span>

          <div className="relative min-w-0 flex-1 overflow-hidden">
            {latest ? (
              <div
                key={latestKey}
                className="flex animate-fade-in items-center gap-2 text-sm"
              >
                <span className="shrink-0 text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {formatTime(latest.timestamp)}
                </span>
                <p className="truncate font-medium">{latest.text}</p>
              </div>
            ) : (
              <p className="truncate text-xs text-muted-foreground">
                Odotetaan kenttälajien kärkimuutoksia…
              </p>
            )}
          </div>

          <button
            onClick={() => {
              setExpanded((v) => !v);
              if (!expanded) markTickerRead();
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-semibold hover:bg-secondary"
            aria-label={expanded ? "Sulje historia" : "Avaa historia"}
          >
            {messages.length}
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
            {!expanded && unreadCount > 0 && (
              <span className="rounded-full bg-primary px-1 text-[9px] font-bold leading-4 text-primary-foreground">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setTickerEnabled(false)}
            className="inline-flex shrink-0 items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Piilota ticker"
            title="Piilota ticker"
          >
            <EyeOff className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}

function MessageRow({ m, unread }: { m: TickerMessage; unread: boolean }) {
  return (
    <li
      className={`flex items-start gap-2 rounded-md px-2 py-1.5 text-sm ${
        unread ? "bg-primary/10" : "bg-muted/40"
      }`}
    >
      <span className="shrink-0 text-[10px] font-semibold tabular-nums text-muted-foreground">
        {formatTime(m.timestamp)}
      </span>
      <p className="min-w-0 flex-1 leading-snug">{m.text}</p>
      {unread && (
        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
      )}
    </li>
  );
}
