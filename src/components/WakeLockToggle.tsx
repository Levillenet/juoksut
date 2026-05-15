import { useState } from "react";
import { Monitor, MonitorOff } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { useWakeLock } from "@/hooks/useWakeLock";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  /** Pyydetäänkö lukko automaattisesti kun komponentti mountataan. Oletus: true. */
  defaultEnabled?: boolean;
}

/**
 * Liukukytkin "Pidä näyttö päällä" -toiminnolle.
 * Selain saattaa vaatia käyttäjän eleen ennen kuin lukko myönnetään,
 * joten kytkimen klikkaaminen toimii myös tarvittavana eleenä.
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
        <MonitorOff className="h-3 w-3" />
        Näyttö voi sammua
      </span>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 transition-colors",
        active
          ? "border-amber-400/40 bg-amber-400/15"
          : "border-border bg-background",
        className,
      )}
      title={
        error
          ? `Virhe: ${error}`
          : active
            ? "Näyttö pysyy päällä"
            : "Näyttö voi sammua"
      }
    >
      {active ? (
        <Monitor className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300" />
      ) : (
        <MonitorOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      <span
        className={cn(
          "text-[11px] font-medium",
          active
            ? "text-amber-700 dark:text-amber-300"
            : "text-muted-foreground",
        )}
      >
        {active ? "Päällä" : "Pois"}
      </span>
      <Switch
        checked={enabled}
        onCheckedChange={setEnabled}
        aria-label="Pidä näyttö päällä"
      />
    </div>
  );
}
