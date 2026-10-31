import { useState, useCallback, useEffect } from 'react';
import type { UserPOV } from '../types/api';

export function usePOV() {
  const [pov, setPovState] = useState<UserPOV | null>(() => {
    const saved = localStorage.getItem('cyberforge_pov');
    if (saved === 'admin' || saved === 'normal' || saved === 'demo') {
      return saved as UserPOV;
    }
    return null;
  });

  const setPOV = useCallback((newPov: UserPOV | null) => {
    if (newPov) {
      localStorage.setItem('cyberforge_pov', newPov);
    } else {
      localStorage.removeItem('cyberforge_pov');
      localStorage.removeItem('cyberforge_admin_token');
    }
    setPovState(newPov);
  }, []);

  useEffect(() => {
    const handleStorage = () => {
      const saved = localStorage.getItem('cyberforge_pov');
      if (saved === 'admin' || saved === 'normal' || saved === 'demo') {
        setPovState(saved as UserPOV);
      } else {
        setPovState(null);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return { pov, setPOV };
}
