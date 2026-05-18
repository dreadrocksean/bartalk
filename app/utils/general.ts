import { Dimensions } from "react-native";

const screen = Dimensions.get("screen");
const ar = screen.width / screen.height;
const FEET_PER_MILE = 5280;

export const { width, height } = Dimensions.get("window");
export const min = Math.min(width, height);

export const isTablet: boolean = (() => {
  const msp = (
    screen: { scale: number; width: number; height: number },
    limit: number,
  ) => {
    return (
      (screen.scale * screen.width >= limit ||
        screen.scale * screen.height >= limit) &&
      ar > 0.68
    );
  };
  return (
    (screen.scale < 2 && msp(screen, 1000)) ||
    (screen.scale >= 2 && msp(screen, 1900))
  );
})();

export const unity: number = isTablet ? min * 0.0015 : min * 0.0023;
export const getUnityValue = (val: number): number => Math.floor(unity * val);

export const capitalize = (str: string): string =>
  str[0].toUpperCase() + str.slice(1);

export const isUpperCase = (str: string): boolean => str === str.toUpperCase();

export const titleCase = (str: string): string =>
  str?.replace(/\w+/g, (word) =>
    isUpperCase(word.charAt(0))
      ? word
      : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
  );

type FormatDateOptions = {
  delim?: string;
  timeOnly?: boolean;
  dateOnly?: boolean;
};

export const formatDate = (
  ms: number | string | Date,
  options?: FormatDateOptions,
): string => {
  if (!ms) return "";
  const D = new Date(ms);
  const month = D.getMonth() + 1;
  const date = D.getDate();
  const year = D.getFullYear();
  const hrs = D.getHours();
  const fHrs = hrs % 12;
  const mins = D.getMinutes();
  const meridian = hrs > 11 ? "pm" : "am";

  const fMth = month > 9 ? month : "0" + month;
  const fDate = date > 9 ? date : "0" + date;
  const fMins = mins > 9 ? mins : "0" + mins;

  const delim = options?.delim ?? "/";
  const dateStr = options?.timeOnly
    ? ""
    : `${fMth}${delim}${fDate}${delim}${year}`;
  const timeStr = options?.dateOnly ? "" : `${fHrs || 12}:${fMins} ${meridian}`;
  const conjunction = options?.timeOnly || options?.dateOnly ? "" : "-";
  return `${dateStr}${conjunction}${timeStr}`;
};

export const formatCurrency = (n: number): string => {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  });
  return formatter.format(n);
};

type LatLng = { lat: number; lng: number };
type DistanceUnit = "M" | "K" | "N";

export const getDistance = (
  { lat: lat1, lng: lng1 }: LatLng,
  { lat: lat2, lng: lng2 }: LatLng,
  unit: DistanceUnit = "M",
): number => {
  if (
    typeof lat1 === "undefined" ||
    typeof lat2 === "undefined" ||
    typeof lng1 === "undefined" ||
    typeof lng2 === "undefined"
  )
    return 0;
  if (lat1 == lat2 && lng1 == lng2) return 0;
  const radlat1 = (Math.PI * lat1) / 180;
  const radlat2 = (Math.PI * lat2) / 180;
  const theta = lng1 - lng2;
  const radtheta = (Math.PI * theta) / 180;
  let dist =
    Math.sin(radlat1) * Math.sin(radlat2) +
    Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);

  if (dist > 1) dist = 1;
  dist = Math.acos(dist);
  dist *= 180 / Math.PI;
  dist *= 60 * 1.1515;
  if (unit == "K") {
    dist *= 1.609344;
  } // Kilometers
  if (unit == "N") {
    dist *= 0.8684;
  } // Nautical
  return dist;
};

export const getDistanceString = (distance: number) => {
  const feet = Math.round(distance * FEET_PER_MILE);
  const miles = Math.round(distance);
  const distanceStr = miles > 0 ? `${miles} Mi` : `${feet} Ft`;
  return distanceStr;
};

export const debounce = <T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
): ((...args: Parameters<T>) => void) => {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(null, args), delay);
  };
};

export const throttle = <T extends (...args: any[]) => any>(
  fn: T,
  limit: number,
): ((...args: Parameters<T>) => void) => {
  let wait = false;
  return (...args: Parameters<T>) => {
    if (!wait) {
      fn.apply(null, args);
      wait = true;
      setTimeout(() => (wait = false), limit);
    }
  };
};

export const fuzzyCombi = (
  str: string,
  {
    min = 3,
    max = 5,
    length = 10,
  }: { min?: number; max?: number; length?: number } = {},
): string[] => {
  if (!str) throw new Error("No Name provided");
  const ls = str.replace(/\s/g, "").toLowerCase();
  if (!ls) return [];
  const s = ls.slice(0, length);
  let buff: string[] = [];
  let res: string[] = [];
  for (let i = 0; i < s.length; i++) {
    buff = [s[i]];
    let index = 0;
    while (res[index]) {
      buff.push("" + res[index] + s[i]);
      index++;
    }
    res = [...res, ...buff];
  }
  return res
    .filter((item) => item.length >= min && item.length <= max)
    .sort((a, b) => a.length - b.length);
};
