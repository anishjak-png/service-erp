import type { CapacitorConfig } from "@capacitor/cli";

/** Live app URL loaded inside the APK WebView. Override at build: CAPACITOR_SERVER_URL=... */
const serverUrl =
  process.env.CAPACITOR_SERVER_URL?.trim() || "https://service-erp.vercel.app";

const config: CapacitorConfig = {
  appId: "com.serviceerp.app",
  appName: "Service ERP",
  webDir: "mobile-shell",
  server: {
    url: serverUrl,
    androidScheme: "https",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
