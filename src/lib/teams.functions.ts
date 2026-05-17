import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function labelFromAuthUser(u: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): string {
  const m = u.user_metadata ?? {};
  for (const c of [m.full_name, m.name, m.first_name, m.firstname, m.given_name]) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  if (u.email) return u.email.split("@")[0];
  return "Käyttäjä";
}

/**
 * Accept a team invite. Validates that the recipient email matches the JWT email,
 * then creates the team_members row via admin client (bypasses owner-only RLS).
 */
export const acceptTeamInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ inviteId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId, claims } = context;
    const jwtEmail = String(claims?.email ?? "").toLowerCase();
    if (!jwtEmail) throw new Error("Sähköpostiosoite puuttuu istunnosta.");

    const { data: invite, error: invErr } = await supabaseAdmin
      .from("team_invites")
      .select("id, team_id, email, role, status")
      .eq("id", data.inviteId)
      .maybeSingle();
    if (invErr) throw invErr;
    if (!invite) throw new Error("Kutsua ei löytynyt.");
    if (invite.status !== "pending") throw new Error("Kutsu ei ole enää avoinna.");
    if (invite.email.toLowerCase() !== jwtEmail) {
      throw new Error("Tämä kutsu ei ole sinulle.");
    }

    const { error: memErr } = await supabaseAdmin
      .from("team_members")
      .upsert(
        { team_id: invite.team_id, user_id: userId, role: invite.role },
        { onConflict: "team_id,user_id", ignoreDuplicates: true },
      );
    if (memErr) throw memErr;

    const { error: updErr } = await supabaseAdmin
      .from("team_invites")
      .update({ status: "accepted", responded_at: new Date().toISOString() })
      .eq("id", invite.id);
    if (updErr) throw updErr;

    return { ok: true, teamId: invite.team_id };
  });

/**
 * Get display labels (name + email) for a set of user IDs.
 * Only returns labels for users that share at least one team with the caller —
 * so this cannot be used to enumerate arbitrary users.
 */
export const getTeammateLabels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ userIds: z.array(z.string().uuid()).max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (data.userIds.length === 0) {
      return { labels: [] as Array<{ userId: string; label: string; email: string | null }> };
    }

    const { data: shared, error: shErr } = await supabaseAdmin.rpc(
      "shared_note_owner_ids",
      { _user: userId },
    );
    if (shErr) throw shErr;
    const allowed = new Set<string>((shared ?? []).map((r: { shared_note_owner_ids: string } | string) =>
      typeof r === "string" ? r : r.shared_note_owner_ids,
    ));

    const requested = data.userIds.filter((id) => allowed.has(id));
    if (requested.length === 0) return { labels: [] };

    const labels: Array<{ userId: string; label: string; email: string | null }> = [];
    for (const id of requested) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
      if (u?.user) {
        labels.push({
          userId: id,
          label: labelFromAuthUser({
            email: u.user.email,
            user_metadata: u.user.user_metadata as Record<string, unknown>,
          }),
          email: u.user.email ?? null,
        });
      }
    }
    return { labels };
  });

/** List my teams with members + my pending invites (sent + received). */
export const getMyTeamsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, claims } = context;
    const jwtEmail = String(claims?.email ?? "").toLowerCase();

    // Teams I'm a member of
    const { data: myMemberships } = await supabaseAdmin
      .from("team_members")
      .select("team_id, role")
      .eq("user_id", userId);

    const teamIds = (myMemberships ?? []).map((m) => m.team_id);

    const [{ data: teams }, { data: allMembers }, { data: sentInvites }, { data: receivedInvites }] =
      await Promise.all([
        teamIds.length
          ? supabaseAdmin.from("teams").select("id, name, created_by, created_at").in("id", teamIds)
          : Promise.resolve({ data: [] as Array<{ id: string; name: string; created_by: string; created_at: string }> }),
        teamIds.length
          ? supabaseAdmin.from("team_members").select("team_id, user_id, role, joined_at").in("team_id", teamIds)
          : Promise.resolve({ data: [] as Array<{ team_id: string; user_id: string; role: string; joined_at: string }> }),
        teamIds.length
          ? supabaseAdmin
              .from("team_invites")
              .select("id, team_id, email, role, status, created_at")
              .in("team_id", teamIds)
              .eq("status", "pending")
          : Promise.resolve({ data: [] as Array<{ id: string; team_id: string; email: string; role: string; status: string; created_at: string }> }),
        jwtEmail
          ? supabaseAdmin
              .from("team_invites")
              .select("id, team_id, email, role, status, invited_by, created_at")
              .eq("status", "pending")
              .ilike("email", jwtEmail)
          : Promise.resolve({ data: [] as Array<{ id: string; team_id: string; email: string; role: string; status: string; invited_by: string; created_at: string }> }),
      ]);

    // Collect all user ids whose labels we need: members + inviters of received invites
    const userIdSet = new Set<string>();
    for (const m of allMembers ?? []) userIdSet.add(m.user_id);
    for (const inv of receivedInvites ?? []) userIdSet.add(inv.invited_by);

    const labels: Record<string, { label: string; email: string | null }> = {};
    for (const id of userIdSet) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
      if (u?.user) {
        labels[id] = {
          label: labelFromAuthUser({
            email: u.user.email,
            user_metadata: u.user.user_metadata as Record<string, unknown>,
          }),
          email: u.user.email ?? null,
        };
      }
    }

    // Fetch team names for received invites (teams I'm not in yet)
    const extraTeamIds = (receivedInvites ?? [])
      .map((i) => i.team_id)
      .filter((id) => !teamIds.includes(id));
    let extraTeams: Array<{ id: string; name: string }> = [];
    if (extraTeamIds.length) {
      const { data } = await supabaseAdmin
        .from("teams")
        .select("id, name")
        .in("id", extraTeamIds);
      extraTeams = data ?? [];
    }

    return {
      myUserId: userId,
      teams: (teams ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        createdBy: t.created_by,
        createdAt: t.created_at,
        myRole: (myMemberships ?? []).find((m) => m.team_id === t.id)?.role ?? "member",
        members: (allMembers ?? [])
          .filter((m) => m.team_id === t.id)
          .map((m) => ({
            userId: m.user_id,
            role: m.role,
            joinedAt: m.joined_at,
            label: labels[m.user_id]?.label ?? "Käyttäjä",
            email: labels[m.user_id]?.email ?? null,
          })),
        pendingInvites: (sentInvites ?? [])
          .filter((i) => i.team_id === t.id)
          .map((i) => ({ id: i.id, email: i.email, role: i.role, createdAt: i.created_at })),
      })),
      receivedInvites: (receivedInvites ?? []).map((i) => ({
        id: i.id,
        teamId: i.team_id,
        teamName: extraTeams.find((t) => t.id === i.team_id)?.name
          ?? (teams ?? []).find((t) => t.id === i.team_id)?.name
          ?? "",
        role: i.role,
        invitedBy: i.invited_by,
        invitedByLabel: labels[i.invited_by]?.label ?? "Käyttäjä",
        createdAt: i.created_at,
      })),
    };
  });
