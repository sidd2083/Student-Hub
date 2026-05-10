const NPT_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;

export function getNepaliDate(d: Date = new Date()): string {
  return new Date(d.getTime() + NPT_OFFSET_MS).toISOString().slice(0, 10);
}

export function getNepaliYesterday(): string {
  return getNepaliDate(new Date(Date.now() - 86400000));
}
