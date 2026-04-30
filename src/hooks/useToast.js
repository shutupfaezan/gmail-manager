import { useState, useCallback } from 'react';

export function useToast() {
    const [toasts, setToasts] = useState([]);

    const add = useCallback((msg, type = 'success') => {
        const id = Date.now();
        setToasts(t => [{ id, msg, type, out: false }, ...t]);
        setTimeout(() => {
            setToasts(t => t.map(x => x.id === id ? { ...x, out: true } : x));
            setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 300);
        }, 3800);
    }, []);

    return { toasts, add };
}
