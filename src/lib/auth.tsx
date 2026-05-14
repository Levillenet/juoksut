import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const OFFICIAL_PASSWORD = "ahkera2026";
const OFFICIAL_KEY = "tuloslista.official";

export type Role = "official" | "user" | null;

interface AuthState {
  user: User | null;
  session: Session | null;
  isOfficial: boolean;
  role: Role;
  loading: boolean;
  signInOfficial: (password: string) => boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isOfficial, setIsOfficial] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Read official flag once
    try {
      setIsOfficial(localStorage.getItem(OFFICIAL_KEY) === "1");
    } catch {
      /* ignore */
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setUser(data.session?.user ?? null);
      })
      .catch((err) => {
        console.error("getSession failed", err);
      })
      .finally(() => {
        setLoading(false);
      });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signInOfficial = (password: string) => {
    if (password !== OFFICIAL_PASSWORD) return false;
    try {
      localStorage.setItem(OFFICIAL_KEY, "1");
    } catch {
      /* ignore */
    }
    setIsOfficial(true);
    return true;
  };

  const signOut = async () => {
    try {
      localStorage.removeItem(OFFICIAL_KEY);
    } catch {
      /* ignore */
    }
    setIsOfficial(false);
    await supabase.auth.signOut();
  };

  // Personal user takes precedence (Google/email logged in → "user" view)
  // Official-only when no personal session
  const role: Role = user ? "user" : isOfficial ? "official" : null;

  return (
    <Ctx.Provider
      value={{ user, session, isOfficial, role, loading, signInOfficial, signOut }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
