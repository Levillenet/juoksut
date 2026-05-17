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

function normalizePair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** Send a link invite by email. */
export const inviteNoteLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ email: z.string().email().max(255) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId, claims } = context;
    const email = data.email.trim().toLowerCase();
    const ownEmail = String(claims?.email ?? "").toLowerCase();
    if (email === ownEmail) throw new Error("Et voi linkittää tiliä itsesi kanssa.");

    // If the other user already exists and there's already an active link, error
    const { data: otherUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    const other = otherUsers?.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (other) {
      const [a, b] = normalizePair(userId, other.id);
      const { data: existingLink } = await supabaseAdmin
        .from("note_links")
        .select("id")
        .eq("user_a_id", a)
        .eq("user_b_id", b)
        .maybeSingle();
      if (existingLink) throw new Error("Tilit ovat jo linkitettyjä.");
    }

    const { error } = await supabaseAdmin
      .from("note_link_invites")
      .insert({ inviter_user_id: userId, email, status: "pending" });
    if (error) {
      if (error.code === "23505") throw new Error("Kutsu on jo lähetetty tälle sähköpostille.");
      throw error;
    }
    return { ok: true };
  });

/** Recipient accepts/declines an invite. */
export const respondNoteLinkInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ inviteId: z.string().uuid(), accept: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId, claims } = context;
    const jwtEmail = String(claims?.email ?? "").toLowerCase();
    if (!jwtEmail) throw new Error("Sähköpostiosoite puuttuu istunnosta.");

    const { data: invite, error: invErr } = await supabaseAdmin
      .from("note_link_invites")
      .select("id, inviter_user_id, email, status")
      .eq("id", data.inviteId)
      .maybeSingle();
    if (invErr) throw invErr;
    if (!invite) throw new Error("Kutsua ei löytynyt.");
    if (invite.status !== "pending") throw new Error("Kutsu ei ole enää avoinna.");
    if (invite.email.toLowerCase() !== jwtEmail) throw new Error("Tämä kutsu ei ole sinulle.");

    if (!data.accept) {
      const { error } = await supabaseAdmin
        .from("note_link_invites")
        .update({ status: "declined", responded_at: new Date().toISOString() })
        .eq("id", invite.id);
      if (error) throw error;
      return { ok: true, linked: false };
    }

    const [a, b] = normalizePair(userId, invite.inviter_user_id);
    const { error: linkErr } = await supabaseAdmin
      .from("note_links")
      .upsert(
        { user_a_id: a, user_b_id: b },
        { onConflict: "user_a_id,user_b_id", ignoreDuplicates: true },
      );
    if (linkErr) throw linkErr;

    const { error: updErr } = await supabaseAdmin
      .from("note_link_invites")
      .update({ status: "accepted", responded_at: new Date().toISOString() })
      .eq("id", invite.id);
    if (updErr) throw updErr;

    return { ok: true, linked: true };
  });

/** Inviter revokes a pending invite. */
export const revokeNoteLinkInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ inviteId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { error } = await supabaseAdmin
      .from("note_link_invites")
      .update({ status: "revoked", responded_at: new Date().toISOString() })
      .eq("id", data.inviteId)
      .eq("inviter_user_id", userId);
    if (error) throw error;
    return { ok: true };
  });

/** Either party removes an active link. */
export const removeNoteLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ linkId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: link, error: getErr } = await supabaseAdmin
      .from("note_links")
      .select("id, user_a_id, user_b_id")
      .eq("id", data.linkId)
      .maybeSingle();
    if (getErr) throw getErr;
    if (!link) throw new Error("Linkitystä ei löytynyt.");
    if (link.user_a_id !== userId && link.user_b_id !== userId) {
      throw new Error("Et voi poistaa tätä linkitystä.");
    }
    const { error } = await supabaseAdmin.from("note_links").delete().eq("id", data.linkId);
    if (error) throw error;
    return { ok: true };
  });

/** List my active links + pending invites (sent + received). */
export const listMyNoteLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, claims } = context;
    const jwtEmail = String(claims?.email ?? "").toLowerCase();

    const [{ data: links }, { data: sent }, { data: received }] = await Promise.all([
      supabaseAdmin
        .from("note_links")
        .select("id, user_a_id, user_b_id, created_at")
        .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`),
      supabaseAdmin
        .from("note_link_invites")
        .select("id, email, status, created_at")
        .eq("inviter_user_id", userId)
        .eq("status", "pending"),
      jwtEmail
        ? supabaseAdmin
            .from("note_link_invites")
            .select("id, inviter_user_id, email, status, created_at")
            .eq("status", "pending")
            .ilike("email", jwtEmail)
        : Promise.resolve({ data: [] as Array<{ id: string; inviter_user_id: string; email: string; status: string; created_at: string }> }),
    ]);

    const otherIds = new Set<string>();
    for (const l of links ?? []) {
      otherIds.add(l.user_a_id === userId ? l.user_b_id : l.user_a_id);
    }
    for (const r of received ?? []) otherIds.add(r.inviter_user_id);

    const labels: Record<string, { label: string; email: string | null }> = {};
    for (const id of otherIds) {
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

    return {
      myUserId: userId,
      activeLinks: (links ?? []).map((l) => {
        const otherId = l.user_a_id === userId ? l.user_b_id : l.user_a_id;
        return {
          id: l.id,
          otherUserId: otherId,
          otherLabel: labels[otherId]?.label ?? "Käyttäjä",
          otherEmail: labels[otherId]?.email ?? null,
          createdAt: l.created_at,
        };
      }),
      sentInvites: (sent ?? []).map((i) => ({
        id: i.id,
        email: i.email,
        createdAt: i.created_at,
      })),
      receivedInvites: (received ?? []).map((i) => ({
        id: i.id,
        inviterUserId: i.inviter_user_id,
        inviterLabel: labels[i.inviter_user_id]?.label ?? "Käyttäjä",
        inviterEmail: labels[i.inviter_user_id]?.email ?? null,
        createdAt: i.created_at,
      })),
    };
  });
