import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../api/axios";

// The signed-in business's profile, shared so that saving Settings updates the
// header and other screens without a page reload.
const BusinessContext = createContext(null);

export function BusinessProvider({ children }) {
  const [business, setBusiness] = useState(null);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/supplier-info");
      setBusiness(data.supplier);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <BusinessContext.Provider value={{ business, setBusiness, refresh, error }}>
      {children}
    </BusinessContext.Provider>
  );
}

export const useBusiness = () => useContext(BusinessContext);
