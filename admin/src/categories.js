import { useEffect, useState } from "react";
import { issuesAPI } from "./api/api";

// Used until the server's list (GET /issues/categories) has loaded.
export const FALLBACK_CATEGORIES = [
  { id: "pothole", label: "Pothole" },
  { id: "road_damage", label: "Road damage" },
  { id: "streetlight", label: "Streetlight" },
  { id: "garbage", label: "Garbage" },
  { id: "water_supply", label: "Water supply" },
  { id: "drainage", label: "Drainage / sewage" },
  { id: "traffic_signal", label: "Traffic signal" },
  { id: "fallen_tree", label: "Fallen tree" },
  { id: "other", label: "Other" },
];

let cached = null;

export const useCategories = () => {
  const [categories, setCategories] = useState(cached || FALLBACK_CATEGORIES);
  useEffect(() => {
    if (cached) return;
    issuesAPI
      .categories()
      .then((list) => {
        if (Array.isArray(list) && list.length) {
          cached = list;
          setCategories(list);
        }
      })
      .catch(() => {});
  }, []);
  return categories;
};

export const categoryLabel = (categories, id) =>
  categories.find((category) => category.id === id)?.label || id || "Other";

export const STATUS_COLORS = { Open: "warning", "In Progress": "info", Resolved: "success" };

export const currentUser = () => {
  try {
    return JSON.parse(localStorage.getItem("admin_user") || "null");
  } catch {
    return null;
  }
};
