import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Loader2,
  Mail,
  Plus,
  Trash2,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { acceptTeamInvite, getMyTeamsOverview } from "@/lib/teams.functions";

export const Route = createFileRoute("/settings/teams")({
  head: () => ({
    meta: [
      { title: "Tiimit ja jaetut muistiinpanot" },
      { name: "description", content: "Hallinnoi valmennustiimejä ja jaa muistiinpanoja." },
    ],
  }),
  component: TeamsGate,
});

function TeamsGate() {
  const { role, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Ladataan…
      </div>
    );
  }
  if (!role) return <Navigate to="/login" />;
  return <TeamsPage />;
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Omistaja",
  coach: "Valmentaja",
  member: "Jäsen",
};

function TeamsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fetchOverview = useServerFn(getMyTeamsOverview);
  const acceptFn = useServerFn(acceptTeamInvite);

  const overviewQuery = useQuery({
    queryKey: ["teams-overview"],
    queryFn: () => fetchOverview(),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["teams-overview"] });

  // ---------------- Create team ----------------
  const [newTeamName, setNewTeamName] = useState("");
  const [creating, setCreating] = useState(false);

  const createTeam = async () => {
    const name = newTeamName.trim();
    if (!name || !user) return;
    setCreating(true);
    try {
      const { data: team, error } = await supabase
        .from("teams")
        .insert({ name, created_by: user.id })
        .select("id")
        .single();
      if (error) throw error;
      const { error: memErr } = await supabase
        .from("team_members")
        .insert({ team_id: team.id, user_id: user.id, role: "owner" });
      if (memErr) throw memErr;
      setNewTeamName("");
      toast.success("Tiimi luotu");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tiimin luonti epäonnistui");
    } finally {
      setCreating(false);
    }
  };

  // ---------------- Accept / decline invite ----------------
  const acceptMutation = useMutation({
    mutationFn: async (inviteId: string) => acceptFn({ data: { inviteId } }),
    onSuccess: () => {
      toast.success("Liityit tiimiin");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Hyväksyminen epäonnistui"),
  });

  const declineInvite = async (inviteId: string) => {
    const { error } = await supabase
      .from("team_invites")
      .update({ status: "declined", responded_at: new Date().toISOString() })
      .eq("id", inviteId);
    if (error) toast.error(error.message);
    else {
      toast.success("Kutsu hylätty");
      refresh();
    }
  };

  // ---------------- Per-team actions ----------------
  const leaveTeam = async (teamId: string) => {
    if (!user) return;
    if (!confirm("Haluatko varmasti lähteä tiimistä?")) return;
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("team_id", teamId)
      .eq("user_id", user.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Lähdit tiimistä");
      refresh();
    }
  };

  const removeMember = async (teamId: string, userId: string) => {
    if (!confirm("Poistetaanko jäsen tiimistä?")) return;
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("team_id", teamId)
      .eq("user_id", userId);
    if (error) toast.error(error.message);
    else {
      toast.success("Jäsen poistettu");
      refresh();
    }
  };

  const revokeInvite = async (inviteId: string) => {
    const { error } = await supabase
      .from("team_invites")
      .update({ status: "revoked", responded_at: new Date().toISOString() })
      .eq("id", inviteId);
    if (error) toast.error(error.message);
    else {
      toast.success("Kutsu peruutettu");
      refresh();
    }
  };

  const data = overviewQuery.data;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" asChild aria-label="Takaisin">
            <Link to="/settings">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <Users className="h-5 w-5 text-primary" />
          <h1 className="flex-1 text-base font-semibold">Tiimit ja jaetut muistiinpanot</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        <p className="text-xs text-muted-foreground">
          Luo valmennustiimi ja kutsu mukaan muita käyttäjiä sähköpostilla. Tiimin
          jäsenet näkevät toistensa urheilijakohtaiset muistiinpanot. Muokata voi
          vain omia merkintöjään.
        </p>

        {overviewQuery.isLoading && (
          <p className="py-8 text-center text-sm text-muted-foreground">Ladataan…</p>
        )}

        {/* Received invites */}
        {data && data.receivedInvites.length > 0 && (
          <section className="rounded-xl border border-primary/40 bg-primary/5 p-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold">
              <Mail className="h-4 w-4 text-primary" />
              Sinulle saapuneet kutsut
            </h2>
            <ul className="space-y-2">
              {data.receivedInvites.map((inv) => (
                <li
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{inv.teamName || "Tiimi"}</p>
                    <p className="text-xs text-muted-foreground">
                      Kutsui {inv.invitedByLabel} · rooli: {ROLE_LABEL[inv.role] ?? inv.role}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => acceptMutation.mutate(inv.id)}
                      disabled={acceptMutation.isPending}
                    >
                      {acceptMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Hyväksy"
                      )}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => declineInvite(inv.id)}>
                      Hylkää
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Create team */}
        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold">
            <Plus className="h-4 w-4 text-primary" />
            Luo uusi tiimi
          </h2>
          <div className="flex flex-wrap gap-2">
            <Input
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Esim. Ahkeran heittäjät 2026"
              maxLength={100}
              className="flex-1 min-w-[180px]"
            />
            <Button onClick={createTeam} disabled={creating || !newTeamName.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Luo"}
            </Button>
          </div>
        </section>

        {/* My teams */}
        {data && data.teams.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tiimini ({data.teams.length})
            </h2>
            {data.teams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                myUserId={data.myUserId}
                onChanged={refresh}
                onLeave={() => leaveTeam(team.id)}
                onRemoveMember={(uid) => removeMember(team.id, uid)}
                onRevokeInvite={revokeInvite}
              />
            ))}
          </section>
        ) : data ? (
          <section className="rounded-xl border border-dashed bg-card/50 p-6 text-center text-sm text-muted-foreground">
            Et kuulu vielä yhteenkään tiimiin. Luo uusi tai pyydä kutsu toiselta käyttäjältä.
          </section>
        ) : null}
      </main>
    </div>
  );
}

