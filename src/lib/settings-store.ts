import { useEffect, useState } from "react";

const REFRESH_KEY = "settings.refreshIntervalSec";
const DEFAULT_REFRESH_SEC = 30;

type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

export function getRefreshIntervalSec(): number {
  if (typeof window === "undefined") return DEFAULT_REFRESH_SEC;
  try {
    const raw = localStorage.getItem(REFRESH_KEY);
    if (!raw) return DEFAULT_REFRESH_SEC;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 5 || n > 600) return DEFAULT_REFRESH_SEC;
    return n;
  } catch {
    return DEFAULT_REFRESH_SEC;
  }
}

export function setRefreshIntervalSec(sec: number) {
  try {
    localStorage.setItem(REFRESH_KEY, String(sec));
  } catch {
    /* ignore */
  }
  emit();
}

export function useRefreshIntervalSec(): [number, (n: number) => void] {
  const [value, setValue] = useState<number>(() => getRefreshIntervalSec());
  useEffect(() => {
    const l = () => setValue(getRefreshIntervalSec());
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return [value, setRefreshIntervalSec];
}

export const REFRESH_OPTIONS = [10, 15, 30, 60, 120, 300] as const;

const AUTO_OPEN_COMPLETED_KEY = "announcer.autoOpenCompleted";

export function getAutoOpenCompleted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(AUTO_OPEN_COMPLETED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAutoOpenCompleted(value: boolean) {
  try {
    localStorage.setItem(AUTO_OPEN_COMPLETED_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
  emit();
}

export function useAutoOpenCompleted(): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => getAutoOpenCompleted());
  useEffect(() => {
    const l = () => setValue(getAutoOpenCompleted());
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return [value, setAutoOpenCompleted];
}
