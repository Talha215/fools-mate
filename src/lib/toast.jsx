import { useEffect, useState } from 'react';

let push = () => {};
export const toast = (msg) => push(msg);

export function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    let n = 0;
    push = (msg) => {
      const id = ++n;
      setItems((xs) => [...xs, { id, msg }]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 3200);
    };
    return () => {
      push = () => {};
    };
  }, []);
  return (
    <div className="toasts" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="toast">{t.msg}</div>
      ))}
    </div>
  );
}
