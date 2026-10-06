import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** True when a caller pins a height/size itself (dense tables, slot grids); primitives then skip touch-size growth. */
export function hasExplicitHeight(className?: string) {
  return !!className && /(?:^|[\s:])(?:h|size|min-h)-/.test(className);
}

/** 44px minimum on touch screens for controls whose caller did not pin a height. */
export const COARSE_MIN_H = "[@media(pointer:coarse)]:min-h-11";
