
import { useState, useEffect, Dispatch, SetStateAction } from 'react';

// A custom hook to persist state in localStorage
// Fix: Cannot find namespace 'React'.
// Fix: Cannot find namespace 'React'.
export function usePersistentState<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
    const [state, setState] = useState<T>(() => {
        try {
            const storedValue = window.localStorage.getItem(key);
            // If a value is stored, use it; otherwise, use the initial value.
            if (storedValue) {
                return JSON.parse(storedValue);
            }
            return initialValue;
        } catch (error) {
            console.warn(`Error parsing localStorage key “${key}”. Data might be corrupt. Resetting to initial state.`, error);
            // If parsing fails, the data is corrupt. Remove it to prevent future errors.
            window.localStorage.removeItem(key);
            return initialValue;
        }
    });

    // This effect saves the state to localStorage whenever it changes.
    useEffect(() => {
        try {
            window.localStorage.setItem(key, JSON.stringify(state));
        } catch (error) {
            console.error(`Error setting localStorage key “${key}”:`, error);
        }
    }, [key, state]);

    // This effect listens for changes from other browser tabs to keep the state in sync.
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === key) {
                if (e.newValue) {
                    try {
                        setState(JSON.parse(e.newValue));
                    } catch(error) {
                        console.warn(`Could not parse stored value for ${key} from storage event.`);
                    }
                } else {
                    // Value was removed or cleared in another tab, reset to initial state.
                    setState(initialValue);
                }
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [key, initialValue]);

    return [state, setState];
}

// New custom hook for sessionStorage
// Fix: Cannot find namespace 'React'.
// Fix: Cannot find namespace 'React'.
export function useSessionState<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
    const [state, setState] = useState<T>(() => {
        try {
            const storedValue = window.sessionStorage.getItem(key);
            if (storedValue) {
                return JSON.parse(storedValue);
            }
            return initialValue;
        } catch (error) {
            console.warn(`Error parsing sessionStorage key “${key}”. Resetting to initial state.`, error);
            window.sessionStorage.removeItem(key);
            return initialValue;
        }
    });

    useEffect(() => {
        try {
            if (state === null || state === undefined) {
              window.sessionStorage.removeItem(key);
            } else {
              window.sessionStorage.setItem(key, JSON.stringify(state));
            }
        } catch (error) {
            console.error(`Error setting sessionStorage key “${key}”:`, error);
        }
    }, [key, state]);
    
    return [state, setState];
}
