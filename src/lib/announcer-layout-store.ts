import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AnnouncerColumnId = "in_progress" | "completed" | "upcoming";
export type AnnouncerView = "combined" | "live" | "planning";

export interface AnnouncerColumnConfig {
  id: AnnouncerColumnId;
  visible: boolean;
  width: number; // fr units, 1-5
}

export interface AnnouncerViewLayout {
  columns: AnnouncerColumnConfig[]; // order = render order
  maxWidth: number; // px, 1000-2400
  columnsPerRow: 1 | 2 | 3;
  // Live-section (Käynnissä) extras
  liveColumns: 1 | 2 | 3;
  liveLimit: 5 | 10;
  liveDefaultOpen: boolean;
}

export type AllSettings = Record<AnnouncerView, AnnouncerViewLayout>;

const STORAGE_KEY = "settings.announcerLayout.v3";
const REMOTE_TABLE = "announcer_settings";

export const COLUMN_LABELS: Record<AnnouncerColumnId, string> = {
  in_progress: "Käynnissä",
  completed: "Lopputulokset",
  upcoming: "Seuraavaksi",
};

export const VIEW_LABELS: Record<AnnouncerView, string> = {
  combined: "Yhdistetty",
  live: "Live",
  planning: "Tulokset",
};

function defaultViewLayout(view: AnnouncerView): AnnouncerViewLayout {
  if (view === "live") {
    return {
      columns: [
        { id: "in_progress", visible: true, width: 1 },
        { id: "completed", visible: false, width: 1 },
        { id: "upcoming", visible: false, width: 1 },
      ],
      maxWidth: 1600,
      columnsPerRow: 1,
      liveColumns: 2,
      liveLimit: 5,
      liveDefaultOpen: true,
    };
  }
  if (view === "planning") {
    return {
      columns: [
        { id: "in_progress", visible: false, width: 1 },
        { id: "upcoming", visible: true, width: 1 },
        { id: "completed", visible: true, width: 1 },
      ],
      maxWidth: 1600,
      columnsPerRow: 2,
      liveColumns: 1,
      liveLimit: 10,
      liveDefaultOpen: false,
    };
  }
  // combined
  return {
    columns: [
      { id: "in_progress", visible: true, width: 1 },
      { id: "completed", visible: true, width: 1 },
      { id: "upcoming", visible: true, width: 1 },
    ],
    maxWidth: 1900,
    columnsPerRow: 3,
    liveColumns: 2,
    liveLimit: 10,
    liveDefaultOpen: false,
  };
}

function defaultAllSettings(): AllSettings {
  return {
    combined: defaultViewLayout("combined"),
    live: defaultViewLayout("live"),
    planning: defaultViewLayout("planning"),
  };
}

function sanitizeView(raw: unknown, view: AnnouncerView): AnnouncerViewLayout {
  const base = defaultViewLayout(view);
  try {
    const obj = (raw ?? {}) as Partial<AnnouncerViewLayout>;
    const ids: AnnouncerColumnId[] = ["in_progress", "completed", "upcoming"];
    const inputCols = Array.isArray(obj.columns) ? obj.columns : [];
    const cols: AnnouncerColumnConfig[] = ids.map((id) => {
      const found = inputCols.find((c) => c?.id === id);
      const baseCol = base.columns.find((c) => c.id === id)!;
      return {
        id,
        visible: typeof found?.visible === "boolean" ? found.visible : baseCol.visible,
        width: Math.min(5, Math.max(1, Number(found?.width) || baseCol.width)),
      };
    });
    const order = inputCols
      .map((c) => c?.id)
      .filter((id): id is AnnouncerColumnId => ids.includes(id as AnnouncerColumnId));
    const ordered = order.length === 3 ? order.map((id) => cols.find((c) => c.id === id)!) : cols;
    const mw = Math.min(2400, Math.max(1000, Number(obj.maxWidth) || base.maxWidth));
    const cpr = (obj.columnsPerRow === 1 || obj.columnsPerRow === 2 || obj.columnsPerRow === 3)
      ? obj.columnsPerRow
      : base.columnsPerRow;
    const lc = (obj.liveColumns === 1 || obj.liveColumns === 2 || obj.liveColumns === 3)
      ? obj.liveColumns
      : base.liveColumns;
    const ll: 5 | 10 = obj.liveLimit === 5 || obj.liveLimit === 10
      ? obj.liveLimit
      : base.liveLimit;
    const ldo = typeof obj.liveDefaultOpen === "boolean" ? obj.liveDefaultOpen : base.liveDefaultOpen;
    return { columns: ordered, maxWidth: mw, columnsPerRow: cpr, liveColumns: lc, liveLimit: ll, liveDefaultOpen: ldo };
  } catch {
    return base;
  }
}

