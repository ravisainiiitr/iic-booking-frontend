// API client for Django REST API
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    // Load token from localStorage on initialization
    this.token = localStorage.getItem('auth_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Token ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          error: data.detail || data.message || `HTTP error! status: ${response.status}`,
        };
      }

      return { data: data as T };
    } catch (error: any) {
      return {
        error: error.message || 'Network error occurred',
      };
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  getToken(): string | null {
    // Always check localStorage to ensure we have the latest token
    // This handles cases where token was set directly in localStorage
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken !== this.token) {
      this.token = storedToken;
    }
    return this.token;
  }

  // Auth endpoints
  // Omniport OAuth
  async getOmniportAuthUrl(redirectUri?: string) {
    const params = redirectUri ? `?redirect_uri=${encodeURIComponent(redirectUri)}` : '';
    const url = `${this.baseURL}/auth/omniport/authorize/${params}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          error: data.detail || data.message || `HTTP error! status: ${response.status}`,
        };
      }

      return { data: data as { auth_url: string; state: string } };
    } catch (error: any) {
      return {
        error: error.message || 'Network error occurred',
      };
    }
  }

  async exchangeOmniportCode(code: string, state: string) {
    const response = await this.request<{ token: string; user: any }>('/auth/omniport/callback/', {
      method: 'POST',
      body: JSON.stringify({ code, state }),
    });

    if (response.data?.token) {
      this.setToken(response.data.token);
      // Store user data if provided
      if (response.data.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
    }

    return response;
  }

  async signUp(
    email: string, 
    password: string,
    password_confirm: string,
    name: string,
    user_type: "student" | "faculty" | "external",
    emp_id: string,
    phone_number: string | undefined,
    department: number
  ) {
    const response = await this.request<{ token: string; user: any }>('/auth/register/', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        password_confirm,
        name,
        user_type,
        emp_id,
        phone_number: phone_number || undefined,
        department,
      }),
    });

    if (response.data?.token) {
      this.setToken(response.data.token);
      // Store user data if provided
      if (response.data.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
    }

    return response;
  }

  async signIn(email: string, password: string) {
    const response = await this.request<{ token: string; user: any }>('/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.data?.token) {
      this.setToken(response.data.token);
      // Store user data if provided
      if (response.data.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
    }

    return response;
  }

  async signOut() {
    this.setToken(null);
    localStorage.removeItem('user');
    return Promise.resolve({ data: { success: true } });
  }

  async getCurrentUser() {
    return this.request<any>('/auth/user/');
  }

  // Profile endpoints
  // Note: getProfile is deprecated, use getCurrentUser() instead
  // Keeping for backward compatibility but redirects to getCurrentUser
  async getProfile(userId?: string) {
    if (userId) {
      // For other users, use users endpoint
      return this.request<any>(`/users/${userId}/`);
    }
    // For current user, use auth/user endpoint
    return this.getCurrentUser();
  }

  async updateProfile(data: {
    name?: string;
    user_type?: string;
    emp_id?: string;
    phone_number?: string;
    profile_picture?: string;
    department?: number | null;
  }) {
    // Get current user ID first
    const userResponse = await this.getCurrentUser();
    if (userResponse.error || !userResponse.data?.id) {
      return { error: 'Unable to get user ID' };
    }
    
    // Use /api/users/{user_id}/ for PATCH
    return this.request<any>(`/users/${userResponse.data.id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Equipment endpoints
  async getEquipment() {
    return this.request<any[]>('/equipment/');
  }

  async getEquipmentById(id: string) {
    return this.request<any>(`/equipment/${id}/`);
  }

  async updateEquipment(id: string, data: any) {
    return this.request<any>(`/equipment/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Booking endpoints
  async getBookings(userId?: string) {
    const endpoint = userId ? `/bookings/?user_id=${userId}` : '/bookings/';
    return this.request<any[]>(endpoint);
  }

  async createBooking(data: {
    equipment_id: string;
    start_time: string;
    end_time: string;
    total_hours: number;
    total_cost: number;
    status?: string;
  }) {
    return this.request<any>('/bookings/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateBooking(id: string, data: any) {
    return this.request<any>(`/bookings/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Wallet endpoints
  async getWallet() {
    return this.request<{
      wallet: {
        id: number;
        user: number;
        balance: string;
        created_at: string;
        updated_at: string;
        transactions: Array<{
          id: number;
          transaction_type: "credit" | "debit";
          amount: string;
          description: string;
          created_at: string;
        }>;
      };
      recent_transactions: Array<{
        id: number;
        transaction_type: "credit" | "debit";
        amount: string;
        description: string;
        created_at: string;
      }>;
    }>('/wallets/me/');
  }

  async getWalletBalance() {
    return this.request<{ balance: string }>('/wallets/me/balance/');
  }

  async creditWallet(amount: number, description?: string) {
    return this.request<{
      wallet: {
        id: number;
        user: number;
        balance: string;
        created_at: string;
        updated_at: string;
      };
      transaction: any;
    }>('/wallets/me/credit/', {
      method: 'POST',
      body: JSON.stringify({ amount, description }),
    });
  }

  async debitWallet(amount: number, description?: string) {
    return this.request<{
      wallet: {
        id: number;
        user: number;
        balance: string;
        created_at: string;
        updated_at: string;
      };
      transaction: any;
    }>('/wallets/me/debit/', {
      method: 'POST',
      body: JSON.stringify({ amount, description }),
    });
  }

  async getWalletTransactions() {
    return this.request<{
      transactions: any[];
      count: number;
      total_count: number;
      limit: number;
      offset: number;
    }>('/wallets/me/transactions/');
  }

  // User roles endpoints
  async getUserRoles(userId?: string) {
    const endpoint = userId ? `/user-roles/?user_id=${userId}` : '/user-roles/';
    return this.request<any[]>(endpoint);
  }

  async checkAdminRole(userId: string) {
    return this.request<any>(`/user-roles/check-admin/?user_id=${userId}`);
  }

  // User management endpoints (admin only)
  async getUsers() {
    return this.request<any[]>('/users/');
  }

  // Department endpoints
  async getDepartments() {
    return this.request<{ departments: Array<{ id: number; name: string; code: string }>; count: number }>('/departments/');
  }

  async createUser(data: {
    email: string;
    password: string;
    full_name: string;
    role: string;
  }) {
    return this.request<any>('/users/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUser(id: string, data: { full_name?: string; role?: string }) {
    return this.request<any>(`/users/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Notification endpoints
  async getNotifications() {
    return this.request<Array<{
      id: number;
      title: string;
      message: string;
      type: "booking" | "system" | "warning" | "info";
      read: boolean;
      created_at: string;
      link?: string;
    }>>('/notifications/');
  }

  async markNotificationAsRead(id: number) {
    return this.request<any>(`/notifications/${id}/mark-read/`, {
      method: 'POST',
    });
  }

  async markAllNotificationsAsRead() {
    return this.request<any>('/notifications/mark-all-read/', {
      method: 'POST',
    });
  }

  async deleteNotification(id: number) {
    return this.request<any>(`/notifications/${id}/`, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);

