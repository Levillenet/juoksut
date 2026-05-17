import { useSyncExternalStore } from "react";

export type TickerSource = "announcer" | "watched";

export interface TickerMessage {
  id: string;
  text: string;
  timestamp: number;
  eventId: number;
  eventName: string;
  source: TickerSource;
}

const MAX_MESSAGES = 50;

const enabledKey = (s: TickerSource) => `ticker.${s}.enabled`;
const lastReadKey = (s: TickerSource) => `ticker.${s}.lastReadAt`;

function readEnabled(s: TickerSource): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = localStorage.getItem(enabledKey(s));
    return v === null ? true : v === "1";
  } catch {
    return true;
  }
}

function readLastRead(s: TickerSource): number {
  if (typeof window === "undefined") return 0;
  try {
    const v = localStorage.getItem(lastReadKey(s));
    return v ? parseInt(v, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

interface State {
  messages: TickerMessage[];
  enabled: Record<TickerSource, boolean>;
  lastReadAt: Record<TickerSource, number>;
}

const MESSAGES_KEY = "ticker.messages";

function readMessages(): TickerMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MESSAGES_KEY);
    if (!raw) return [];
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.slice(0, MAX_MESSAGES) : [];
  } catch {
    return [];
  }
}

function writeMessages(messages: TickerMessage[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
  } catch {
    /* ignore */
  }
}

let state: State = {
  messages: readMessages(),
  enabled: {
    announcer: readEnabled("announcer"),
    watched: readEnabled("watched"),
  },
  lastReadAt: {
    announcer: readLastRead("announcer"),
    watched: readLastRead("watched"),
  },
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => state;

export function pushTickerMessage(
  msg: Omit<TickerMessage, "id" | "timestamp">,
) {
  const previous = state.messages.find(
    (m) => m.source === msg.source && m.eventId === msg.eventId && m.text === msg.text,
  );
  const full: TickerMessage = {
    ...msg,
    id:
      previous?.id ??
      `${msg.source}-${msg.eventId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
  };
  const nextMessages = [
    full,
    ...state.messages.filter((m) => m.id !== full.id),
  ].slice(0, MAX_MESSAGES);
  state = { ...state, messages: nextMessages };
  writeMessages(nextMessages);
  emit();
}

export function setTickerEnabled(source: TickerSource, enabled: boolean) {
  state = { ...state, enabled: { ...state.enabled, [source]: enabled } };
  try {
    localStorage.setItem(enabledKey(source), enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
  emit();
}

export function markTickerRead(source: TickerSource) {
  const now = Date.now();
  state = { ...state, lastReadAt: { ...state.lastReadAt, [source]: now } };
  try {
    localStorage.setItem(lastReadKey(source), String(now));
  } catch {
    /* ignore */
  }
  emit();
}

export function useTickerStore(source: TickerSource) {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const messages = snap.messages.filter((m) => m.source === source);
  const lastReadAt = snap.lastReadAt[source];
  const unreadCount = messages.filter((m) => m.timestamp > lastReadAt).length;
  return {
    messages,
    enabled: snap.enabled[source],
    lastReadAt,
    unreadCount,
  };
}
