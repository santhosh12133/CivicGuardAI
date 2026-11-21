import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Where the CivicFix server lives.
//
// Builds made for a deployed server have its address built in
// (EXPO_PUBLIC_API_URL). Builds without one ask for it on first launch (see
// ServerScreen), and the address can be changed from the login screen. The
// chosen address is remembered on the device.
const SERVER_KEY = "@civicfix/server";
const BUILT_IN_URL = process.env.EXPO_PUBLIC_API_URL?.trim() || "";
const DEV_FALLBACK = __DEV__ ? "http://10.47.147.234:5000" : "";

/** Turns what a person types into a server root URL ("x.com/api/" -> "https://x.com"). */
export const normalizeServerUrl = (input) => {
  let url = (input || "").trim();
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url.replace(/\/+$/, "").replace(/\/api$/i, "");
};

export const hasBuiltInServer = Boolean(BUILT_IN_URL);

let baseUrl = normalizeServerUrl(BUILT_IN_URL) || DEV_FALLBACK;
export const getApiBaseUrl = () => baseUrl;

// Free hosting (e.g. Render) puts the API to sleep after 15 idle minutes and
// the first request can take close to a minute while it wakes up. Photo
// uploads also run EXIF and duplicate checks, so allow plenty of time.
const api = axios.create({
  baseURL: baseUrl || undefined,
  timeout: 90000,
  headers: {
    Accept: "application/json",
  },
});

const applyBaseUrl = (url) => {
  baseUrl = url;
  api.defaults.baseURL = url || undefined;
};

// Wakes a sleeping server early and makes connectivity visible in device logs.
const warmUp = () => {
  if (!baseUrl) return;
  api
    .get("/health")
    .then((res) => console.log("[api] health ok", res.data))
    .catch((err) => console.log("[api] health check failed", err.message || err));
};

/** Loads the saved server address (if any). Call once at start-up. */
export const loadSavedServer = async () => {
  try {
    const saved = await AsyncStorage.getItem(SERVER_KEY);
    if (saved) applyBaseUrl(saved);
  } catch (error) {
    console.warn("Failed to load server address", error);
  }
  console.log("Using backend at:", baseUrl || "(not set)");
  warmUp();
  return baseUrl;
};

/** Checks that an address is a working CivicFix server, then remembers it. */
export const saveServer = async (input) => {
  const url = normalizeServerUrl(input);
  if (!url) throw new Error("Enter the server address.");
  if (!__DEV__ && !url.startsWith("https://")) {
    throw new Error("The server address must start with https://");
  }

  let response;
  try {
    response = await axios.get(`${url}/health`, { timeout: 90000 });
  } catch (error) {
    if (error.response?.status === 503) {
      throw new Error("The server is running but its database is unavailable. Try again later.");
    }
    throw new Error(`Could not reach ${url}. Check the address and your internet connection.`);
  }
  if (response.data?.status !== "ok") {
    throw new Error("That address answered, but it is not a CivicFix server.");
  }

  await AsyncStorage.setItem(SERVER_KEY, url);
  applyBaseUrl(url);
  return url;
};

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

api.interceptors.request.use((config) => {
  if (!baseUrl) {
    return Promise.reject(new Error("No server is set. Add the server address on the login screen."));
  }
  return config;
});

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
            `Cannot connect to server at ${baseUrl}. ` +
              "Check your internet connection, or the server address on the login screen."
          )
        );
      }
      return Promise.reject(new Error(error.message ? `Connection error: ${error.message}` : "Connection error"));
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
        new Error(data?.message || `Not found (404). Check the server address: ${baseUrl}`)
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
