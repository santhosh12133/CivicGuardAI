import axios from "axios";

// Prefer Expo public environment configuration so the app does not depend on
// a developer's machine-specific LAN address. Set EXPO_PUBLIC_API_URL in the
// mobile environment when running against a local, tunnel, or deployed API.
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const DEV_SERVER_IP = "10.47.147.234";
const PORT = 5000;

export const API_BASE_URL = (
  configuredApiUrl || `http://${DEV_SERVER_IP}:${PORT}`
).replace(/\/$/, "");

console.log("🌐 Using backend at:", API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    Accept: "application/json",
  },
});

// Debug: log the API base so we can verify the app is using the correct host
try {
  console.log("[api] API_BASE_URL =", API_BASE_URL);
} catch (e) {}

// Add the current JWT to authenticated requests.
api.interceptors.request.use((config) => {
  try {
    console.log(
      "[api] request",
      config.method,
      config.url,
      config.baseURL || API_BASE_URL
    );
  } catch (e) {}
  return config;
});

// Quick startup probe to /health so connectivity is visible in device logs.
(async () => {
  try {
    const res = await api.get("/health");
    console.log("[api] health ok", res.data);
  } catch (err) {
    console.log("[api] health check failed", err.message || err);
  }
})();

export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      if (error.code === "ECONNABORTED") {
        return Promise.reject(
          new Error("Request timeout. The server may be slow or unreachable.")
        );
      }
      if (error.message === "Network Error" || error.code === "ERR_NETWORK") {
        return Promise.reject(
          new Error(
            `Cannot connect to server at ${API_BASE_URL}. ` +
              "Please ensure the backend is running and the configured API URL is reachable."
          )
        );
      }
      return Promise.reject(new Error(`Connection error: ${error.message}`));
    }

    const { data, status } = error.response;

    if (status === 401) {
      // Let AuthContext/screens decide whether and how to clear the session.
      // Do not silently mutate authentication state from this generic client.
      return Promise.reject(new Error(data?.message || "Authentication failed"));
    }

    if (status === 503) {
      return Promise.reject(
        new Error(
          "Service unavailable (503). The backend server may be down or overloaded."
        )
      );
    }

    if (status === 404) {
      return Promise.reject(
        new Error(
          `Endpoint not found (404). Check the API URL: ${API_BASE_URL}`
        )
      );
    }

    if (data?.errors && Array.isArray(data.errors) && data.errors.length > 0) {
      const errorMessages = data.errors.map(
        (err) => err.msg || err.message || "Validation failed"
      );
      return Promise.reject(new Error(errorMessages.join(". ")));
    }

    const message =
      data?.message || data?.error || `Request failed with status ${status}`;
    return Promise.reject(new Error(message));
  }
);

export default api;
