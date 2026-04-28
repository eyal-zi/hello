/** Clamp a value into the inclusive range [minimum, maximum]. */
export const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(maximum, value));
