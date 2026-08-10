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
export const CATEGORIES = ["Items", "Skills", "Modifiers", "Star Relics"];
