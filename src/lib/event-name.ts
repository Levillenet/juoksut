// Standalone event-name helpers with no other dependencies, to be reused by
// modules that would otherwise create circular imports with athlete-history.

export function normalizeEventName(name: string): string {
  if (!name) return "";
  let s = name
    .replace(/^(?:[MNTmnt][0-9]*|[Pp][0-9]+)\s+/, "")
    .replace(/^[0-9]+-ottelu\s+/i, "");
  s = s.replace(/\s*-\s*R\d.*$/i, "");
  s = s.replace(/\s*\([^)]*\)\s*$/g, "");
  s = s.replace(/\s+(?:kilpailu|kierros|erä)\s*\d+\s*$/i, "");
  s = s.replace(/\s+ryhmä\s*\d+\s*$/i, "");
  return s.replace(/\s+/g, " ").trim();
}
