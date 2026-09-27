/** Transferência de uma proposta comercial para a tela de pedidos. */
export const HANDOFF_KEY = "proposta_to_pedido_v1";

export interface PedidoHandoff {
  cliente: string;
  prazo: string;
  vencimento?: string;
  obs?: string;
  tabela?: string;
  fallbackTabela?: string;
  numeroProposta?: number | null;
  items: { codigo: string; qty: number; unitPrice: number }[];
}

export function setHandoff(h: PedidoHandoff) {
  localStorage.setItem(HANDOFF_KEY, JSON.stringify(h));
}

export function takeHandoff(): PedidoHandoff | null {
  try {
    const raw = localStorage.getItem(HANDOFF_KEY);
    if (!raw) return null;
    localStorage.removeItem(HANDOFF_KEY);
    return JSON.parse(raw) as PedidoHandoff;
  } catch {
    return null;
  }
}
