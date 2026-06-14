// PB-grouping key + display label for athlete results.
// For hurdles and throws, the spec (height/count / implement weight) is part
// of the key so a result in a younger age class with lighter equipment cannot
// become a PB in an older class — and vice versa. Falls back to age_class
// when the spec table doesn't know the row.

import { normalizeEventName } from "./athlete-history";
import { eventSpecKey, eventSpecLabel, getEventSpec } from "./event-specs";

export interface PbKeyInput {
  event_name: string;
  age_class?: string | null;
}

/** Stable key for grouping personal-best comparisons across results. */
export function pbEventKey(row: PbKeyInput): string {
  const norm = normalizeEventName(row.event_name);
  const spec = getEventSpec(row.age_class, row.event_name);
  if (spec) {
    return `${norm}|${eventSpecKey(row.age_class, row.event_name)}`;
  }
  // Hurdle/throw without known spec → keep age_class so specs never bleed.
  if (isSpecSensitive(row.event_name)) {
    return `${norm}|ac:${(row.age_class ?? "").toUpperCase()}`;
  }
  return norm;
}

/** Like pbEventKey but skips normalization; takes a pre-normalized event name. */
export function pbEventKeyFromNorm(
  normalizedEventName: string,
  ageClass: string | null | undefined,
  rawEventName?: string,
): string {
  const ref = rawEventName ?? normalizedEventName;
  const spec = getEventSpec(ageClass, ref);
  if (spec) {
    return `${normalizedEventName}|${eventSpecKey(ageClass, ref)}`;
  }
  if (isSpecSensitive(ref)) {
    return `${normalizedEventName}|ac:${(ageClass ?? "").toUpperCase()}`;
  }
  return normalizedEventName;
}

export function isSpecSensitive(eventName: string): boolean {
  const s = normalizeEventName(eventName).toLowerCase();
  return /aita|aidat|kuula|kiekko|keih[aä]s|moukari|shot\s*put|discus|javelin|hammer|hurdle/.test(
    s,
  );
}

/** Human-readable event label including spec suffix when known. */
export function pbEventLabel(row: PbKeyInput): string {
  const norm = normalizeEventName(row.event_name);
  const suffix = eventSpecLabel(row.age_class, row.event_name);
  return suffix ? `${norm} ${suffix}` : norm;
}
