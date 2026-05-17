import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Link2, Loader2, Mail, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import {
  inviteNoteLink,
  listMyNoteLinks,
  removeNoteLink,
  respondNoteLinkInvite,
  revokeNoteLinkInvite,
} from "@/lib/note-links.functions";

export const Route = createFileRoute("/settings/note-links")({
  head: () => ({
    meta: [
      { title: "Muistiinpanojen jakaminen" },
      {
        name: "description",
        content: "Linkitä tilejä ja jaa urheilijakohtaiset muistiinpanot ristiin.",
      },
    ],
  }),
  component: Gate,
});

function Gate() {
  const { role, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Ladataan…
      </div>
    );
  }
  if (!role) return <Navigate to="/login" />;
  return <NoteLinksPage />;
}

function NoteLinksPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyNoteLinks);
  const inviteFn = useServerFn(inviteNoteLink);
  const respondFn = useServerFn(respondNoteLinkInvite);
  const revokeFn = useServerFn(revokeNoteLinkInvite);
  const removeFn = useServerFn(removeNoteLink);

  const query = useQuery({
    queryKey: ["note-links-overview"],
    queryFn: () => listFn(),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["note-links-overview"] });

  const [email, setEmail] = useState("");

  const inviteMutation = useMutation({
    mutationFn: async () => inviteFn({ data: { email: email.trim().toLowerCase() } }),
    onSuccess: () => {
      toast.success("Linkityspyyntö lähetetty");
      setEmail("");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Lähetys epäonnistui"),
  });

  const respondMutation = useMutation({
    mutationFn: async (p: { inviteId: string; accept: boolean }) =>
      respondFn({ data: p }),
    onSuccess: (_d, p) => {
      toast.success(p.accept ? "Tilit linkitetty" : "Pyyntö hylätty");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Toiminto epäonnistui"),
  });

  const revokeMutation = useMutation({
    mutationFn: async (inviteId: string) => revokeFn({ data: { inviteId } }),
    onSuccess: () => {
      toast.success("Pyyntö peruutettu");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Peruutus epäonnistui"),
  });

  const removeMutation = useMutation({
    mutationFn: async (linkId: string) => removeFn({ data: { linkId } }),
    onSuccess: () => {
      toast.success("Linkitys purettu");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Purku epäonnistui"),
  });

  const data = query.data;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" asChild aria-label="Takaisin">
            <Link to="/settings">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <Link2 className="h-5 w-5 text-primary" />
          <h1 className="flex-1 text-base font-semibold">Muistiinpanojen jakaminen</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        <p className="text-xs text-muted-foreground">
          Linkitä tilisi toisen käyttäjän kanssa sähköpostilla. Kun molemmat
          ovat hyväksyneet linkityksen, näette toistenne urheilijakohtaiset
          muistiinpanot. Omistaja näkyy aina muistiinpanon yhteydessä, ja vain
          omia merkintöjä voi muokata. Tämä on kevyt 1-1-jako tiimien
          ulkopuolelle.
        </p>

        {query.isLoading && (
          <p className="py-8 text-center text-sm text-muted-foreground">Ladataan…</p>
        )}

        {/* Received */}
        {data && data.receivedInvites.length > 0 && (
          <section className="rounded-xl border border-primary/40 bg-primary/5 p-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold">
              <Mail className="h-4 w-4 text-primary" />
              Sinulle saapuneet pyynnöt
            </h2>
            <ul className="space-y-2">
              {data.receivedInvites.map((inv) => (
                <li
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{inv.inviterLabel}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {inv.inviterEmail ?? ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        respondMutation.mutate({ inviteId: inv.id, accept: true })
                      }
                      disabled={respondMutation.isPending}
                    >
                      Hyväksy
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        respondMutation.mutate({ inviteId: inv.id, accept: false })
                      }
                      disabled={respondMutation.isPending}
                    >
                      Hylkää
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Send invite */}
        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-bold">Linkitä uusi tili</h2>
          <div className="flex flex-wrap gap-2">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sahkoposti@esimerkki.fi"
              className="flex-1 min-w-[180px]"
            />
            <Button
              onClick={() => inviteMutation.mutate()}
              disabled={inviteMutation.isPending || !email.trim()}
            >
              {inviteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Lähetä pyyntö"
              )}
            </Button>
          </div>
        </section>

        {/* Sent invites */}
        {data && data.sentInvites.length > 0 && (
          <section className="rounded-xl border bg-card p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-bold">Lähettämäsi pyynnöt</h2>
            <ul className="space-y-1">
              {data.sentInvites.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between gap-2 rounded-md border bg-background/50 px-2 py-1.5 text-sm"
                >
                  <span className="truncate">{inv.email}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => revokeMutation.mutate(inv.id)}
                    aria-label="Peruuta pyyntö"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Active links */}
        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-bold">
            Aktiiviset linkitykset {data ? `(${data.activeLinks.length})` : ""}
          </h2>
          {data && data.activeLinks.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Ei vielä aktiivisia linkityksiä.
            </p>
          )}
          <ul className="space-y-1">
            {data?.activeLinks.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between gap-2 rounded-md border bg-background/50 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{l.otherLabel}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {l.otherEmail ?? ""}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm("Puretaanko linkitys?")) removeMutation.mutate(l.id);
                  }}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Pura
                </Button>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
