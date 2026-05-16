import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import { WelcomeDialog } from "@/components/WelcomeDialog";
import { trackEvent, type AnalyticsEvent } from "@/lib/analytics";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Juoksulajien lähtöjärjestys" },
      {
        name: "description",
        content:
          "Mobiilioptimoitu toimitsijanäkymä juoksulajien eräjakoihin – tiedot live.tuloslista.com:sta.",
      },
      { name: "author", content: "Toimitsijatyökalu" },
      { property: "og:title", content: "Juoksulajien lähtöjärjestys" },
      {
        property: "og:description",
        content: "Selkeä mobiilinäkymä juoksulajien eriin ja lähtöjärjestyksiin.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Juoksulajien lähtöjärjestys" },
      { name: "description", content: "Race Day Assist provides a streamlined UI for race organizers to manage running events, filtering out non-running disciplines." },
      { property: "og:description", content: "Race Day Assist provides a streamlined UI for race organizers to manage running events, filtering out non-running disciplines." },
      { name: "twitter:description", content: "Race Day Assist provides a streamlined UI for race organizers to manage running events, filtering out non-running disciplines." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/baf7fcb3-39fe-4109-b697-aeb1e1036d70/id-preview-8c6417f7--293ee435-938e-49f8-9f0c-88f8952d582f.lovable.app-1778742309693.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/baf7fcb3-39fe-4109-b697-aeb1e1036d70/id-preview-8c6417f7--293ee435-938e-49f8-9f0c-88f8952d582f.lovable.app-1778742309693.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouteTracker />
        <Outlet />
        <WelcomeDialog />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function eventForPath(path: string): AnalyticsEvent {
  if (path.startsWith("/athlete/")) return "athlete_view";
  if (path.startsWith("/scoreboard")) return "scoreboard_view";
  if (path.startsWith("/announcer")) return "announcer_view";
  if (path.startsWith("/watch")) return "watch_view";
  if (path.startsWith("/search")) return "search_view";
  if (path.startsWith("/season-leaders")) return "season_leaders_view";
  if (path.startsWith("/kilpailukalenteri")) return "calendar_view";
  if (path.startsWith("/round/")) return "round_view";
  if (path.startsWith("/print")) return "print_view";
  if (path.startsWith("/settings")) return "settings_view";
  if (path.startsWith("/running-ops")) return "running_ops_view";
  if (path === "/" || path === "") return "results_view";
  return "page_view";
}

function RouteTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname.startsWith("/admin")) return; // do not log admin views
    // Pages that emit their own enriched event (with metadata) handle tracking themselves
    if (pathname.startsWith("/athlete/")) return;
    if (pathname.startsWith("/round/")) return;
    if (pathname.startsWith("/scoreboard")) return;
    trackEvent(eventForPath(pathname));
  }, [pathname]);
  return null;
}
