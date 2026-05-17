import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Link2, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  listMyNoteLinks,
  respondNoteLinkInvite,
} from "@/lib/note-links.functions";

export function NoteLinkInvitesBanner() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyNoteLinks);
  const respondFn = useServerFn(respondNoteLinkInvite);

  const query = useQuery({
    queryKey: ["note-links-overview"],
    queryFn: () => listFn(),
  });

  const respond = useMutation({
    mutationFn: (vars: { inviteId: string; accept: boolean }) =>
      respondFn({ data: vars }),
    onSuccess: (_d, vars) => {
      toast.success(vars.accept ? "Linkitys hyväksytty" : "Kutsu hylätty");
      qc.invalidateQueries({ queryKey: ["note-links-overview"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Toiminto epäonnistui"),
  });

  const received = query.data?.receivedInvites ?? [];
  if (received.length === 0) return null;

  return (
    <section className="mb-4 rounded-xl border-2 border-amber-500/60 bg-amber-50 px-4 py-3 dark:bg-amber-950/40">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Link2 className="h-4 w-4 text-amber-700 dark:text-amber-300" />
        Saapuneet linkityspyynnöt ({received.length})
      </div>
      <ul className="space-y-2">
        {received.map((inv) => {
          const busy = respond.isPending && respond.variables?.inviteId === inv.id;
          return (
            <li
              key={inv.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-card px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{inv.inviterLabel}</div>
                {inv.inviterEmail && (
                  <div className="truncate text-xs text-muted-foreground">
                    {inv.inviterEmail}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => respond.mutate({ inviteId: inv.id, accept: true })}
                >
                  {busy && respond.variables?.accept ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-1 h-4 w-4" />
                  )}
                  Hyväksy
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => respond.mutate({ inviteId: inv.id, accept: false })}
                >
                  <X className="mr-1 h-4 w-4" />
                  Hylkää
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 text-right">
        <Link
          to="/settings/note-links"
          className="text-xs font-medium text-primary hover:underline"
        >
          Hallinnoi linkityksiä →
        </Link>
      </div>
    </section>
  );
}
