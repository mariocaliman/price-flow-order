import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed";

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Hide if already installed
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari
      window.navigator.standalone === true;
    if (standalone) return;

    // Hide if dismissed recently (7 days)
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt && Date.now() - Number(dismissedAt) < 7 * 24 * 60 * 60 * 1000) return;

    const ua = window.navigator.userAgent;
    const iOS = /iPhone|iPad|iPod/i.test(ua) && !/CriOS|FxiOS/.test(ua);
    if (iOS) {
      setIsIOS(true);
      setShow(true);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setShow(false));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setShow(false);
  };

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[min(420px,calc(100vw-1rem))] -translate-x-1/2 rounded-xl border border-border bg-card p-4 shadow-2xl">
      <button
        onClick={dismiss}
        aria-label="Fechar"
        className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-accent"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex gap-3">
        <img
          src="/icon-192.png"
          alt="Logo"
          width={48}
          height={48}
          className="h-12 w-12 rounded-lg shadow-sm"
        />
        <div className="flex-1 pr-4">
          <p className="text-sm font-semibold text-foreground">Instalar o app</p>
          {isIOS ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Toque em <Share className="inline h-3 w-3" /> Compartilhar e depois em{" "}
              <span className="font-medium">"Adicionar à Tela de Início"</span>.
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Instale no seu dispositivo para acesso rápido em tela cheia.
            </p>
          )}
          {!isIOS && (
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={install} className="h-8">
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Instalar
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss} className="h-8">
                Agora não
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
