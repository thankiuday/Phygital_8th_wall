import { useState } from 'react';

/**
 * useLocalStorage — React hook to sync state with localStorage.
 */
export const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      if (item == null || item === '') return initialValue;
      return JSON.parse(item);
    } catch {
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const val = value instanceof Function ? value(storedValue) : value;
      setStoredValue(val);
      localStorage.setItem(key, JSON.stringify(val));
    } catch (error) {
      console.error(`useLocalStorage set error for key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
};
