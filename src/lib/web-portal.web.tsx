import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function WebPortal({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    setHost(element);
    return () => {
      element.remove();
    };
  }, []);

  if (!host) {
    return null;
  }
  return createPortal(children, host);
}
