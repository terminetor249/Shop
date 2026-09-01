import axios from "axios";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

// Attach token from localStorage as fallback (cookies also work)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("dokkaebi_token");
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export const RANK_META = {
  F: { color: "#64748b", glowClass: "" },
  E: { color: "#94a3b8", glowClass: "" },
  D: { color: "#cbd5e1", glowClass: "" },
  C: { color: "#4ade80", glowClass: "" },
  B: { color: "#2dd4bf", glowClass: "" },
  A: { color: "#c084fc", glowClass: "" },
  S: { color: "#facc15", glowClass: "glow-s" },
  SS: { color: "#fb923c", glowClass: "glow-ss" },
  SSS: { color: "#ef4444", glowClass: "glow-sss" },
  "Star Relic": {
    color: "linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)",
    glowClass: "glow-relic",
  },
};

export const RANKS = ["F", "E", "D", "C", "B", "A", "S", "SS", "SSS", "Star Relic"];
export const CATEGORIES = ["Items", "Skills", "Story", "Star Relics"];

export const STAT_KEYS = ["vigor", "strength", "agility", "status", "acuity"];
export const STAT_META = {
  vigor: { label: "Vigor", color: "#ef4444", desc: "Endurance & vitality" },
  strength: { label: "Strength", color: "#f97316", desc: "Raw physical power" },
  agility: { label: "Agility", color: "#22d3ee", desc: "Speed & reflexes" },
  status: { label: "Status", color: "#a855f7", desc: "Presence & influence" },
  acuity: { label: "Acuity", color: "#facc15", desc: "Perception & insight" },
};

export function upgradeCost(currentLevel, total) {
  return 100 + currentLevel * 20 + total * 10;
}
