import { useEffect, useState } from 'react';

/**
 * Trails `value` by `delay` ms. Used for search boxes so typing a host's
 * name is one request when the person stops, not one per keystroke.
 */
export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
