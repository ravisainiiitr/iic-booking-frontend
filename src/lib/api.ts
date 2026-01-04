// API client for Django REST API
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[] | string>; // For field-specific errors like {"email": ["..."]}
}

interface User {
  id: number;
  email: string;
  name: string;
  user_type: number; // Changed from string to number
  emp_id?: string | null;
  phone_number?: string | null;
  profile_picture?: string | null;
  department?: number;
  department_code?: string;
  can_have_wallet?: boolean;
  // Optional fields that may be present in some responses
  department_name?: string;
  supervisor?: number | null;
  uses_admin_panel?: boolean;
  uses_react_app?: boolean;
  uses_omniport_auth?: boolean;
  uses_email_auth?: boolean;
  url?: string;
  is_active?: boolean;
  email_verified?: boolean;
  admin_approved?: boolean;
}

interface AuthResponse {
  token: string;
  user: User;
}

interface RegisterResponse {
  message?: string;
  token: string | null;
  user: User;
}

interface EmailVerificationError {
  error: string;
  message: string;
  email_verified: boolean;
  admin_approved: boolean;
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
        // Handle field-specific errors (e.g., {"email": ["A user with this email already exists."]})
        const fieldErrors: Record<string, string[] | string> = {};
        let hasFieldErrors = false;
        
        if (typeof data === 'object' && data !== null) {
          for (const [field, messages] of Object.entries(data)) {
            // Skip common error fields that are not field-specific, but include email_verified and admin_approved
            if (field === 'detail' || (field === 'message' && !data.email_verified)) {
              continue;
            }
            
            // Handle email verification error structure
            if (field === 'email_verified' || field === 'admin_approved') {
              fieldErrors[field] = String(messages);
              hasFieldErrors = true;
            } else if (Array.isArray(messages) && messages.length > 0) {
              fieldErrors[field] = messages;
              hasFieldErrors = true;
            } else if (typeof messages === 'string') {
              fieldErrors[field] = messages;
              hasFieldErrors = true;
            }
          }
        }
        
        // If we have field-specific errors, return them
        if (hasFieldErrors) {
          // Check if we have email_verified or admin_approved fields - these need special handling
          const errorData = data as any;
          if (fieldErrors.email_verified || fieldErrors.admin_approved) {
            // For email verification/pending approval errors, use the error or message field
            return {
              error: errorData.error || errorData.message || `HTTP error! status: ${response.status}`,
              fieldErrors: {
                ...fieldErrors,
                email_verified: String(errorData.email_verified ?? ''),
                admin_approved: String(errorData.admin_approved ?? ''),
                message: errorData.message || errorData.error,
              },
            };
          }
          
          // Get the first error message from field errors
          const firstFieldError = Object.values(fieldErrors)[0];
          const firstErrorMessage = Array.isArray(firstFieldError) 
            ? firstFieldError[0] 
            : firstFieldError;
          
          return {
            error: firstErrorMessage || `HTTP error! status: ${response.status}`,
            fieldErrors: fieldErrors,
          };
        }
        
        // Otherwise, return standard error
        // Check if it's an email verification or pending approval error with structured response
        const errorData = data as any;
        if (errorData.error && (
          errorData.email_verified === false || 
          errorData.error.includes("Email not verified") ||
          errorData.error.includes("pending approval") ||
          errorData.error.includes("Account pending approval") ||
          (errorData.email_verified === true && errorData.admin_approved === false)
        )) {
          return {
            error: errorData.error || errorData.message || `HTTP error! status: ${response.status}`,
            fieldErrors: {
              ...fieldErrors,
              email_verified: String(errorData.email_verified ?? ''),
              admin_approved: String(errorData.admin_approved ?? ''),
              message: errorData.message || errorData.error,
            },
          };
        }
        
        return {
          error: data.detail || data.message || data.error || `HTTP error! status: ${response.status}`,
          fieldErrors: Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
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
  async getOmniportAuthUrl() {
    // Remove trailing slash from baseURL if present, then add the endpoint
    const baseUrl = this.baseURL.endsWith('/') ? this.baseURL.slice(0, -1) : this.baseURL;
    // Django REST framework typically uses trailing slashes
    const url = `${baseUrl}/auth/omniport/authorize/`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        redirect: 'manual', // Don't automatically follow redirects
      });

