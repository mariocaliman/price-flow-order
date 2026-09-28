import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import logo from "@/assets/rioquimica-logo.jpeg";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const hdrBtn =
  "px-3 py-2 text-xs sm:text-sm rounded-md border border-border hover:bg-muted transition disabled:opacity-50";
export const hdrBtnPrimary =
  "px-3 py-2 text-xs sm:text-sm font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50 shadow-sm";

const navBase =
  "px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition inline-flex items-center gap-1.5";

export function AppHeader({
  title,
  subtitle,
  current,
  actions,
  extra,
}: {
  title: string;
  subtitle?: string;
  current: "pedidos" | "propostas" | "admin" | "perfil";
  actions?: ReactNode;
  extra?: ReactNode;
}) {
  const auth = useAuth();
  const navigate = useNavigate();
  const nome = auth.nome || auth.user?.email?.split("@")[0] || "";
  const inicial = (nome || "?").trim().charAt(0).toUpperCase();

  const cls = (k: string) =>
    `${navBase} ${
      current === k
        ? "bg-primary/10 text-primary"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`;

  return (
    <header className="border-b border-border bg-card sticky top-0 z-30">
      <div className="max-w-[1500px] mx-auto px-3 sm:px-6 py-2.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <img src={logo} alt="Rioquímica" className="w-9 h-9 shrink-0 rounded-md object-contain" />
          <div className="min-w-0 shrink-0 max-w-[220px] sm:max-w-[280px]">
            <h1 className="font-bold leading-tight text-sm sm:text-base truncate">{title}</h1>
            {subtitle && (
              <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
          <nav className="hidden md:flex items-center gap-1 ml-3 pl-3 border-l border-border shrink-0">
            <Link to="/" className={cls("pedidos")}>
              <span aria-hidden>📋</span> Pedidos
            </Link>
            <Link to="/propostas" className={cls("propostas")}>
              <span aria-hidden>📄</span> Propostas
            </Link>
            {auth.isAdmin && (
              <Link to="/admin" className={cls("admin")}>
                <span aria-hidden>⚙</span> Admin
              </Link>
            )}
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {extra}
          {actions}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-border hover:bg-muted transition"
                title="Minha conta"
              >
                <span className="w-7 h-7 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-bold">
                  {inicial}
                </span>
                <span className="hidden sm:inline text-xs max-w-[120px] truncate">{nome}</span>
                <span aria-hidden className="text-[10px] text-muted-foreground">▾</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="leading-tight">
                <div className="truncate">{nome || "Usuário"}</div>
                <div className="text-[11px] font-normal text-muted-foreground truncate">
                  {auth.user?.email}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/">📋 Pedidos</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/propostas">📄 Propostas Comerciais</Link>
              </DropdownMenuItem>
              {auth.isAdmin && (
                <>
                  <DropdownMenuItem asChild>
                    <Link to="/admin">⚙ Painel Admin</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/admin/dashboard">📊 Dashboard</Link>
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/perfil">👤 Meu perfil</Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={async () => {
                  await supabase.auth.signOut();
                  navigate({ to: "/login" });
                }}
              >
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Navegação mobile */}
      <div className="md:hidden border-t border-border px-3 py-1.5 flex items-center gap-1 overflow-x-auto">
        <Link to="/" className={cls("pedidos")}>📋 Pedidos</Link>
        <Link to="/propostas" className={cls("propostas")}>📄 Propostas</Link>
        {auth.isAdmin && <Link to="/admin" className={cls("admin")}>⚙ Admin</Link>}
        <Link to="/perfil" className={cls("perfil")}>👤 Perfil</Link>
      </div>
    </header>
  );
}

const STATUS_CLS: Record<string, string> = {
  rascunho: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  enviada: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  aprovada: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  recusada: "bg-destructive/10 text-destructive border-destructive/30",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span
      className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${
        STATUS_CLS[status] ?? "bg-muted text-muted-foreground border-border"
      }`}
    >
      {label ?? status}
    </span>
  );
}
