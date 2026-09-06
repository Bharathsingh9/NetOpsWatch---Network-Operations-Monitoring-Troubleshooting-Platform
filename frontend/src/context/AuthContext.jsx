import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('netopswatch_token'));
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('netopswatch_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleUnauthorized = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  useEffect(() => {
    async function verifyUser() {
      if (token) {
        try {
          const userData = await api.getMe();
          setUser(userData);
          localStorage.setItem('netopswatch_user', JSON.stringify(userData));
        } catch (err) {
          console.error('Session validation failed:', err);
          setToken(null);
          setUser(null);
          localStorage.removeItem('netopswatch_token');
          localStorage.removeItem('netopswatch_user');
        }
      }
      setLoading(false);
    }
    verifyUser();
  }, [token]);

  const login = async (username, password) => {
    const data = await api.login(username, password);
    setToken(data.access_token);
    setUser(data.user);
    localStorage.setItem('netopswatch_token', data.access_token);
    localStorage.setItem('netopswatch_user', JSON.stringify(data.user));
    return data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('netopswatch_token');
    localStorage.removeItem('netopswatch_user');
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, loading, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
