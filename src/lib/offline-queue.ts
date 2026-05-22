// Fila offline de pedidos. Usa localStorage (suficiente para dezenas de pedidos
// em campo). Cada item é enfileirado e drenado quando a conexão voltar.

import { supabase } from "@/integrations/supabase/client";

const KEY = "pedidos_offline_queue_v1";

export interface QueuedPedido {
  localId: string;            // id local (uuid simples)
  user_id: string;
  nome: string;
  data_pedido: string;
  total: number;
  payload: Record<string, unknown>;
  createdAt: string;          // ISO
  lastError?: string;
}

function read(): QueuedPedido[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedPedido[]) : [];
  } catch {
    return [];
  }
}

function write(q: QueuedPedido[]) {
  localStorage.setItem(KEY, JSON.stringify(q));
  window.dispatchEvent(new CustomEvent("pedidos-queue-change"));
}

export function getQueue(): QueuedPedido[] {
  return read();
}

export function queueSize(): number {
  return read().length;
}

export function enqueuePedido(p: Omit<QueuedPedido, "localId" | "createdAt">): QueuedPedido {
  const item: QueuedPedido = {
    ...p,
    localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  const q = read();
  q.push(item);
  write(q);
  return item;
}

export function removeFromQueue(localId: string) {
  write(read().filter((i) => i.localId !== localId));
}

function markError(localId: string, err: string) {
  const q = read();
  const i = q.find((x) => x.localId === localId);
  if (i) {
    i.lastError = err;
    write(q);
  }
}

let syncing = false;

export interface SyncResult { sent: number; failed: number; remaining: number; }

export async function syncQueue(): Promise<SyncResult> {
  if (syncing) return { sent: 0, failed: 0, remaining: queueSize() };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { sent: 0, failed: 0, remaining: queueSize() };
  }
  syncing = true;
  let sent = 0, failed = 0;
  try {
    const items = read();
    for (const it of items) {
      try {
        const { error } = await supabase.from("pedidos").insert({
          user_id: it.user_id,
          nome: it.nome,
          data_pedido: it.data_pedido,
          total: it.total,
          payload: it.payload as never,
        });
        if (error) throw error;
        removeFromQueue(it.localId);
        sent++;
      } catch (e) {
        markError(it.localId, e instanceof Error ? e.message : String(e));
        failed++;
      }
    }
  } finally {
    syncing = false;
  }
  return { sent, failed, remaining: queueSize() };
}

// Auto-sync ao voltar online (registrado uma vez)
let listenerRegistered = false;
export function registerAutoSync() {
  if (listenerRegistered || typeof window === "undefined") return;
  listenerRegistered = true;
  window.addEventListener("online", () => { void syncQueue(); });
  // Tenta uma sincronização inicial caso a página abra com pedidos pendentes
  if (navigator.onLine) {
    setTimeout(() => { void syncQueue(); }, 1500);
  }
}
