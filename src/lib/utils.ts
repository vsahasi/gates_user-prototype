import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Coerce an unknown API field to a finite number, or null. Preserves the
// distinction between "unknown" (null) and zero so prompt + UI layers don't
// render suppressed fields as "$0" / "0%".
export function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
