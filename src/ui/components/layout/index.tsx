import React from "react";
import { useI18n } from "../../providers/LocalesProvider";
import { usePlatform } from "../../providers/PlatformProvider/context";
import { useStores } from "../../store/context";
import { ChatList } from "./sub-components/ChatList";
import { Navigation } from "./sub-components/Header";

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { useRouter, useCloudsStore } = useStores();
  const currentPage = useRouter((s) => s.currentPage);
  const platform = usePlatform();
  const fetchClouds = useCloudsStore((s) => s.fetchClouds);
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
      data-testid="ai-chat-root"
      className={`aui-root flex h-full min-h-0 flex-col ${isRTL ? "font-rtl" : ""}`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <main
        id="app"
        className="flex min-h-0 flex-1 flex-col bg-[var(--layout-background-color)]"
      >
        <Navigation />
        {/* `min-h-0` keeps this row bounded by the host's height instead of
            the browser viewport: the widget is embedded (DocSpace panel,
            plugin, iframe) as often as it is full-page, and a `100vh`
            measurement there oversizes the scroll viewport — which the
            thread's viewport-sized spacers then amplify into blank gaps. */}
        <div className="flex min-h-0 flex-1 flex-row">
          {isHistory ? (
            <ChatList />
          ) : (
            <div className="flex min-h-0 w-full flex-col">{children}</div>
          )}
        </div>
      </main>
    </div>
  );
};

export { Layout };
