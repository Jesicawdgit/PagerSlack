import { createContext, useEffect, useState } from 'react';
import * as authApi from '../api/authApi';

// eslint-disable-next-line react-refresh/only-export-components -- useAuth.js needs the raw context
export const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi
      .me()
      .then((res) => setUser(res.data.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(credentials) {
    const res = await authApi.login(credentials);
    setUser(res.data.data.user);
    return res.data.data.user;
  }

  async function register(fields) {
    const res = await authApi.register(fields);
    setUser(res.data.data.user);
    return res.data.data.user;
  }

  async function logout() {
    await authApi.logout();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
