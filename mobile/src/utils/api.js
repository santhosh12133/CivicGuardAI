import axios from "axios";

// The API URL is intentionally supplied by the environment so production builds
// never point at a developer machine or a stale LAN address.
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const DEV_SERVER_IP = "10.47.147.234";
const PORT = 5000;

if (!configuredApiUrl && !__DEV__) {
  throw new Error(
    "EXPO_PUBLIC_API_URL is required for non-development CivicFix builds."
  );
}

export const API_BASE_URL = (
  configuredApiUrl || `http://${DEV_SERVER_IP}:${PORT}`
).replace(/\/$/, "");

console.log("Using backend at:", API_BASE_URL);

// Free hosting (e.g. Render) puts the API to sleep after 15 idle minutes and
// the first request can take close to a minute while it wakes up. Photo
// uploads also run EXIF and duplicate checks, so allow plenty of time.
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 90000,
  headers: {
    Accept: "application/json",
  },
});

// Add the current JWT to authenticated requests.
api.interceptors.request.use((config) => {
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

// AuthContext registers a callback here so an expired or revoked token logs
// the user out instead of leaving every request failing with 401.
let unauthorizedHandler = null;
export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = handler;
};

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
          new Error(
            "The server took too long to respond. It may have been asleep; please try again in a moment."
          )
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
      const sentToken = Boolean(error.config?.headers?.Authorization);
      if (sentToken && unauthorizedHandler) {
        unauthorizedHandler();
        return Promise.reject(new Error("Your session has expired. Please log in again."));
      }
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
