import type { Allocation } from "./tuloslista";

export interface ResultVisualState {
  signature: string;
  result: string | null;
  attemptSignature: string | null;
  attemptResult: string | null;
  /** 1-based index of the latest non-empty attempt, if any. */
  attemptIndex: number | null;
}

function normalizeResult(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isDisplayableAttempt(value: string): boolean {
  return /\d/.test(value);
}

export function getResultVisualState(alloc: Allocation): ResultVisualState | null {
  const result = normalizeResult(alloc.Result);
  const attemptParts: string[] = [];
  let attemptSignature: string | null = null;
  let attemptResult: string | null = null;
  let attemptIndex: number | null = null;

  alloc.Attempts?.forEach((attempt, index) => {
    const value = normalizeResult(attempt.Line1);
    if (!value || !isDisplayableAttempt(value)) return;
    attemptParts.push(`${index}:${value}`);
    attemptResult = value;
    attemptIndex = index + 1;
  });

  if (attemptParts.length > 0) {
    attemptSignature = `attempts:${attemptParts.join("|")}`;
  }

  if (!result && !attemptResult) return null;

  return {
    signature: `result:${result ?? ""}|rank:${alloc.ResultRank ?? ""}|${attemptSignature ?? ""}`,
    result,
    attemptSignature,
    attemptResult,
    attemptIndex,
  };
}