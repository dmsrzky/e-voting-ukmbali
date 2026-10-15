/** Gelapkan/terangkan warna hex. amt -1..1 */
export function shade(hex: string, amt: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  const f = (c: number) => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt);
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
