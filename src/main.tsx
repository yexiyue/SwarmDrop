import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { ThemeProvider, useTheme } from "next-themes";
import { routeTree } from "./routeTree.gen";
import { useAuthStore } from "@/stores/auth-store";
import {
  usePreferencesStore,
  waitForPreferencesHydration,
} from "@/stores/preferences-store";
import "./index.css";

// Create a new router instance
const router = createRouter({ routeTree });

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

/**
 * 桥接组件：将 Zustand preferences store 的主题同步到 next-themes
 * next-themes 负责 DOM 操作和系统主题监听
 * Zustand store 负责通过 tauri-plugin-store 持久化
 */
function ThemeSync() {
  const { setTheme } = useTheme();
  const storeTheme = usePreferencesStore((s) => s.theme);

  useEffect(() => {
    setTheme(storeTheme);
  }, [storeTheme, setTheme]);

  return null;
}

function App() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // 等待偏好设置 hydration 完成（主题和语言在 onRehydrateStorage 中自动应用）
    Promise.all([
      waitForPreferencesHydration(),
      useAuthStore.getState().checkBiometricAvailability(),
    ]).then(() => setIsLoaded(true));
  }, []);

  if (!isLoaded) {
    return null;
  }

  return (
    <I18nProvider i18n={i18n}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
        storageKey="next-theme"
      >
        <ThemeSync />
        <RouterProvider router={router} />
      </ThemeProvider>
    </I18nProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