interface TeamCardProps {
  team: NonNullable<Awaited<ReturnType<typeof getMyTeamsOverview>>>["teams"][number];
  myUserId: string;
  onChanged: () => void;
  onLeave: () => void;
  onRemoveMember: (userId: string) => void;
  onRevokeInvite: (inviteId: string) => void;
}

function TeamCard({ team, myUserId, onChanged, onLeave, onRemoveMember, onRevokeInvite }: TeamCardProps) {
  const isOwner = team.myRole === "owner";
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "coach" | "owner">("member");
  const [sending, setSending] = useState(false);

  const sendInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      toast.error("Anna kelvollinen sähköpostiosoite");
      return;
    }
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Ei sisäänkirjautunutta käyttäjää");
      const { error } = await supabase.from("team_invites").insert({
        team_id: team.id,
        invited_by: user.id,
        email,
        role: inviteRole,
      });
      if (error) throw error;
      setInviteEmail("");
      toast.success("Kutsu lähetetty");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kutsun lähetys epäonnistui");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="truncate text-base font-bold">{team.name}</h3>
        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground">
          {ROLE_LABEL[team.myRole] ?? team.myRole}
        </span>
      </div>

      <div>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Jäsenet ({team.members.length})
        </h4>
        <ul className="space-y-1">
          {team.members.map((m) => (
            <li
              key={m.userId}
              className="flex items-center justify-between gap-2 rounded-md border bg-background/50 px-2 py-1.5 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {m.label}
                  {m.userId === myUserId && (
                    <span className="ml-1 text-[10px] text-muted-foreground">(sinä)</span>
                  )}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {m.email ?? ""} · {ROLE_LABEL[m.role] ?? m.role}
                </p>
              </div>
              {isOwner && m.userId !== myUserId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onRemoveMember(m.userId)}
                  aria-label="Poista jäsen"
                >
                  <UserMinus className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {team.pendingInvites.length > 0 && (
        <div className="mt-3">
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Odottavat kutsut
          </h4>
          <ul className="space-y-1">
            {team.pendingInvites.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between gap-2 rounded-md border bg-background/50 px-2 py-1.5 text-xs"
              >
                <span className="truncate">
                  {inv.email}{" "}
                  <span className="text-muted-foreground">· {ROLE_LABEL[inv.role] ?? inv.role}</span>
                </span>
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onRevokeInvite(inv.id)}
                    aria-label="Peruuta kutsu"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isOwner && (
        <div className="mt-3 border-t pt-3">
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Kutsu uusi jäsen
          </h4>
          <div className="flex flex-wrap gap-2">
            <Input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="sahkoposti@esimerkki.fi"
              className="flex-1 min-w-[160px]"
            />
            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as typeof inviteRole)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Jäsen</SelectItem>
                <SelectItem value="coach">Valmentaja</SelectItem>
                <SelectItem value="owner">Omistaja</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={sendInvite} disabled={sending || !inviteEmail.trim()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kutsu"}
            </Button>
          </div>
        </div>
      )}

      <div className="mt-3 flex justify-end border-t pt-3">
        {isOwner ? (
          <p className="text-[11px] text-muted-foreground">
            Omistajana et voi lähteä tiimistä — voit poistaa sen kokonaan tarvittaessa.
          </p>
        ) : (
          <Button variant="ghost" size="sm" onClick={onLeave}>
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Lähde tiimistä
          </Button>
        )}
      </div>
    </div>
  );
}
