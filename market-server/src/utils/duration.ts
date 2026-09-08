// Parse a human-readable duration ("15m", "168h", "7d", "1w", "30s") into seconds.
export function parseDurationSeconds(input: string): number {
  const match = /^(\d+)(s|m|h|d|w)$/.exec(input.trim());
  if (!match) {
    throw new Error(`invalid duration format: "${input}" (expected e.g. "15m", "168h")`);
  }
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
    w: 604800,
  };
  return value * multipliers[unit];
}
