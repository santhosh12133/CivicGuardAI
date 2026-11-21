import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
});

// ---------------------------------------------------------------- session storage
// The access token lasts 15 minutes; the refresh token renews it and is
// replaced on every renewal. Both live in this browser's localStorage.
export const session = {
  token: () => localStorage.getItem("admin_token"),
  refreshToken: () => localStorage.getItem("admin_refresh"),
  save: ({ token, refreshToken, user }) => {
    if (token) localStorage.setItem("admin_token", token);
    if (refreshToken) localStorage.setItem("admin_refresh", refreshToken);
    if (user) localStorage.setItem("admin_user", JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_refresh");
    localStorage.removeItem("admin_user");
  },
};

api.interceptors.request.use(
  (config) => {
    const token = session.token();
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// One renewal at a time, shared by all requests that hit an expired token.
let refreshing = null;
const renewSession = () => {
  if (!refreshing) {
    const refreshToken = session.refreshToken();
    refreshing = (refreshToken
      ? axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken }).then(({ data }) => {
          session.save(data);
          return data.token;
        })
      : Promise.reject(new Error("No session"))
    ).finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
};

const goToLogin = () => {
  session.clear();
  if (window.location.pathname !== "/login") {
    window.location.replace("/login");
  }
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    const isAuthCall = /\/auth\/(login|refresh|logout|password|google)/.test(config?.url || "");
    if (response?.status === 401 && !isAuthCall) {
      if (response.data?.code === "TOKEN_EXPIRED" && !config._retried) {
        try {
          const token = await renewSession();
          config._retried = true;
          config.headers.Authorization = `Bearer ${token}`;
          return api(config);
        } catch {
          goToLogin();
        }
      } else {
        goToLogin();
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
  logout: async () => {
    try {
      await api.post("/auth/logout", { refreshToken: session.refreshToken() });
    } catch {
      // Signing out locally still works if the server can't be reached.
    }
    session.clear();
  },
  // Ends a session we are not going to keep (e.g. a citizen signing in here).
  endSession: async (refreshToken) => {
    try {
      await axios.post(`${API_BASE_URL}/auth/logout`, { refreshToken });
    } catch {
      // ignore
    }
  },
  providers: async () => (await api.get("/auth/providers")).data,
  forgotPassword: async (email) => (await api.post("/auth/password/forgot", { email })).data,
  resetPassword: async (email, code, newPassword) =>
    (await api.post("/auth/password/reset", { email, code, newPassword })).data,
  googleStartUrl: () => `${API_BASE_URL}/auth/google/start?client=admin`,
  googleExchange: async (code) => (await api.post("/auth/google/exchange", { code })).data,
};

export const authAPI = {
  me: async () => (await api.get("/auth/me")).data.user,
  changePassword: async (currentPassword, newPassword) =>
    (await api.post("/auth/change-password", { currentPassword, newPassword })).data,
};

export const usersAPI = {
  listStaff: async () => (await api.get("/auth/users", { params: { role: "staff,admin" } })).data.users,
  createStaff: async ({ name, email, role }) => (await api.post("/auth/staff", { name, email, role })).data,
  updateRole: async (id, role) => (await api.patch(`/auth/users/${id}`, { role })).data.user,
  resetPassword: async (id) => (await api.post(`/auth/users/${id}/reset-password`)).data,
};

export const issuesAPI = {
  getAll: async (params = {}) => {
    const response = await api.get("/issues", { params });
    return response.data;
  },
  categories: async () => (await api.get("/issues/categories")).data,
  stats: async () => (await api.get("/issues/stats")).data,
  // Any of { status, category, note }; a note alone is allowed.
  update: async (id, changes) => (await api.put(`/issues/${id}`, changes)).data,
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
