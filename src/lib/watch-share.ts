import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

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
  const candidates = [
    m.first_name,
    m.firstname,
    m.given_name,
    m.full_name,
    m.name,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) {
      return c.trim().split(/\s+/)[0];
    }
  }
  if (email) return email.split("@")[0];
  return "Joku";
}

export interface WatchShareInfo {
  token: string;
  competitionId: number;
  ownerLabel: string;
  createdAt: string;
}

export function useWatchShare(competitionId: number | null) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [share, setShare] = useState<WatchShareInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId || competitionId == null) {
      setShare(null);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("watch_shares")
      .select("token, competition_id, owner_label, created_at")
      .eq("user_id", userId)
      .eq("competition_id", competitionId)
      .is("revoked_at", null)
      .maybeSingle();
    if (data) {
      setShare({
        token: data.token,
        competitionId: data.competition_id,
        ownerLabel: data.owner_label,
        createdAt: data.created_at,
      });
    } else {
      setShare(null);
    }
    setLoading(false);
  }, [userId, competitionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createShare = useCallback(async (): Promise<WatchShareInfo | null> => {
    if (!userId || competitionId == null) return null;
    // Reuse existing if any
    await refresh();
    const existing = await supabase
      .from("watch_shares")
      .select("token, competition_id, owner_label, created_at")
      .eq("user_id", userId)
      .eq("competition_id", competitionId)
      .is("revoked_at", null)
      .maybeSingle();
    if (existing.data) {
      const info: WatchShareInfo = {
        token: existing.data.token,
        competitionId: existing.data.competition_id,
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
    // Try a couple of times in case of collision (extremely unlikely).
    for (let attempt = 0; attempt < 3; attempt++) {
      const token = generateToken(12);
      const { data, error } = await supabase
        .from("watch_shares")
        .insert({
          token,
          user_id: userId,
          competition_id: competitionId,
          owner_label: ownerLabel,
        })
        .select("token, competition_id, owner_label, created_at")
        .single();
      if (!error && data) {
        const info: WatchShareInfo = {
          token: data.token,
          competitionId: data.competition_id,
          ownerLabel: data.owner_label,
          createdAt: data.created_at,
        };
        setShare(info);
        return info;
      }
    }
    return null;
  }, [userId, competitionId, user, refresh]);

  const revokeShare = useCallback(async () => {
    if (!userId || !share) return;
    await supabase
      .from("watch_shares")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token", share.token)
      .eq("user_id", userId);
    setShare(null);
  }, [userId, share]);

  return { share, loading, createShare, revokeShare, refresh };
}

export interface SharedWatchAthlete {
  key: string;
  surname: string;
  firstname: string;
  organization: string;
  organizationId: number | null;
}

export interface SharedWatchData {
  revoked: boolean;
  notFound: boolean;
  competitionId: number | null;
  ownerLabel: string;
  athletes: SharedWatchAthlete[];
}

export async function loadSharedWatch(token: string): Promise<SharedWatchData> {
  const { data, error } = await supabase.rpc("get_shared_watch", {
    p_token: token,
  });
  if (error || !data || data.length === 0) {
    return {
      revoked: false,
      notFound: true,
      competitionId: null,
      ownerLabel: "",
      athletes: [],
    };
  }
  const first = data[0];
  if (first.revoked) {
    return {
      revoked: true,
      notFound: false,
      competitionId: first.competition_id,
      ownerLabel: first.owner_label,
      athletes: [],
    };
  }
  const athletes: SharedWatchAthlete[] = data
    .filter((r) => r.athlete_key)
    .map((r) => ({
      key: r.athlete_key as string,
      surname: r.surname as string,
      firstname: r.firstname as string,
      organization: (r.organization as string) ?? "",
      organizationId: (r.organization_id as number | null) ?? null,
    }));
  return {
    revoked: false,
    notFound: false,
    competitionId: first.competition_id,
    ownerLabel: first.owner_label,
    athletes,
  };
}
