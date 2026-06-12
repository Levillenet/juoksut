import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth, type Role } from "@/lib/auth";

interface Props {
  allow: Role[];
  children: ReactNode;
}

const ANNOUNCER_ALLOWLIST = new Set<string>([
  "matti.hannikainen.84@gmail.com",
]);

export function RequireRole({ allow, children }: Props) {
  const { role, user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Ladataan…
      </div>
    );
  }
  if (!role) return <Navigate to="/login" />;
  const email = (user?.email ?? "").toLowerCase();
  const isAdmin = email === "samiaavikko@gmail.com";
  const isAnnouncerAllowed =
    ANNOUNCER_ALLOWLIST.has(email) && allow.includes("official");
  if (!allow.includes(role) && !isAdmin && !isAnnouncerAllowed) {
    return <Navigate to="/" />;
  }
  return <>{children}</>;
}
