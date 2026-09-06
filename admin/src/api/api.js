import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("admin_token");
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_user");
      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }
    return Promise.reject(error);
  }
);

export const adminAuth = {
  login: async (email, password) => {
    const response = await api.post("/auth/login", { email, password });
    return response.data;
  },
};

export const issuesAPI = {
  getAll: async () => {
    const response = await api.get("/issues");
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/issues/${id}`);
    return response.data;
  },
  updateStatus: async (id, status) => {
    const response = await api.put(`/issues/${id}`, { status });
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/issues/${id}`);
    return response.data;
  },
  uploadImage: async (id, imageFile, extra = {}) => {
    const formData = new FormData();
    formData.append("image", imageFile);
    Object.entries(extra).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });

    const response = await api.put(`/issues/${id}`, formData);
    return response.data;
  },
};

export default api;
