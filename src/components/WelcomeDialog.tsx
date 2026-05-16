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
import { AboutServiceContent } from "@/components/AboutServiceContent";

const STORAGE_PREFIX = "welcome.dialog.seen.v2";

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
          <DialogTitle>Tärkeää tietoa palvelusta</DialogTitle>
        </DialogHeader>
        <AboutServiceContent />
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Link
            to="/tietoa-palvelusta"
            onClick={() => handleClose(false)}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Avaa erillisellä sivulla
          </Link>
          <Button onClick={() => handleClose(false)}>Selvä, kiitos!</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
