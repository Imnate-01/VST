"use client";

import { createContext, useContext, useEffect, useState } from "react";

type NetworkStatus = {
  /** true si el navegador reporta conexión. No garantiza alcanzar el servidor. */
  online: boolean;
};

const NetworkStatusContext = createContext<NetworkStatus>({ online: true });

export function useNetworkStatus(): NetworkStatus {
  return useContext(NetworkStatusContext);
}

export function NetworkStatusProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Se asume online en el primer render (SSR) para no parpadear el banner.
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <NetworkStatusContext.Provider value={{ online }}>
      {children}
    </NetworkStatusContext.Provider>
  );
}
