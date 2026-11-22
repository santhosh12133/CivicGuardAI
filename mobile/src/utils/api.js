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

// Wakes a sleeping server (e.g. Render's free tier) before the user needs it.
const warmUp = () => {
  if (!baseUrl) return;
  api.get("/health").catch(() => {});
};

/** Loads the saved server address (if any). Call once at start-up. */
export const loadSavedServer = async () => {
  try {
    const saved = await AsyncStorage.getItem(SERVER_KEY);
    if (saved) applyBaseUrl(saved);
  } catch (error) {
    console.warn("Failed to load server address", error);
  }
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

// AuthContext registers a callback here so a revoked session logs the user
// out instead of leaving every request failing with 401.
let unauthorizedHandler = null;
export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = handler;
};

// Access tokens last 15 minutes. AuthContext supplies the refresh token and
// stores the renewed tokens; renewal happens here, once for all requests.
let sessionHooks = { getRefreshToken: async () => null, onRenewed: async () => {} };
export const setSessionHooks = (hooks) => {
  sessionHooks = { ...sessionHooks, ...hooks };
};

let renewing = null;
const renewSession = () => {
  if (!renewing) {
    renewing = (async () => {
      const refreshToken = await sessionHooks.getRefreshToken();
      if (!refreshToken) throw new Error("No session");
      const { data } = await axios.post(`${baseUrl}/api/auth/refresh`, { refreshToken }, { timeout: 90000 });
      setAuthToken(data.token);
      await sessionHooks.onRenewed(data);
      return data.token;
    })().finally(() => {
      renewing = null;
    });
  }
  return renewing;
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
  // Photo uploads: on Android, axios otherwise sends FormData labelled
  // "application/x-www-form-urlencoded", which React Native's networking
  // refuses to encode ("multipart != application/x-www-form-urlencoded"),
  // so every upload failed with "Network Error". React Native adds the
  // multipart boundary itself.
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    config.headers = config.headers || {};
    if (typeof config.headers.set === "function") {
      config.headers.set("Content-Type", "multipart/form-data");
    } else {
      config.headers["Content-Type"] = "multipart/form-data";
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Expired access token: renew it with the refresh token and try again.
    const config = error.config || {};
    const isAuthCall = /\/api\/auth\/(login|register|refresh|logout|password|otp|google)/.test(config.url || "");
    if (error.response?.status === 401 && error.response.data?.code === "TOKEN_EXPIRED" && !config._retried && !isAuthCall) {
      try {
        const token = await renewSession();
        config._retried = true;
        config.headers = config.headers || {};
        if (typeof config.headers.set === "function") config.headers.set("Authorization", `Bearer ${token}`);
        else config.headers.Authorization = `Bearer ${token}`;
        return api(config);
      } catch (renewError) {
        if (unauthorizedHandler) unauthorizedHandler();
        return Promise.reject(new Error("Your session has expired. Please log in again."));
      }
    }

    if (!error.response) {
      // React Native keeps the underlying native error (e.g. an OkHttp
      // exception) on the XMLHttpRequest; log it so device logs explain
      // "Network Error"s.
      console.warn("[api] request failed without a response", {
        method: error.config?.method,
        url: error.config?.url,
        code: error.code,
        message: error.message,
        native: error.request?._response,
      });
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
      if (sentToken && !isAuthCall && unauthorizedHandler) {
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
