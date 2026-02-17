import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

  // Request interceptor
  api.interceptors.request.use(
    (config) => {
      // Don't add token for login/register routes
      if (config.url.includes('/auth/login') || config.url.includes('/auth/register') || 
          config.url.includes('/candidate-auth/login') || config.url.includes('/candidate-auth/register')) {
        return config;
      }

      // Check if it's a candidate route (candidate-auth, attempts, or reports when candidate is logged in)
      const isCandidateRoute = config.url.includes('/candidate-auth/') || 
                               config.url.includes('/attempts/') || 
                               config.url.includes('/reports/');
      const isTestRoute = config.url.includes('/tests/');
      const isAdminMethod = ['PUT', 'POST', 'DELETE', 'PATCH'].includes(config.method?.toUpperCase());
      const hasCandidateToken = localStorage.getItem('candidate_token');
      
      // For admin operations (PUT/POST/DELETE) on tests, always use admin token
      if (isTestRoute && isAdminMethod) {
        const adminToken = localStorage.getItem('token');
        if (adminToken) {
          config.headers.Authorization = `Bearer ${adminToken}`;
        }
      } 
      // If candidate token exists and it's a candidate route or GET test route, use candidate token
      else if (hasCandidateToken && (isCandidateRoute || (isTestRoute && !isAdminMethod))) {
        config.headers.Authorization = `Bearer ${hasCandidateToken}`;
      } 
      // For candidate routes, try candidate token first, fall back to admin token
      else if (isCandidateRoute) {
        const candidateToken = localStorage.getItem('candidate_token');
        const adminToken = localStorage.getItem('token');
        const token = candidateToken || adminToken;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } 
      // For GET test routes, try candidate token if available, otherwise admin token
      else if (isTestRoute && !isAdminMethod) {
        const candidateToken = localStorage.getItem('candidate_token');
        const adminToken = localStorage.getItem('token');
        const token = candidateToken || adminToken;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      // All other admin routes use admin token
      else {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

// Response interceptor
api.interceptors.response.use(
  (response) => {
    // Return the data directly (which already has success, message, data structure)
    // Backend returns: { success: true/false, message: '...', data: {...} }
    return response.data;
  },
  (error) => {
    // Handle network errors and API errors
    let errorData;
    
    if (error.response) {
      // Server responded with error status
      errorData = error.response.data || { 
        success: false, 
        message: error.response.statusText || 'Request failed'
      };
    } else if (error.request) {
      // Request was made but no response received
      errorData = { 
        success: false, 
        message: 'Network error. Please check your connection and ensure the backend server is running.'
      };
    } else {
      // Something else happened
      errorData = { 
        success: false, 
        message: error.message || 'An unexpected error occurred'
      };
    }
    
    // Don't redirect on 401 for login/register pages
    if (error.response?.status === 401) {
      const path = window.location.pathname;
      // Only redirect if not on login/register pages
      if (!path.includes('/login') && 
          !path.includes('/register') &&
          !path.includes('/test/') &&
          !path.includes('/candidate/') &&
          !path.includes('/dashboard')) {
        // Check if it's candidate or admin
        if (path.includes('/candidate')) {
          localStorage.removeItem('candidate_token');
          window.location.href = '/candidate/login';
        } else {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
      }
    }
    
    // Return error in consistent format
    return Promise.reject(errorData);
  }
);

export default api;

