export type RGB = [r: number, g: number, b: number];
export type HSV = [h: number, s: number, v: number];
export type HEX = string;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const normalizeHex = (hex: string): string => {
  const cleaned = hex.trim().replace(/^#/, "");
  if (cleaned.length === 3) {
    return cleaned
      .split("")
      .map((char) => char + char)
      .join("");
  }
  return cleaned;
};

const hexToRgb = (hex: HEX): RGB => {
  const normalized = normalizeHex(hex);
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return [0, 0, 0];
  }

  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
};

const rgbToHex = ([r, g, b]: RGB): HEX =>
  [r, g, b]
    .map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

const rgbToHsv = ([r, g, b]: RGB): HSV => {
  const red = clamp(r, 0, 255) / 255;
  const green = clamp(g, 0, 255) / 255;
  const blue = clamp(b, 0, 255) / 255;

  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    if (max === red) {
      hue = ((green - blue) / delta) % 6;
    } else if (max === green) {
      hue = (blue - red) / delta + 2;
    } else {
      hue = (red - green) / delta + 4;
    }
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  const saturation = max === 0 ? 0 : (delta / max) * 100;
  const value = max * 100;

  return [Math.round(hue), Math.round(saturation), Math.round(value)];
};

const hsvToRgb = ([h, s, v]: HSV): RGB => {
  const hue = ((h % 360) + 360) % 360;
  const saturation = clamp(s, 0, 100) / 100;
  const value = clamp(v, 0, 100) / 100;

  const chroma = value * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = value - chroma;

  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;

  if (hue < 60) {
    rPrime = chroma;
    gPrime = x;
  } else if (hue < 120) {
    rPrime = x;
    gPrime = chroma;
  } else if (hue < 180) {
    gPrime = chroma;
    bPrime = x;
  } else if (hue < 240) {
    gPrime = x;
    bPrime = chroma;
  } else if (hue < 300) {
    rPrime = x;
    bPrime = chroma;
  } else {
    rPrime = chroma;
    bPrime = x;
  }

  return [
    Math.round((rPrime + m) * 255),
    Math.round((gPrime + m) * 255),
    Math.round((bPrime + m) * 255),
  ];
};

const convert = {
  hex: {
    rgb: (hex: HEX): RGB => hexToRgb(hex),
    hsv: (hex: HEX): HSV => rgbToHsv(hexToRgb(hex)),
  },
  rgb: {
    hex: (rgb: RGB): HEX => rgbToHex(rgb),
  },
  hsv: {
    hex: (hsv: HSV): HEX => rgbToHex(hsvToRgb(hsv)),
  },
};

export default convert;
