import { useSyncExternalStore } from "react";

export interface TickerMessage {
  id: string;
  text: string;
  timestamp: number;
  eventId: number;
  eventName: string;
}

const MAX_MESSAGES = 50;
const ENABLED_KEY = "announcer.liveTicker.enabled";
const LAST_READ_KEY = "announcer.liveTicker.lastReadAt";

function readEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = localStorage.getItem(ENABLED_KEY);
    return v === null ? true : v === "1";
  } catch {
    return true;
  }
}

function readLastRead(): number {
  if (typeof window === "undefined") return 0;
  try {
    const v = localStorage.getItem(LAST_READ_KEY);
    return v ? parseInt(v, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

interface State {
  messages: TickerMessage[];
  enabled: boolean;
  lastReadAt: number;
}

let state: State = {
  messages: [],
  enabled: readEnabled(),
  lastReadAt: readLastRead(),
};

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot() {
  return state;
}

function getServerSnapshot() {
  return state;
}

export function pushTickerMessage(msg: Omit<TickerMessage, "id" | "timestamp">) {
  const full: TickerMessage = {
    ...msg,
    id: `${msg.eventId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
  };
  state = {
    ...state,
    messages: [full, ...state.messages].slice(0, MAX_MESSAGES),
  };
  emit();
}

export function setTickerEnabled(enabled: boolean) {
  state = { ...state, enabled };
  try {
    localStorage.setItem(ENABLED_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
  emit();
}

export function markTickerRead() {
  const now = Date.now();
  state = { ...state, lastReadAt: now };
  try {
    localStorage.setItem(LAST_READ_KEY, String(now));
  } catch {
    /* ignore */
  }
  emit();
}

export function useTickerStore() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const unreadCount = snap.messages.filter((m) => m.timestamp > snap.lastReadAt).length;
  return {
    messages: snap.messages,
    enabled: snap.enabled,
    lastReadAt: snap.lastReadAt,
    unreadCount,
  };
}
