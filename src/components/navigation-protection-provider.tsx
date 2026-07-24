"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { WifiOff } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { useNetworkStatus } from "@/components/offline/network-status-provider";
import { isOfflineNavigationAllowed } from "@/lib/navigation-protection";

type NavigationProtection = {
  setUnsavedChanges: (dirty: boolean) => void;
};

const NavigationProtectionContext = createContext<NavigationProtection>({
  setUnsavedChanges: () => {},
});

export function useUnsavedChanges(dirty: boolean) {
  const { setUnsavedChanges } = useContext(NavigationProtectionContext);

  useEffect(() => {
    setUnsavedChanges(dirty);
    return () => setUnsavedChanges(false);
  }, [dirty, setUnsavedChanges]);
}

export function NavigationProtectionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { online } = useNetworkStatus();
  const { t } = useLanguage();
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [offlineNavigationBlocked, setOfflineNavigationBlocked] =
    useState(false);

  const updateUnsavedChanges = useCallback((dirty: boolean) => {
    setUnsavedChanges(dirty);
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;

      if (
        !online &&
        !isOfflineNavigationAllowed(pathname, destination.pathname)
      ) {
        event.preventDefault();
        event.stopPropagation();
        setOfflineNavigationBlocked(true);
        return;
      }

      if (
        unsavedChanges &&
        destination.pathname !== pathname &&
        !window.confirm(t("navigation.unsavedChangesConfirm"))
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [online, pathname, t, unsavedChanges]);

  useEffect(() => {
    if (!offlineNavigationBlocked) return;
    const timeout = window.setTimeout(
      () => setOfflineNavigationBlocked(false),
      6_000
    );
    return () => window.clearTimeout(timeout);
  }, [offlineNavigationBlocked]);

  useEffect(() => {
    if (!unsavedChanges) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [unsavedChanges]);

  const value = useMemo(
    () => ({ setUnsavedChanges: updateUnsavedChanges }),
    [updateUnsavedChanges]
  );

  return (
    <NavigationProtectionContext.Provider value={value}>
      {children}
      {offlineNavigationBlocked && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 top-4 z-[70] flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 items-start gap-3 rounded-xl border border-warning/30 bg-white px-4 py-3 text-sm text-foreground shadow-lg"
        >
          <WifiOff
            className="mt-0.5 h-4 w-4 shrink-0 text-warning"
            aria-hidden="true"
          />
          <span>{t("offline.navigationBlocked")}</span>
        </div>
      )}
    </NavigationProtectionContext.Provider>
  );
}
