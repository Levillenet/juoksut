import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STORAGE_PREFIX = "welcome.dialog.seen";

interface WelcomeMessage {
  id: string;
  title: string;
  body: string;
  enabled: boolean;
  updated_at: string;
}

export function WelcomeDialog() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);

  const msgQuery = useQuery({
    queryKey: ["welcome-message"],
    enabled: !loading && !!user?.id,
    queryFn: async (): Promise<WelcomeMessage | null> => {
      const { data, error } = await supabase
        .from("welcome_messages")
        .select("id,title,body,enabled,updated_at")
        .eq("singleton", true)
        .maybeSingle();
      if (error) throw error;
      return (data as WelcomeMessage | null) ?? null;
    },
    staleTime: 60_000,
  });

  const msg = msgQuery.data;
  const seenKey =
    user?.id && msg
      ? `${STORAGE_PREFIX}:${user.id}:${msg.id}:${msg.updated_at}`
      : null;

  useEffect(() => {
    if (!msg || !msg.enabled) return;
    if (!seenKey) return;
    if (typeof window === "undefined") return;
    if (!msg.title.trim() && !msg.body.trim()) return;
    try {
      if (localStorage.getItem(seenKey) !== "1") setOpen(true);
    } catch {
      /* ignore */
    }
  }, [msg, seenKey]);

  const handleClose = (next: boolean) => {
    setOpen(next);
    if (!next && seenKey) {
      try {
        localStorage.setItem(seenKey, "1");
      } catch {
        /* ignore */
      }
    }
  };

  if (!msg || !msg.enabled) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{msg.title || "Tiedote"}</DialogTitle>
        </DialogHeader>
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {msg.body}
        </div>
        <DialogFooter>
          <Button onClick={() => handleClose(false)}>Selvä, kiitos!</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
