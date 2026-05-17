import { Star } from "lucide-react";
import { parseResult } from "./result-parse";

export type RecordKind = "PB" | "SB" | null;

/** Parsi tulosteksti vertailtavaksi numeroksi (juoksu: sekunteja, kenttä: metrejä).
 * Käyttää shared parsijaa, joka tunnistaa suomalaiset aikaformaatit. */
export function parsePerf(s: string | null | undefined): number | null {
  return parseResult(s);
}

export function detectRecord(
  category: string,
  result: string | null,
  pb: string,
  sb: string,
): RecordKind {
  const r = parsePerf(result);
  if (r == null) return null;
  const isTrack = category === "Track";
  const better = (a: number, b: number) => (isTrack ? a <= b : a >= b);
  const p = parsePerf(pb);
  if (p != null && better(r, p)) return "PB";
  const s = parsePerf(sb);
  if (s != null && better(r, s)) return "SB";
  return null;
}

/** Returns improvement string like "−0.18 s" / "+0.15 m" / "−1:02.34". */
export function formatImprovement(
  category: string,
  result: string,
  previous: string,
): string | null {
  const r = parsePerf(result);
  const p = parsePerf(previous);
  if (r == null || p == null) return null;
  const isTrack = category === "Track";
  const diff = isTrack ? p - r : r - p;
  if (diff <= 0) return null;
  if (isTrack) {
    if (diff >= 60) {
      const m = Math.floor(diff / 60);
      const s = (diff - m * 60).toFixed(2).replace(".", ",");
      return `−${m}.${s.padStart(5, "0")}`;
    }
    return `−${diff.toFixed(2).replace(".", ",")} s`;
  }
  // Field events: korkeus/seiväs raportoidaan usein pelkkinä sentteinä
  // (esim. "185" = 1,85 m). Jos kummassakaan arvossa ei ole desimaalierotinta,
  // tulokset ovat sentteinä ja parannus näytetään cm:nä.
  const hasDecimal = (s: string) => s.includes(",") || s.includes(".");
  if (!hasDecimal(result) && !hasDecimal(previous)) {
    return `+${Math.round(diff)} cm`;
  }
  return `+${diff.toFixed(2).replace(".", ",")} m`;
}

export function RecordStar({
  kind,
  size = "lg",
}: {
  kind: "PB" | "SB";
  size?: "lg" | "sm";
}) {
  const px = size === "lg" ? 36 : 26;
  const fontClass = size === "lg" ? "text-[10px]" : "text-[8px]";
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: px, height: px }}
      title={kind === "PB" ? "Uusi oma ennätys" : "Uusi kauden ennätys"}
      aria-label={kind === "PB" ? "Uusi oma ennätys" : "Uusi kauden ennätys"}
    >
      <Star
        className="fill-yellow-400 text-yellow-500 drop-shadow-sm"
        size={px}
        strokeWidth={1.5}
      />
      <span className={`absolute font-black text-black ${fontClass}`}>{kind}</span>
    </span>
  );
}

/**
 * Star + improvement caption, e.g. "★PB  −0.18 s (PB 12.52)".
 * Renders nothing if no record.
 */
export function RecordBadge({
  category,
  result,
  pb,
  sb,
  size = "lg",
  layout = "row",
}: {
  category: string;
  result: string | null;
  pb: string;
  sb: string;
  size?: "lg" | "sm";
  /** "row" = star + text inline, "stack" = text below star */
  layout?: "row" | "stack";
}) {
  const kind = detectRecord(category, result, pb, sb);
  if (!kind) return null;
  const previous = kind === "PB" ? pb : sb;
  const improvement =
    result != null ? formatImprovement(category, result, previous) : null;
  const textClass =
    size === "lg" ? "text-[11px] leading-tight" : "text-[10px] leading-tight";
  const wrapClass =
    layout === "stack"
      ? "inline-flex flex-col items-center gap-0.5"
      : "inline-flex items-center gap-1.5";
  return (
    <span className={wrapClass}>
      <RecordStar kind={kind} size={size} />
      {improvement && (
        <span className={`tabular-nums text-muted-foreground ${textClass}`}>
          <span className="font-semibold text-foreground">{improvement}</span>
          {previous && (
            <span className="ml-1">
              ({kind} {previous})
            </span>
          )}
        </span>
      )}
    </span>
  );
}
