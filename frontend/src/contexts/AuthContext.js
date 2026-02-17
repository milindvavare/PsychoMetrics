import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      loadUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const loadUser = async () => {
    try {
      const response = await api.get('/auth/me');
      if (response.success) {
        setUser(response.data);
      }
    } catch (error) {
      console.error('Load user error:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, companyId) => {
    try {
      console.log('Attempting login for:', email, 'Company ID:', companyId);
      
      const response = await api.post('/auth/login', {
        email: email.trim(),
        password: password,
        company_id: companyId || undefined
      });

      console.log('Login response:', response);

      // Response from API interceptor is already response.data
      // Backend returns: { success: true, message: '...', data: { token, user } }
      if (response && response.success) {
        // Extract token and user from response.data
        const token = response.data?.token;
        const user = response.data?.user;
        
        if (token) {
          localStorage.setItem('token', token);
          setToken(token);
          setUser(user);
          console.log('Login successful, token stored');
          return { success: true };
        } else {
          console.error('Token missing in response:', response);
          return { success: false, message: response.message || 'Token not received' };
        }
      } else {
        console.error('Login failed, response:', response);
        return { success: false, message: response?.message || 'Login failed. Please check your credentials.' };
      }
    } catch (error) {
      console.error('Login error details:', error);
      // Extract error message from different error formats
      // The API interceptor returns errorData as { success: false, message: '...' }
      let errorMessage = 'Login failed. Please check your credentials.';
      
      // Check if error is an object with message property (from API interceptor)
      if (error && typeof error === 'object') {
        if (error.message) {
          errorMessage = error.message;
        } else if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
        } else if (error.error) {
          errorMessage = error.error;
        }
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      console.error('Final error message:', errorMessage);
      return { success: false, message: errorMessage };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    isAuthenticated: !!token && !!user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

