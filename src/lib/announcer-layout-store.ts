import { useEffect, useState } from "react";

export type AnnouncerColumnId = "in_progress" | "completed" | "upcoming";

export interface AnnouncerColumnConfig {
  id: AnnouncerColumnId;
  visible: boolean;
  width: number; // fr units, 1-5
}

export interface AnnouncerLayout {
  columns: AnnouncerColumnConfig[]; // order is render order
  maxWidth: number; // px, 1000-2400
  columnsPerRow: 2 | 3; // how many columns side by side on desktop
}

const KEY = "settings.announcerLayout.v2";

const DEFAULT_LAYOUT: AnnouncerLayout = {
  columns: [
    { id: "in_progress", visible: true, width: 1 },
    { id: "completed", visible: true, width: 1 },
    { id: "upcoming", visible: true, width: 1 },
  ],
  maxWidth: 1900,
  columnsPerRow: 3,
};

export const COLUMN_LABELS: Record<AnnouncerColumnId, string> = {
  in_progress: "Käynnissä",
  completed: "Lopputulokset",
  upcoming: "Seuraavaksi",
};

type Listener = () => void;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());

function sanitize(raw: unknown): AnnouncerLayout {
  try {
    const obj = raw as Partial<AnnouncerLayout> | null;
    if (!obj || !Array.isArray(obj.columns)) return DEFAULT_LAYOUT;
    const ids: AnnouncerColumnId[] = ["in_progress", "completed", "upcoming"];
    const cols: AnnouncerColumnConfig[] = ids.map((id) => {
      const found = obj.columns!.find((c) => c?.id === id);
      return {
        id,
        visible: found?.visible ?? true,
        width: Math.min(5, Math.max(1, Number(found?.width) || 1)),
      };
    });
    // preserve user-defined order from storage
    const order = obj.columns!
      .map((c) => c?.id)
      .filter((id): id is AnnouncerColumnId => ids.includes(id as AnnouncerColumnId));
    const ordered = order.length === 3 ? order.map((id) => cols.find((c) => c.id === id)!) : cols;
    const mw = Math.min(2400, Math.max(1000, Number(obj.maxWidth) || DEFAULT_LAYOUT.maxWidth));
    const cpr: 2 | 3 = obj.columnsPerRow === 2 ? 2 : 3;
    return { columns: ordered, maxWidth: mw, columnsPerRow: cpr };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function getAnnouncerLayout(): AnnouncerLayout {
  if (typeof window === "undefined") return DEFAULT_LAYOUT;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_LAYOUT;
    return sanitize(JSON.parse(raw));
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function setAnnouncerLayout(next: AnnouncerLayout) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  emit();
}

export function resetAnnouncerLayout() {
  setAnnouncerLayout(DEFAULT_LAYOUT);
}

export function useAnnouncerLayout(): [AnnouncerLayout, (n: AnnouncerLayout) => void] {
  const [value, setValue] = useState<AnnouncerLayout>(() => getAnnouncerLayout());
  useEffect(() => {
    const l = () => setValue(getAnnouncerLayout());
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return [value, setAnnouncerLayout];
}
