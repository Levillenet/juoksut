import { useEffect, useState } from "react";
import { Share2, Copy, Check, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAthleteShare, type AthleteShareTarget } from "@/lib/athlete-share";
import { toast } from "sonner";

interface Props {
  target: AthleteShareTarget | null;
}

export function ShareAthleteButton({ target }: Props) {
  const { share, loading, createShare, revokeShare } = useAthleteShare(target);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  const url =
    share && typeof window !== "undefined"
      ? `${window.location.origin}/urheilija/${share.token}`
      : "";

  const handleCreate = async () => {
    setCreating(true);
    try {
      const info = await createShare();
      if (!info) toast.error("Linkin luonti epäonnistui");
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Linkki kopioitu");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Kopiointi epäonnistui");
    }
  };

  const handleRevoke = async () => {
    await revokeShare();
    toast.success("Jako peruutettu");
  };

  if (!target) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Jaa urheilijakortti">
          <Share2 className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Jaa urheilijan tilastot</DialogTitle>
          <DialogDescription>
            Jaa tästä urheilijakohtaiset tilastot linkkinä. Vastaanottaja näkee
            vain tämän urheilijan tulokset ja ennätykset — ei muuta navigointia.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Ladataan…</p>
        ) : share ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={url}
                className="flex-1 rounded-md border bg-muted/40 px-3 py-2 text-xs"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button
                type="button"
                size="sm"
                onClick={handleCopy}
                aria-label="Kopioi linkki"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRevoke}
              className="w-full"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Peruuta jako
            </Button>
          </div>
        ) : (
          <Button type="button" onClick={handleCreate} disabled={creating}>
            {creating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Share2 className="mr-2 h-4 w-4" />
            )}
            Luo jakolinkki
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
