import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { detectRecord, RecordBadge } from "@/lib/records";
import { effectiveRecord } from "@/lib/record-baseline";
import { athleteKey } from "@/lib/athlete-key";
import { useCompetitionId } from "@/lib/competition-store";
import { formatRelayLegs, type Allocation } from "@/lib/tuloslista";

export interface NewResultItem {
  key: string;
  alloc: Allocation;
  eventId: number;
  eventName?: string;
  eventCategory: string;
  ageClass?: string | null;
  heatIndex: number;
  /** 1-based attempt number for field events, if known. */
  attemptIndex?: number | null;
}

interface Props {
  item: NewResultItem | null;
  /** Called once the overlay finishes its full sequence. */
  onDone: () => void;
}

const HOLD_MS = 3400;
const FLY_MS = 700;
const ENTER_MS = 550;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function NewResultOverlay({ item, onDone }: Props) {
  const [phase, setPhase] = useState<"enter" | "fly" | "gone">("gone");
  const [target, setTarget] = useState<{ x: number; y: number; scale: number } | null>(null);

  useEffect(() => {
    if (!item) return;
    setPhase("enter");
    setTarget(null);
    const reduced = prefersReducedMotion();

    const holdTimer = setTimeout(() => {
      // Measure target DOM location.
      const el =
        document.querySelector<HTMLElement>(
          `[data-alloc-id="${item.alloc.AllocId}"]`,
        ) ??
        document.querySelector<HTMLElement>(
          `[data-alloc-id="heat-${item.alloc.AllocId}"]`,
        ) ??
        document.querySelector<HTMLElement>(
          `[data-event-id="${item.eventId}"]`,
        );
      if (el) {
        const rect = el.getBoundingClientRect();
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const tx = rect.left + rect.width / 2 - cx;
        const ty = rect.top + rect.height / 2 - cy;
        const scale = Math.min(rect.width / 360, 0.4);
        setTarget({ x: tx, y: ty, scale: Math.max(0.15, scale) });
      } else {
        setTarget({ x: 0, y: 0, scale: 0.2 });
      }
      setPhase("fly");
    }, reduced ? 800 : ENTER_MS + HOLD_MS);

    const doneTimer = setTimeout(
      () => {
        setPhase("gone");
        onDone();
      },
      reduced ? 1200 : ENTER_MS + HOLD_MS + FLY_MS,
    );

    return () => {
      clearTimeout(holdTimer);
      clearTimeout(doneTimer);
    };
  }, [item, onDone]);

  const [competitionId] = useCompetitionId();
  const isPB = useMemo(() => {
    if (!item) return false;
    const eff = effectiveRecord(item.eventId, item.alloc, {
      competitionId,
      athleteKey: athleteKey(
        item.alloc.Surname,
        item.alloc.Firstname,
        item.alloc.Organization?.Id ?? null,
      ),
      eventName: item.eventName ?? "",
      ageClass: item.ageClass,
      category: item.eventCategory,
    });
    return detectRecord(item.eventCategory, item.alloc.Result ?? null, eff.pb, eff.sb) === "PB";
  }, [item, competitionId]);

  const clapBursts = useMemo(() => {
    if (!item) return [] as Array<{ id: number; angle: number; distance: number; rotate: number; delay: number; scale: number; emoji: string }>;
    const count = isPB ? 18 : 12;
    const emojis = isPB ? ["👏", "🎉", "✨", "👏", "🙌"] : ["👏", "👏", "🙌"];
    return Array.from({ length: count }, (_, i) => {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const distance = 220 + Math.random() * 260;
      return {
        id: i,
        angle,
        distance,
        rotate: (Math.random() - 0.5) * 540,
        delay: Math.random() * 0.25,
        scale: 0.9 + Math.random() * 0.9,
        emoji: emojis[i % emojis.length],
      };
    });
  }, [item, isPB]);

  return (
    <AnimatePresence>
      {item && phase !== "gone" && (
        <motion.div
          key={item.key}
          className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === "fly" ? 0.0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === "fly" ? 0 : 1 }}
            transition={{ duration: 0.3 }}
          />
          {phase === "enter" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              {clapBursts.map((c) => {
                const dx = Math.cos(c.angle) * c.distance;
                const dy = Math.sin(c.angle) * c.distance;
                return (
                  <motion.span
                    key={c.id}
                    className="absolute select-none"
                    style={{ fontSize: "3rem", lineHeight: 1 }}
                    initial={{ x: 0, y: 0, opacity: 0, scale: 0.2, rotate: 0 }}
                    animate={{
                      x: dx,
                      y: dy,
                      opacity: [0, 1, 1, 0],
                      scale: c.scale,
                      rotate: c.rotate,
                    }}
                    transition={{
                      duration: 1.8,
                      delay: c.delay,
                      ease: [0.16, 1, 0.3, 1],
                      times: [0, 0.15, 0.7, 1],
                    }}
                  >
                    {c.emoji}
                  </motion.span>
                );
              })}
            </div>
          )}
          <motion.div
            className={`relative w-[min(90vw,520px)] rounded-3xl border-2 ${
              isPB ? "border-yellow-400" : "border-primary"
            } bg-card px-8 py-6 shadow-[0_30px_80px_-10px_hsl(var(--primary)/0.6)]`}
            initial={{ scale: 0.25, opacity: 0, rotateX: -25 }}
            animate={
              phase === "enter"
                ? { scale: 1.05, opacity: 1, rotateX: 0, x: 0, y: 0 }
                : {
                    scale: target?.scale ?? 0.2,
                    opacity: 0,
                    x: target?.x ?? 0,
                    y: target?.y ?? 0,
                    rotateX: 0,
                  }
            }
            transition={{
              duration: phase === "fly" ? FLY_MS / 1000 : ENTER_MS / 1000,
              ease: phase === "fly" ? [0.7, 0, 0.3, 1] : [0.16, 1, 0.3, 1],
            }}
          >
            {isPB && (
              <motion.div
                className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-yellow-400 px-4 py-1 text-xs font-black uppercase tracking-widest text-black shadow-lg"
                initial={{ scale: 0, rotate: -8 }}
                animate={{ scale: 1, rotate: -4 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 400, damping: 12 }}
              >
                Uusi ennätys!
              </motion.div>
            )}
            <Card item={item} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Card({ item }: { item: NewResultItem }) {
  const [competitionId] = useCompetitionId();
  const a = item.alloc;
  const eff = effectiveRecord(item.eventId, a, {
    competitionId,
    athleteKey: athleteKey(a.Surname, a.Firstname, a.Organization?.Id ?? null),
    eventName: item.eventName ?? "",
  });
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span className="text-xs font-bold uppercase tracking-widest text-primary">
        Uusi tulos{item.eventName ? ` · ${item.eventName}` : ""}
        {item.eventCategory === "Field"
          ? item.attemptIndex
            ? ` · Yritys ${item.attemptIndex}`
            : ""
          : ` · Erä ${item.heatIndex}`}
      </span>
      <h2 className="text-3xl font-black leading-tight">{a.Name}</h2>
      <p className="text-sm text-muted-foreground">
        {a.Organization?.Name ?? a.Organization?.NameShort ?? ""}
      </p>
      {(() => {
        const legs = formatRelayLegs(a);
        return legs ? (
          <p className="text-xs text-muted-foreground">{legs}</p>
        ) : null;
      })()}
      <div className="flex items-baseline gap-3">
        <span className="text-6xl font-black tabular-nums text-foreground">
          {a.Result}
        </span>
        {a.ResultRank != null && (
          <span className="text-2xl font-bold tabular-nums text-muted-foreground">
            {a.ResultRank}.
          </span>
        )}
      </div>
      {a.Result && (
        <RecordBadge
          category={item.eventCategory}
          result={a.Result}
          pb={eff.pb}
          sb={eff.sb}
          size="lg"
        />
      )}
    </div>
  );
}