function sanitizeAll(raw: unknown): AllSettings {
  const obj = (raw ?? {}) as Partial<AllSettings>;
  return {
    combined: sanitizeView(obj.combined, "combined"),
    live: sanitizeView(obj.live, "live"),
    planning: sanitizeView(obj.planning, "planning"),
  };
}

type Listener = () => void;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());

let cache: AllSettings | null = null;
let remoteLoaded = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function loadFromStorage(): AllSettings {
  if (typeof window === "undefined") return defaultAllSettings();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultAllSettings();
    return sanitizeAll(JSON.parse(raw));
  } catch {
    return defaultAllSettings();
  }
}

function writeToStorage(next: AllSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

async function pushRemote(next: AllSettings) {
  try {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return;
    await supabase
      .from(REMOTE_TABLE)
      .upsert(
        { user_id: userId, settings: next as never },
        { onConflict: "user_id" },
      );
  } catch {
    /* ignore network errors */
  }
}

function scheduleRemoteSave(next: AllSettings) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void pushRemote(next);
  }, 600);
}

async function pullRemote(): Promise<AllSettings | null> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return null;
    const { data } = await supabase
      .from(REMOTE_TABLE)
      .select("settings")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data?.settings) return null;
    return sanitizeAll(data.settings);
  } catch {
    return null;
  }
}

export function getAllSettings(): AllSettings {
  if (!cache) cache = loadFromStorage();
  return cache;
}

export function getViewLayout(view: AnnouncerView): AnnouncerViewLayout {
  return getAllSettings()[view];
}

export function setViewLayout(view: AnnouncerView, layout: AnnouncerViewLayout) {
  const all = getAllSettings();
  const next: AllSettings = { ...all, [view]: layout };
  cache = next;
  writeToStorage(next);
  scheduleRemoteSave(next);
  emit();
}

export function resetViewLayout(view: AnnouncerView) {
  setViewLayout(view, defaultViewLayout(view));
}

/** One-time sync: pull remote and merge into cache if remote exists. */
async function syncFromRemoteOnce() {
  if (remoteLoaded) return;
  remoteLoaded = true;
  const remote = await pullRemote();
  if (remote) {
    cache = remote;
    writeToStorage(remote);
    emit();
  } else if (cache) {
    // No remote row yet — push current local so it persists for next session.
    void pushRemote(cache);
  }
}

export function useAnnouncerViewLayout(
  view: AnnouncerView,
): [AnnouncerViewLayout, (n: AnnouncerViewLayout) => void] {
  const [value, setValue] = useState<AnnouncerViewLayout>(() => getViewLayout(view));
  useEffect(() => {
    const l = () => setValue(getViewLayout(view));
    listeners.add(l);
    void syncFromRemoteOnce();
    // Re-sync on auth change so settings follow account
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      remoteLoaded = false;
      void syncFromRemoteOnce();
    });
    return () => {
      listeners.delete(l);
      sub.subscription.unsubscribe();
    };
  }, [view]);
  return [value, (n) => setViewLayout(view, n)];
}
