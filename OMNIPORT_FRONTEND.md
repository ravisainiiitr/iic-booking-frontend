# Omniport Frontend Integration Guide for React

This guide provides comprehensive documentation for integrating Omniport authentication into your React application.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Authentication Flow](#authentication-flow)
5. [Implementation Guide](#implementation-guide)
6. [API Reference](#api-reference)
7. [Components](#components)
8. [Hooks](#hooks)
9. [State Management](#state-management)
10. [Error Handling](#error-handling)
11. [Best Practices](#best-practices)
12. [Troubleshooting](#troubleshooting)

## Overview

Omniport uses OAuth 2.0 authorization code flow for authentication. The React application interacts with your Django backend, which handles the OAuth flow with Omniport.

### Architecture

```
React App → Django Backend → Omniport OAuth Server
     ↑                              ↓
     └────────── Token ─────────────┘
```

1. User clicks "Login with Omniport" in React
2. React requests authorization URL from Django backend
3. User is redirected to Omniport login page
4. After login, Omniport redirects back to React app with authorization code
5. React sends code to Django backend
6. Django exchanges code for token and returns Django auth token
7. React stores token and uses it for authenticated requests

## Prerequisites

- React 16.8+ (for hooks support)
- React Router (for navigation)
- Axios or Fetch API (for HTTP requests)
- A running Django backend with Omniport integration

## Installation

### 1. Install Dependencies

```bash
npm install axios react-router-dom
# or
yarn add axios react-router-dom
```

### 2. Environment Configuration

Create a `.env` file in your React project root:

```env
REACT_APP_API_BASE_URL=http://127.0.0.1:8000
REACT_APP_OMNIPORT_REDIRECT_URI=http://localhost:3000/auth/callback
```

## Authentication Flow

### Step-by-Step Flow

```
┌─────────────┐
│  React App  │
└──────┬──────┘
       │ 1. GET /api/auth/omniport/authorize/
       ▼
┌─────────────┐
│Django Backend│
└──────┬──────┘
       │ 2. Returns auth_url + state
       ▼
┌─────────────┐
│  React App  │
└──────┬──────┘
       │ 3. Redirect to auth_url
       ▼
┌─────────────┐
│  Omniport   │
│  Login Page │
└──────┬──────┘
       │ 4. User logs in
       │ 5. Redirect with code
       ▼
┌─────────────┐
│  React App  │
│  /auth/callback
└──────┬──────┘
       │ 6. POST /api/auth/omniport/callback/
       │    { code, state }
       ▼
┌─────────────┐
│Django Backend│
└──────┬──────┘
       │ 7. Exchanges code for token
       │ 8. Returns { token, user }
       ▼
┌─────────────┐
│  React App  │
│  Stores token
└─────────────┘
```

## Implementation Guide

### 1. API Service Layer

Create an API service to handle all backend communication:

```javascript
// src/services/api.js
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000';

// Create axios instance
const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Token ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 errors (unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Omniport Auth API
export const omniportAuth = {
  // Get authorization URL
  getAuthUrl: async (redirectUri = null) => {
    const params = redirectUri ? { redirect_uri: redirectUri } : {};
    const response = await api.get('/auth/omniport/authorize/', { params });
    return response.data;
  },

  // Exchange code for token
  exchangeCode: async (code, state) => {
    const response = await api.post('/auth/omniport/callback/', {
      code,
      state,
    });
    return response.data;
  },
};

// User API
export const userApi = {
  // Get current user
  getCurrentUser: async () => {
    const response = await api.get('/users/me/');
    return response.data;
  },

  // Update user
  updateUser: async (data) => {
    const response = await api.patch('/users/me/', data);
    return response.data;
  },
};

export default api;
```

### 2. Authentication Context

Create a context to manage authentication state:

```javascript
// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { omniportAuth, userApi } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      // Optionally verify token by fetching user
      verifyToken(storedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async (tokenToVerify) => {
    try {
      const userData = await userApi.getCurrentUser();
      setUser(userData);
      setLoading(false);
    } catch (error) {
      // Token invalid, clear storage
      logout();
    }
  };

  const login = async (redirectUri = null) => {
    try {
      const { auth_url, state } = await omniportAuth.getAuthUrl(redirectUri);
      // Store state for verification
      localStorage.setItem('omniport_state', state);
      // Redirect to Omniport
      window.location.href = auth_url;
    } catch (error) {
      console.error('Login initiation failed:', error);
      throw error;
    }
  };

  const handleCallback = async (code, state) => {
    try {
      const storedState = localStorage.getItem('omniport_state');
      
      // Verify state
      if (state !== storedState) {
        throw new Error('Invalid state token');
      }

      const { token: newToken, user: userData } = await omniportAuth.exchangeCode(code, state);
      
      // Store token and user
      localStorage.setItem('auth_token', newToken);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.removeItem('omniport_state');
      
      setToken(newToken);
      setUser(userData);
      
      return { token: newToken, user: userData };
    } catch (error) {
      console.error('Callback handling failed:', error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    localStorage.removeItem('omniport_state');
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token,
    login,
    handleCallback,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

### 3. Login Component

```javascript
// src/components/LoginButton.jsx
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const LoginButton = () => {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const redirectUri = process.env.REACT_APP_OMNIPORT_REDIRECT_URI;
      await login(redirectUri);
    } catch (err) {
      setError(err.message || 'Failed to initiate login');
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
      <button
        onClick={handleLogin}
        disabled={loading}
        className="login-button"
      >
        {loading ? 'Loading...' : 'Login with Omniport'}
      </button>
    </div>
  );
};

export default LoginButton;
```

### 4. Callback Handler Component

```javascript
// src/components/CallbackHandler.jsx
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const CallbackHandler = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleCallback } = useAuth();
  const [status, setStatus] = useState('processing'); // processing, success, error
  const [error, setError] = useState(null);

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');

      // Handle OAuth errors
      if (errorParam) {
        setStatus('error');
        setError(errorParam);
        return;
      }

      if (!code) {
        setStatus('error');
        setError('No authorization code received');
        return;
      }

      try {
        await handleCallback(code, state);
        setStatus('success');
        // Redirect to dashboard after short delay
        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);
      } catch (err) {
        setStatus('error');
        setError(err.message || 'Authentication failed');
      }
    };

    processCallback();
  }, [searchParams, handleCallback, navigate]);

  if (status === 'processing') {
    return (
      <div className="callback-container">
        <div className="spinner" />
        <p>Completing authentication...</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="callback-container error">
        <h2>Authentication Failed</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/login')}>
          Return to Login
        </button>
      </div>
    );
  }

  return (
    <div className="callback-container success">
      <h2>Authentication Successful!</h2>
      <p>Redirecting to dashboard...</p>
    </div>
  );
};

export default CallbackHandler;
```

### 5. Protected Route Component

```javascript
// src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
```

### 6. App Setup

```javascript
// src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginButton from './components/LoginButton';
import CallbackHandler from './components/CallbackHandler';
import Dashboard from './components/Dashboard';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginButton />} />
          <Route path="/auth/callback" element={<CallbackHandler />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
```

## API Reference

### GET `/api/auth/omniport/authorize/`

Get Omniport authorization URL.

**Query Parameters:**
- `redirect_uri` (optional): Custom redirect URI

**Response:**
```json
{
  "auth_url": "https://omniport.iicbooking.in/oauth/authorize/?...",
  "state": "random_state_token"
}
```

### POST `/api/auth/omniport/callback/`

Exchange authorization code for Django auth token.

**Request Body:**
```json
{
  "code": "authorization_code",
  "state": "state_token"
}
```

**Response:**
```json
{
  "token": "django_auth_token",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "User Name"
  }
}
```

## Hooks

### useAuth Hook

```javascript
const {
  user,              // Current user object
  token,              // Auth token
  loading,            // Loading state
  isAuthenticated,    // Boolean: is user logged in
  login,              // Function to initiate login
  handleCallback,     // Function to handle OAuth callback
  logout,             // Function to logout
} = useAuth();
```

### Custom Hook Example: useRequireAuth

```javascript
// src/hooks/useRequireAuth.js
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const useRequireAuth = () => {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, loading, navigate]);

  return { isAuthenticated, loading };
};
```

## State Management

### Using Redux (Optional)

```javascript
// src/store/authSlice.js
import { createSlice } from '@reduxjs/toolkit';

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    token: localStorage.getItem('auth_token'),
    isAuthenticated: !!localStorage.getItem('auth_token'),
  },
  reducers: {
    setCredentials: (state, action) => {
      const { user, token } = action.payload;
      state.user = user;
      state.token = token;
      state.isAuthenticated = true;
      localStorage.setItem('auth_token', token);
      localStorage.setItem('user', JSON.stringify(user));
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
```

## Error Handling

### Error Types

1. **Network Errors**: Connection issues, timeout
2. **Authentication Errors**: Invalid token, expired session
3. **OAuth Errors**: Invalid code, state mismatch
4. **Server Errors**: 500, 502, 503

### Error Handler Component

```javascript
// src/components/ErrorBoundary.jsx
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => window.location.reload()}>
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

## Best Practices

### 1. Token Storage

**Option A: localStorage (Current Implementation)**
- ✅ Simple to implement
- ✅ Persists across sessions
- ⚠️ Vulnerable to XSS attacks

**Option B: httpOnly Cookies (Recommended for Production)**
```javascript
// Backend should set httpOnly cookies
// Frontend doesn't need to manually handle tokens
```

### 2. Token Refresh

Implement token refresh if your backend supports it:

```javascript
// src/services/api.js
let refreshTokenPromise = null;

const refreshToken = async () => {
  if (refreshTokenPromise) {
    return refreshTokenPromise;
  }

  refreshTokenPromise = api.post('/auth/refresh/')
    .then((response) => {
      const { token } = response.data;
      localStorage.setItem('auth_token', token);
      return token;
    })
    .finally(() => {
      refreshTokenPromise = null;
    });

  return refreshTokenPromise;
};

// Use in interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      try {
        await refreshToken();
        // Retry original request
        return api.request(error.config);
      } catch {
        // Refresh failed, logout
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
```

### 3. Loading States

Always show loading indicators during authentication:

```javascript
const { loading } = useAuth();

if (loading) {
  return <LoadingSpinner />;
}
```

### 4. Error Messages

Provide user-friendly error messages:

```javascript
const getErrorMessage = (error) => {
  if (error.response?.status === 401) {
    return 'Your session has expired. Please login again.';
  }
  if (error.response?.status === 403) {
    return 'You do not have permission to perform this action.';
  }
  if (error.response?.status >= 500) {
    return 'Server error. Please try again later.';
  }
  return error.message || 'An unexpected error occurred.';
};
```

## Troubleshooting

### Issue: State Token Mismatch

**Symptom:** "Invalid or expired state token" error

**Solutions:**
- Ensure state is stored before redirect
- Complete OAuth flow within 10 minutes
- Check localStorage is not cleared during redirect

### Issue: CORS Errors

**Symptom:** CORS policy errors in browser console

**Solutions:**
- Verify React app URL is in `CORS_ALLOWED_ORIGINS`
- Check backend CORS configuration
- Ensure credentials are included in requests

### Issue: Token Not Persisting

**Symptom:** User logged out on page refresh

**Solutions:**
- Check localStorage is enabled
- Verify token is saved correctly
- Check for localStorage quota issues

### Issue: Infinite Redirect Loop

**Symptom:** App keeps redirecting between login and callback

**Solutions:**
- Check callback route configuration
- Verify state validation logic
- Ensure error handling doesn't cause loops

## Complete Example Project Structure

```
src/
├── components/
│   ├── LoginButton.jsx
│   ├── CallbackHandler.jsx
│   ├── ProtectedRoute.jsx
│   ├── ErrorBoundary.jsx
│   └── Dashboard.jsx
├── contexts/
│   └── AuthContext.jsx
├── hooks/
│   └── useRequireAuth.js
├── services/
│   └── api.js
├── utils/
│   └── errorHandler.js
├── App.jsx
└── index.js
```

## Additional Resources

- [React Router Documentation](https://reactrouter.com/)
- [Axios Documentation](https://axios-http.com/)
- [OAuth 2.0 Specification](https://oauth.net/2/)
- [Django REST Framework Authentication](https://www.django-rest-framework.org/api-guide/authentication/)

