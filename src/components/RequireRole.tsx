import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth, type Role } from "@/lib/auth";

interface Props {
  allow: Role[];
  children: ReactNode;
}

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
  const isAdmin = (user?.email ?? "").toLowerCase() === "samiaavikko@gmail.com";
  if (!allow.includes(role) && !isAdmin) return <Navigate to="/" />;
  return <>{children}</>;
}
