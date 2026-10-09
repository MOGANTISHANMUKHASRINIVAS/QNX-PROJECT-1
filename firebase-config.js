/**
 * Firebase Realtime Database Configuration & Manager Module
 * For QNX Real-Time Safety Supervisor Dashboard
 */

(function (root, factory) {
  if (typeof exports === "object" && typeof module !== "undefined") {
    module.exports = factory();
  } else if (typeof define === "function" && define.amd) {
    define([], factory);
  } else {
    root.QNXFirebase = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this, function () {

  const defaultFirebaseConfig = {
    apiKey: "AIzaSyCnlyiBprm7WzfKPnxwhPt5rhnmt5USAy0",
    authDomain: "qnx-safety-supervisor.firebaseapp.com",
    databaseURL: "https://qnx-safety-supervisor-default-rtdb.firebaseio.com",
    projectId: "qnx-safety-supervisor",
    storageBucket: "qnx-safety-supervisor.firebasestorage.app",
    messagingSenderId: "929006897174",
    appId: "1:929006897174:web:6c03e7f001cf6b0af94d37",
    measurementId: "G-H09DXVFX89"
  };

  const DEFAULT_RTDB_PATH = "telemetry/latest";

  const STORAGE_KEY_CONFIG = "qnx_firebase_custom_config";
  const STORAGE_KEY_PATH = "qnx_firebase_custom_path";

  function getActiveFirebaseConfig() {
    try {
      if (typeof localStorage !== "undefined") {
        const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === "object" && parsed.apiKey) {
            return parsed;
          }
        }
      }
    } catch (err) {
      console.warn("[FirebaseConfig] Failed to read custom config:", err);
    }
    return { ...defaultFirebaseConfig };
  }

  function saveFirebaseConfig(config) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
      }
    } catch (err) {
      console.error("[FirebaseConfig] Failed to persist config:", err);
    }
  }

  function getActiveRTDBPath() {
    try {
      if (typeof localStorage !== "undefined") {
        return localStorage.getItem(STORAGE_KEY_PATH) || DEFAULT_RTDB_PATH;
      }
    } catch (err) { /* ignore */ }
    return DEFAULT_RTDB_PATH;
  }

  function saveRTDBPath(path) {
    const cleanPath = (path || "").trim().replace(/^\/+|\/+$/g, "") || DEFAULT_RTDB_PATH;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY_PATH, cleanPath);
      }
    } catch (err) { /* ignore */ }
    return cleanPath;
  }

  return {
    defaultFirebaseConfig,
    DEFAULT_RTDB_PATH,
    getActiveFirebaseConfig,
    saveFirebaseConfig,
    getActiveRTDBPath,
    saveRTDBPath
  };
});
