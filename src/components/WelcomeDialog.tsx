import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STORAGE_PREFIX = "welcome.dialog.seen.v3-yag";

export function WelcomeDialog() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading || !user?.id) return;
    if (typeof window === "undefined") return;
    try {
      const key = `${STORAGE_PREFIX}:${user.id}`;
      if (localStorage.getItem(key) !== "1") setOpen(true);
    } catch {
      /* ignore */
    }
  }, [loading, user?.id]);

  const handleClose = (next: boolean) => {
    setOpen(next);
    if (!next && user?.id) {
      try {
        localStorage.setItem(`${STORAGE_PREFIX}:${user.id}`, "1");
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Uutta: YAG Calling-aikataulu</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm leading-relaxed text-foreground">
          <p>
            YAG Espoo 2026 -kisaan on nyt saatavilla oma <strong>calling-aikataulu</strong>,
            joka kertoo milloin urheilijoiden tulee olla calling roomissa.
          </p>
          <p>
            Aikataulun löydät <strong>Kilpailun aikataulu</strong> -valikon yläreunan{" "}
            <strong>YAG</strong>-välilehdeltä.
          </p>
          <p>Voit valita näkymäksi joko:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Seurannassa</strong> — omat seurattavat urheilijasi</li>
            <li><strong>Oma seura</strong> — kaikki valitun seuran urheilijat</li>
          </ul>
          <p>
            Aikataulun saa myös ladattua kätevästi PDF-tiedostona tulostusta varten.
          </p>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Link
            to="/print/yag-calling"
            onClick={() => handleClose(false)}
            className="text-xs text-primary underline-offset-2 hover:underline"
          >
            Avaa YAG calling-aikataulu →
          </Link>
          <Button onClick={() => handleClose(false)}>Selvä, kiitos!</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
