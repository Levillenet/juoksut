interface ConfirmedDotProps {
  confirmed: boolean | null | undefined;
  className?: string;
}

/** Pieni vihreä piste joka näytetään kun urheilijan osallistuminen on varmistettu.
 * Renderöi null jos confirmed ei ole true. */
export function ConfirmedDot({ confirmed, className = "" }: ConfirmedDotProps) {
  if (confirmed !== true) return null;
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500 ${className}`}
      aria-label="Osallistuminen varmistettu"
      title="Osallistuminen varmistettu"
    />
  );
}
