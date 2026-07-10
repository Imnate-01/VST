import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Locale } from "@/lib/i18n";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(
  date: Date | string | null | undefined,
  locale: Locale = "en"
): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const m = String(d.getUTCMonth() + 1);
  const day = String(d.getUTCDate());
  const y = String(d.getUTCFullYear()).slice(-2);
  return locale === "es" ? `${day}/${m}/${y}` : `${m}/${day}/${y}`;
}

export function formatDateLong(
  date: Date | string | null | undefined,
  locale: Locale = "en"
): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(locale === "es" ? "es-MX" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateInput(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
