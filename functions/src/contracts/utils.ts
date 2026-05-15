import crypto from "crypto";
import { formatInTimeZone } from "date-fns-tz";

export function parisDateDDMMYYYY(date = new Date()): string {
  return formatInTimeZone(date, "Europe/Paris", "dd/MM/yyyy");
}

export function generateSignatureToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

export function clampText(value: unknown, max = 120): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

export function sanitizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function priceLabel(amount: number, currency = "eur"): string {
  const value = Number(amount || 0);
  const c = String(currency || "eur").toUpperCase();
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: c }).format(value / 100);
}
