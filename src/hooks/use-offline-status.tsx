import { useEffect, useState } from "react";
import { queueSize, registerAutoSync, syncQueue, type SyncResult } from "@/lib/offline-queue";

export function useOfflineStatus() {
  const [online, setOnline] = useState<boolean>(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [pending, setPending] = useState<number>(0);

  useEffect(() => {
    registerAutoSync();
    setPending(queueSize());
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onQueue = () => setPending(queueSize());
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("pedidos-queue-change", onQueue);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("pedidos-queue-change", onQueue);
    };
  }, []);

  async function sync(): Promise<SyncResult> {
    const r = await syncQueue();
    setPending(queueSize());
    return r;
  }

  return { online, pending, sync };
}
