import React from "react";
import { useI18n } from "../../locales";
import { usePlatform } from "../../platform/context";
import { useStores } from "../../store/context";
import { ChatList } from "./sub-components/ChatList";
import { Navigation } from "./sub-components/Header";

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { useRouter, useCloudsStore } = useStores();
  const { currentPage } = useRouter();
  const platform = usePlatform();
  const { fetchClouds } = useCloudsStore();
  const { isRTL } = useI18n();

  React.useLayoutEffect(() => {
    const unsubscribeClouds = platform.clouds?.onCloudsChange?.(fetchClouds);

    return () => {
      unsubscribeClouds?.();
    };
  }, [platform, fetchClouds]);

  const isHistory = currentPage === "history";

  return (
    <div
      className={`h-[100vh] ${isRTL ? "font-rtl" : ""}`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <main
        id="app"
        className="h-[100vh] bg-[var(--layout-background-color)] flex flex-col"
      >
        <Navigation />
        <div
          className="flex flex-row flex-1"
          style={{ height: "calc(100vh - 56px)" }}
        >
          {isHistory ? <ChatList /> : <div className="w-full">{children}</div>}
        </div>
      </main>
    </div>
  );
};

export { Layout };
