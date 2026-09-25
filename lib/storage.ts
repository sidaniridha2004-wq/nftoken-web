"use client";

import { netflixIdPreview } from "./mask";

export type SavedStatus = "unknown" | "working" | "invalid" | "error";

export type SavedCookie = {
  id: string;
  label: string;
  source?: string;
  country?: string;
  raw: string;
  preview: string;
  status: SavedStatus;
  message?: string;
  loginUrl?: string;
  expires?: number | null;
  expiryText?: string;
  lastChecked?: number;
  addedAt: number;
};

const KEY = "nftoken-web:saved-cookies:v1";

export function loadSaved(): SavedCookie[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data as SavedCookie[];
  } catch {
    return [];
  }
}

export function persistSaved(items: SavedCookie[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // storage full or blocked — ignore
  }
}

export function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function newSavedCookie(
  raw: string,
  label?: string,
  source?: string,
): SavedCookie {
  const trimmed = raw.trim();
  return {
    id: makeId(),
    label: label?.trim() || "",
    source: source?.trim() || undefined,
    raw: trimmed,
    preview: netflixIdPreview(trimmed),
    status: "unknown",
    addedAt: Date.now(),
  };
}
