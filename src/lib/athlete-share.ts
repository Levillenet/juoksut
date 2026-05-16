import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { AthleteResultRow } from "@/lib/athlete-history";

const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateToken(length = 12): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < length; i++) {
    s += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  }
  return s;
}

function ownerLabelFromUser(
  meta: Record<string, unknown> | undefined,
  email: string | null | undefined,
): string {
  const m = meta ?? {};
  for (const c of [m.first_name, m.firstname, m.given_name, m.full_name, m.name]) {
    if (typeof c === "string" && c.trim()) return c.trim().split(/\s+/)[0];
  }
  if (email) return email.split("@")[0];
  return "Joku";
}

export interface AthleteShareInfo {
  token: string;
  athleteKey: string;
  ownerLabel: string;
  createdAt: string;
}

export interface AthleteShareTarget {
  athleteKey: string;
  surname: string;
  firstname: string;
  organization: string;
  organizationId: number | null;
}

export function useAthleteShare(target: AthleteShareTarget | null) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [share, setShare] = useState<AthleteShareInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId || !target) {
      setShare(null);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("athlete_shares")
      .select("token, athlete_key, owner_label, created_at")
      .eq("user_id", userId)
      .eq("athlete_key", target.athleteKey)
      .is("revoked_at", null)
      .maybeSingle();
    setShare(
      data
        ? {
            token: data.token,
            athleteKey: data.athlete_key,
            ownerLabel: data.owner_label,
            createdAt: data.created_at,
          }
        : null,
    );
    setLoading(false);
  }, [userId, target]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createShare = useCallback(async (): Promise<AthleteShareInfo | null> => {
    if (!userId || !target) return null;
    await refresh();
    const existing = await supabase
      .from("athlete_shares")
      .select("token, athlete_key, owner_label, created_at")
      .eq("user_id", userId)
      .eq("athlete_key", target.athleteKey)
      .is("revoked_at", null)
      .maybeSingle();
    if (existing.data) {
      const info: AthleteShareInfo = {
        token: existing.data.token,
        athleteKey: existing.data.athlete_key,
        ownerLabel: existing.data.owner_label,
        createdAt: existing.data.created_at,
      };
      setShare(info);
      return info;
    }
    const ownerLabel = ownerLabelFromUser(
      user?.user_metadata as Record<string, unknown> | undefined,
      user?.email,
    );
    for (let attempt = 0; attempt < 3; attempt++) {
      const token = generateToken(12);
      const { data, error } = await supabase
        .from("athlete_shares")
        .insert({
          token,
          user_id: userId,
          athlete_key: target.athleteKey,
          surname: target.surname,
          firstname: target.firstname,
          organization: target.organization,
          organization_id: target.organizationId,
          owner_label: ownerLabel,
        })
        .select("token, athlete_key, owner_label, created_at")
        .single();
      if (!error && data) {
        const info: AthleteShareInfo = {
          token: data.token,
          athleteKey: data.athlete_key,
          ownerLabel: data.owner_label,
          createdAt: data.created_at,
        };
        setShare(info);
        return info;
      }
    }
    return null;
  }, [userId, target, user, refresh]);

  const revokeShare = useCallback(async () => {
    if (!userId || !share) return;
    await supabase
      .from("athlete_shares")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token", share.token)
      .eq("user_id", userId);
    setShare(null);
  }, [userId, share]);

  return { share, loading, createShare, revokeShare, refresh };
}

export interface SharedAthleteProfile {
  athleteKey: string;
  surname: string;
  firstname: string;
  organization: string;
  organizationId: number | null;
  ownerLabel: string;
}

export interface SharedAthleteData {
  notFound: boolean;
  revoked: boolean;
  profile: SharedAthleteProfile | null;
  rows: AthleteResultRow[];
}

export async function loadSharedAthlete(token: string): Promise<SharedAthleteData> {
  const profileRes = await supabase.rpc("get_shared_athlete", { p_token: token });
  if (profileRes.error || !profileRes.data || profileRes.data.length === 0) {
    return { notFound: true, revoked: false, profile: null, rows: [] };
  }
  const first = profileRes.data[0];
  if (first.revoked) {
    return {
      notFound: false,
      revoked: true,
      profile: {
        athleteKey: first.athlete_key,
        surname: first.surname,
        firstname: first.firstname,
        organization: first.organization ?? "",
        organizationId: first.organization_id ?? null,
        ownerLabel: first.owner_label ?? "",
      },
      rows: [],
    };
  }
  const resultsRes = await supabase.rpc("get_shared_athlete_results", {
    p_token: token,
  });
  const rows = (resultsRes.data ?? []) as unknown as AthleteResultRow[];
  return {
    notFound: false,
    revoked: false,
    profile: {
      athleteKey: first.athlete_key,
      surname: first.surname,
      firstname: first.firstname,
      organization: first.organization ?? "",
      organizationId: first.organization_id ?? null,
      ownerLabel: first.owner_label ?? "",
    },
    rows,
  };
}