      // Check if response is a redirect (3xx status)
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('Location');
        return {
          error: `Backend returned a redirect (${response.status}) to ${location || 'unknown location'}. The backend should return JSON, not redirect. Please check backend configuration.`,
        };
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          error: data.detail || data.message || `HTTP error! status: ${response.status}`,
        };
      }

      // Validate that auth_url is present and is not pointing to the Django backend
      if (!data.auth_url) {
        return {
          error: 'Backend did not return auth_url in response',
        };
      }

      // Check if auth_url is pointing to Django backend instead of Omniport
      if (data.auth_url.includes('127.0.0.1:8000') || data.auth_url.includes('localhost:8000')) {
        console.error('Backend returned Django URL instead of Omniport URL:', data.auth_url);
        return {
          error: 'Backend configuration error: auth_url points to Django backend instead of Omniport',
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
    const response = await this.request<AuthResponse>('/auth/omniport/callback/', {
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
      const response = await this.request<RegisterResponse>('/auth/register/', {
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
    const response = await this.request<AuthResponse>('/auth/login/', {
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

  async resendVerificationEmail(email: string) {
    const response = await this.request<{ message: string }>('/auth/resend-verification/', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });

    return response;
  }

  async signOut() {
    try {
      // Call the logout API endpoint
      const response = await this.request<{ message: string }>('/auth/logout/', {
        method: 'POST',
      });

      // Clear token and user data regardless of API response
      // This ensures local state is cleared even if API call fails
      this.setToken(null);
      localStorage.removeItem('user');

      return response;
    } catch (error: any) {
      // Even if API call fails, clear local storage
      this.setToken(null);
      localStorage.removeItem('user');
      
      return {
        error: error.message || 'Failed to logout',
      };
    }
  }

  async getCurrentUser() {
    return this.request<User>('/auth/user/');
  }

  // Profile endpoints
  // Note: getProfile is deprecated, use getCurrentUser() instead
  // Keeping for backward compatibility but redirects to getCurrentUser
  async getProfile(userId?: string) {
    if (userId) {
      // For other users, use users endpoint
      return this.request<User>(`/users/${userId}/`);
    }
    // For current user, use auth/user endpoint
    return this.getCurrentUser();
  }

  async updateProfile(data: {
    name?: string;
    user_type?: number | string;
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
    return this.request<User>(`/users/${userResponse.data.id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Equipment endpoints
  async getEquipment() {
    return this.request<any[]>('/equipment/');
  }

  async getEquipments() {
    return this.request<{
      equipments: Array<{
        equipment_id: number;
        code: string;
        name: string;
        profile_type: string;
        profile_type_display: string;
        status: string;
        status_display: string;
        location: string;
        image_url: string;
        created_at: string;
        updated_at: string;
      }>;
      count: number;
    }>('/equipments/');
  }

  async getEquipmentById(id: string) {
    return this.request<any>(`/equipment/${id}/`);
  }

  async getEquipmentDetailById(id: number | string) {
    return this.request<{
      equipment_id: number;
      code: string;
      name: string;
      description: string;
      profile_type: string;
      profile_type_display: string;
      status: string;
      status_display: string;
      location: string;
      s3_path: string;
      image_url: string;
      slot_duration_minutes: number;
      slots_per_day: number;
      internal_weekly_quota: number;
      external_weekly_quota: number;
      internal_monthly_quota: number;
      external_monthly_quota: number;
      specifications: Array<{
        equipment_specification_id: number;
        spec_key: string;
        spec_value: string;
        created_at: string;
      }>;
      accessories: Array<any>;
      additional_accessories: Array<{
        equipment_additional_accessory_id: number;
        additional_accessory_name: string;
        additional_accessory_description: string;
        is_optional: boolean;
        created_at: string;
      }>;
      input_fields: Array<{
        field_key: string;
        field_label: string;
        field_type: string;
        is_required: boolean;
        default_value: string;
        options: Array<any>;
        help_text: string;
        created_at: string;
        updated_at: string;
      }>;
      charge_profiles: Array<{
        equipment: number;
        user_type: string;
        is_active: boolean;
        primary_unit_charge: string;
        secondary_unit_charge: string;
        breakpoint: string;
        time_formula: string | null;
        created_at: string;
        updated_at: string;
      }>;
      slot_options: Array<any>;
      slot_masters: Array<{
        slot_number: number;
        slot_name: string;
        open_time: string;
        close_time: string;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }>;
      created_at: string;
      updated_at: string;
    }>(`/equipments/${id}/`);
  }

  async updateEquipment(id: string, data: any) {
    return this.request<any>(`/equipment/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async calculateEquipmentCharge(equipmentId: number | string, fieldValues: Record<string, string | boolean>) {
    // Convert field values to query parameters
    const params = new URLSearchParams();
    Object.entries(fieldValues).forEach(([key, value]) => {
      params.append(key, String(value));
    });
    
    const queryString = params.toString();
    const endpoint = queryString 
      ? `/equipments/${equipmentId}/calculate/?${queryString}`
      : `/equipments/${equipmentId}/calculate/`;
    
    return this.request<{
      equipment_id: number;
      equipment_code: string;
      equipment_name: string;
      user_type: string;
      profile_type: string;
      input_values: Record<string, number | string>;
      total_time_minutes: number;
      total_charge: string;
      charge_breakdown: Array<{
        description: string;
        amount: number;
      }>;
    }>(endpoint);
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
      balance: string;
      transactions: Array<{
        id: number;
        transaction_type: "credit" | "debit";
        amount: string;
        description: string;
        created_at: string;
      }>;
    }>('/wallet/');
  }

  async getWalletBalance() {
    return this.request<{ balance: string }>('/wallet/balance/');
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
    }>('/wallet/credit/', {
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
    }>('/wallets/debit/', {
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
    }>('/wallet/transactions/');
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

  // User type endpoints
  async getUserTypes() {
    return this.request<{ user_types: Array<{ code: string; name: string; description: string }> }>('/auth/register/user-types/');
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

