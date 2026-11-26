/** Petits messages de confirmation, discrets. */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

const Ctx = createContext<(msg: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; key: number } | null>(null);
  const show = useCallback((text: string) => {
    const key = Date.now();
    setMsg({ text, key });
    setTimeout(() => setMsg((m) => (m?.key === key ? null : m)), 3200);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="toast-zone" role="status" aria-live="polite">
        {msg && <div className="toast" key={msg.key}>{msg.text}</div>}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
