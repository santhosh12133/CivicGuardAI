import { useEffect, useState } from "react";
import api from "./api";

// Used until the server's list (GET /api/issues/categories) has loaded.
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

export const CATEGORY_ICONS = {
  pothole: "road-variant",
  road_damage: "road",
  streetlight: "lightbulb-outline",
  garbage: "delete-outline",
  water_supply: "water-outline",
  drainage: "pipe",
  traffic_signal: "traffic-light",
  fallen_tree: "tree-outline",
  other: "dots-horizontal-circle-outline",
};

let cached = null;

export const useCategories = () => {
  const [categories, setCategories] = useState(cached || FALLBACK_CATEGORIES);
  useEffect(() => {
    if (cached) return;
    api
      .get("/api/issues/categories")
      .then(({ data }) => {
        if (Array.isArray(data) && data.length) {
          cached = data;
          setCategories(data);
        }
      })
      .catch(() => {});
  }, []);
  return categories;
};

export const categoryLabel = (categories, id) =>
  categories.find((category) => category.id === id)?.label || "Other";
