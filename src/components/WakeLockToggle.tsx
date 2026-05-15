import { useState } from "react";
import { Sun, Moon } from "lucide-react";

import { useWakeLock } from "@/hooks/useWakeLock";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  /** Pyydetäänkö lukko automaattisesti kun komponentti mountataan. Oletus: true. */
  defaultEnabled?: boolean;
}

/**
 * Pieni toggle-painike "Pidä näyttö päällä" -toiminnolle.
 * Selain saattaa vaatia käyttäjän eleen ennen kuin lukko myönnetään,
 * joten painikkeen klikkaaminen toimii myös tarvittavana eleenä.
 */
export function WakeLockToggle({ className, defaultEnabled = true }: Props) {
  const [enabled, setEnabled] = useState(defaultEnabled);
  const { supported, active, error } = useWakeLock(enabled);

  if (!supported) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-1 text-[11px] text-muted-foreground",
          className,
        )}
        title="Selain ei tue Screen Wake Lock -rajapintaa"
      >
        <Moon className="h-3 w-3" />
        Näyttö voi sammua
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEnabled((v) => !v)}
      title={
        error
          ? `Virhe: ${error}`
          : active
            ? "Näyttö pysyy päällä – klikkaa salliaksesi sammuminen"
            : "Klikkaa pitääksesi näytön päällä"
      }
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
        active
          ? "border-amber-400/40 bg-amber-400/15 text-amber-600 dark:text-amber-300"
          : "border-border bg-background text-muted-foreground hover:bg-secondary",
        className,
      )}
    >
      {active ? (
        <>
          <Sun className="h-3 w-3" />
          Näyttö päällä
        </>
      ) : (
        <>
          <Moon className="h-3 w-3" />
          Näyttö voi sammua
        </>
      )}
    </button>
  );
}
