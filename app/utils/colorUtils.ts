import convert from "./convert";

export const colorShade = (hex: string, percent: number): string => {
  const amt = Math.round(2.55 * percent);
  const [r, g, b] = convert.hex.rgb(hex) as [number, number, number];
  const R = Math.max(Math.min(r + amt, 255), 0);
  const G = Math.max(Math.min(g + amt, 255), 0);
  const B = Math.max(Math.min(b + amt, 255), 0);
  return `#${convert.rgb.hex([R, G, B])}`;
};

export const colorSaturate = (hex: string, percent: number = 20): string => {
  const hsv = convert.hex.hsv(hex) as [number, number, number];
  const sat = hsv[1];
  if (sat === 0) return hex;
  const delta =
    percent > 0 ? ((100 - sat) * percent) / 100 : -((sat * percent) / 100);
  hsv[1] += delta;
  const newHex = convert.hsv.hex(hsv);
  return `#${newHex}`;
};

export const smartShade = (hex: string, percent: number): string => {
  const shaded = colorShade(hex, percent);
  return percent > 0 ? shaded : colorSaturate(shaded, percent * -3.5);
};
