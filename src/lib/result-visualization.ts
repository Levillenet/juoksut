import type { Allocation } from "./tuloslista";

export interface ResultVisualState {
  signature: string;
  result: string | null;
  attemptSignature: string | null;
  attemptResult: string | null;
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
  let attemptSignature: string | null = null;
  let attemptResult: string | null = null;

  alloc.Attempts?.forEach((attempt, index) => {
    const value = normalizeResult(attempt.Line1);
    if (!value || !isDisplayableAttempt(value)) return;
    attemptSignature = `attempt:${index}:${value}`;
    attemptResult = value;
  });

  if (!result && !attemptResult) return null;

  return {
    signature: `result:${result ?? ""}|${attemptSignature ?? ""}`,
    result,
    attemptSignature,
    attemptResult,
  };
}