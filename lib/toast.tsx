"use client";

import { createContext, useContext, useState, useCallback } from "react";

type ToastType = "success" | "error" | "info";

interface Toast    { id: number; message: string; type: ToastType; }
interface ToastCtx { toast: (msg: string, type?: ToastType) => void; }

const Ctx = createContext<ToastCtx>({ toast: () => {} });
let uid = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++uid;
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  }, []);

  const styles: Record<ToastType, string> = {
    success: "border-green-500/40 bg-green-500/10 text-green-400",
    error:   "border-red-400/40   bg-red-500/10   text-red-400",
    info:    "border-accent/40    bg-accent/10    text-accent",
  };
  const icons: Record<ToastType, string> = { success: "✓", error: "✕", info: "·" };

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      {/* Always rendered — no hydration issue since toasts[] starts empty on both server & client */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 w-full max-w-xs px-4 sm:px-0 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-xl
              backdrop-blur-sm font-body text-sm pointer-events-auto
              animate-fade-up ${styles[t.type]}`}
            style={{ animationFillMode: "forwards" }}>
            <span className="font-mono font-bold shrink-0 mt-0.5">{icons[t.type]}</span>
            <span className="text-text leading-snug">{t.message}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() { return useContext(Ctx); }
