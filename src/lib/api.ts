// API client for Django REST API
// Support runtime configuration via window.__RUNTIME_CONFIG__ (for Docker/production)
// Falls back to VITE_API_URL env var (for build-time) or default
const getApiBaseUrl = (): string => {
  // Check for runtime config (injected by Docker entrypoint)
  if (typeof window !== 'undefined' && (window as any).__RUNTIME_CONFIG__?.VITE_API_URL) {
    return (window as any).__RUNTIME_CONFIG__.VITE_API_URL;
  }
  // Check for build-time env var
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // Default fallback
  return 'http://127.0.0.1:8000/api';
};

const API_BASE_URL = getApiBaseUrl();

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
  secondary_phone_number?: string | null;
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
  date_of_birth?: string | null;
  branch_name?: string | null;
  degree_name?: string | null;
  designation?: string | null;
  date_joined?: string | null;
  last_login?: string | null;
}

interface AuthResponse {
  token: string;
  user: User;
}

export interface UserGroupSummary {
  id: number;
  name: string;
  code: string;
  description: string;
  member_count: number;
  equipment_count: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface UserGroupMember {
  id: number;
  user_id: number;
  email: string;
  name: string;
  created_at: string | null;
}

export interface UserGroupDetail extends UserGroupSummary {
  members: UserGroupMember[];
  equipment_ids: number[];
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

interface BookingEvent {
  event_id: number;
  booking: number;
  event_type: string;
  event_type_display: string;
  previous_status: string | null;
  previous_status_display: string | null;
  new_status: string | null;
  new_status_display: string | null;
  comment: string | null;
  created_by: number | null;
  created_by_name: string | null;
  metadata: Record<string, any>;
  notification_sent: boolean;
  created_at: string;
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
    user_type: "external" | "RND" | "Industry" | "other",
    emp_id: string,
    phone_number: string | undefined,
    department: number,
    documents?: File[],
    document_types?: string[],
    profile_picture?: File | null
  ) {
    const url = `${this.baseURL}/auth/register/`;
    const formData = new FormData();
    
    formData.append('email', email);
    formData.append('password', password);
    formData.append('password_confirm', password_confirm);
    formData.append('name', name);
    formData.append('user_type', user_type);
    formData.append('emp_id', emp_id);
    if (phone_number) {
      formData.append('phone_number', phone_number);
    }
    formData.append('department', department.toString());
    
    // Append profile picture if provided
    if (profile_picture) {
      formData.append('profile_picture', profile_picture);
    }
    
    // Append documents if provided (Optional)
    if (documents && documents.length > 0) {
      documents.forEach((file, index) => {
        formData.append(`documents[]`, file);
      });
    }
    
    // Append document_types if provided (Optional, must match documents array length)
    if (document_types && document_types.length > 0) {
      document_types.forEach((docType, index) => {
        if (docType && docType.trim() !== "") {
          formData.append(`document_types[]`, docType);
        }
      });
    }

    const headers: HeadersInit = {};
    if (this.token) {
      headers['Authorization'] = `Token ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Handle field-specific errors
        const fieldErrors: Record<string, string[] | string> = {};
        let hasFieldErrors = false;
        
        if (typeof data === 'object' && data !== null) {
          for (const [field, messages] of Object.entries(data)) {
            if (field === 'detail' || field === 'message') {
              continue;
            }
            
            if (Array.isArray(messages) && messages.length > 0) {
              fieldErrors[field] = messages;
              hasFieldErrors = true;
            } else if (typeof messages === 'string') {
              fieldErrors[field] = messages;
              hasFieldErrors = true;
            }
          }
        }
        
        if (hasFieldErrors) {
          const firstFieldError = Object.values(fieldErrors)[0];
          const firstErrorMessage = Array.isArray(firstFieldError) 
            ? firstFieldError[0] 
            : firstFieldError;
          
          return {
            error: firstErrorMessage || `HTTP error! status: ${response.status}`,
            fieldErrors: fieldErrors,
          };
        }
        
        return {
          error: data.detail || data.message || data.error || `HTTP error! status: ${response.status}`,
          fieldErrors: Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
        };
      }

      const result: ApiResponse<RegisterResponse> = { data: data as RegisterResponse };
      
      if (result.data?.token) {
        this.setToken(result.data.token);
        // Store user data if provided
        if (result.data.user) {
          localStorage.setItem('user', JSON.stringify(result.data.user));
        }
      }

      return result;
    } catch (error: any) {
      return {
        error: error.message || 'Network error occurred',
      };
    }
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
  async getProfileMe() {
    return this.request<User>('/profiles/me/');
  }

  // Note: getProfile is deprecated, use getCurrentUser() or getProfileMe() instead
  // Keeping for backward compatibility but redirects to getCurrentUser
  async getProfile(userId?: string) {
    if (userId) {
      // For other users, use users endpoint
      return this.request<User>(`/users/${userId}/`);
    }
    // For current user, use profiles/me endpoint
    return this.getProfileMe();
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
  /** @deprecated Use getEquipments() - backend uses /equipments/ not /equipment/ */
  async getEquipment() {
    return this.request<any[]>('/equipment/');
  }

  async getEquipments(search?: string, status?: string) {
    const params = new URLSearchParams();
    if (search) {
      params.append('search', search);
    }
    if (status) {
      params.append('status', status);
    }
    const queryString = params.toString();
    const endpoint = queryString ? `/equipments/?${queryString}` : '/equipments/';
    
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
        video_url?: string | null;
        category?: number | null;
        category_name?: string | null;
        category_code?: string | null;
        created_at: string;
        updated_at: string;
      }>;
      count: number;
    }>(endpoint);
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
      daily_slots?: Array<{
        id: number;
        slot_master: number;
        slot_number: number;
        slot_name: string;
        equipment_code: string;
        date: string;
        start_datetime: string;
        end_datetime: string;
        status: string;
        created_at: string;
        updated_at: string;
      }>;
      created_at: string;
      updated_at: string;
    }>(`/equipments/${id}/`);
  }

  async updateEquipment(id: string, data: any) {
    return this.request<any>(`/equipments/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async calculateEquipmentCharge(equipmentId: number | string, fieldValues: Record<string, string | boolean | string[]>) {
    // Convert field values to query parameters
    const params = new URLSearchParams();
    Object.entries(fieldValues).forEach(([key, value]) => {
      // Handle arrays (for MULTI_SELECT fields) - convert to comma-separated string
      if (Array.isArray(value)) {
        params.append(key, value.join(","));
      } else {
        params.append(key, String(value));
      }
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

  async getEquipmentSlots(
    equipmentId: number | string, 
    startDate?: string,
    endDate?: string
  ) {
    const params = new URLSearchParams();

    if (startDate) {
      const dateOnly = startDate.includes('T') ? startDate.split('T')[0] : startDate;
      params.append('start_date', dateOnly);
    }
    if (endDate) {
      const dateOnly = endDate.includes('T') ? endDate.split('T')[0] : endDate;
      params.append('end_date', dateOnly);
    }
    
    const queryString = params.toString();
    const endpoint = queryString 
      ? `/equipments/${equipmentId}/slots/?${queryString}`
      : `/equipments/${equipmentId}/slots/`;
    
    return this.request<{
      equipment_id: number;
      equipment_code: string;
      start_date: string;
      end_date: string;
      slots: Array<{
        id: number;
        slot_master: number;
        slot_number: number;
        slot_name: string;
        equipment_code: string;
        date: string;
        start_datetime: string;
        end_datetime: string;
        status: string;
        status_display?: string;
        booking_id?: number | null;
        booking_status?: string | null;
        booking_status_display?: string | null;
        created_at: string;
        updated_at: string;
      }>;
      count: number;
      total_time_minutes?: number;
      holidays?: Record<string, string>;
    }>(endpoint);
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
      sub_wallets?: Array<{
        id: number;
        department_id: number;
        department_name: string;
        department_code: string | null;
        balance: string;
        created_at: string;
        updated_at: string;
      }>;
      is_shared?: boolean;
      wallet_owner?: {
        name?: string | null;
        email?: string | null;
        phone?: string | null;
        profile_picture?: string | null;
      } | null;
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

  /** Departments that have equipment (valid for sub-wallet recharge). */
  async getDepartmentsForRecharge() {
    return this.request<{
      departments: Array<{ id: number; name: string; code: string | null; department_type: string }>;
    }>('/wallet/departments-for-recharge/');
  }

  async createRazorpayOrder(amount: number, departmentId: number) {
    return this.request<{
      order_id: string;
      amount: number;
      currency: string;
      key: string;
      wallet_id: number;
      department_id?: number;
    }>('/wallet/razorpay/create-order/', {
      method: 'POST',
      body: JSON.stringify({ amount, department_id: departmentId }),
    });
  }

  async verifyRazorpayPayment(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
    amount: number
  ) {
    return this.request<{
      wallet: {
        balance: string;
        transactions: any[];
      };
      transaction: any;
      message: string;
    }>('/wallet/razorpay/verify-payment/', {
      method: 'POST',
      body: JSON.stringify({
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: razorpaySignature,
        amount: amount,
      }),
    });
  }

  // User roles endpoints
  /** Returns true if user_type is one of admin, manager, operator, finance (matches backend get_admin_panel_codes). */
  isAdminPanelUser(userType: string | number | undefined | null): boolean {
    if (userType == null || userType === undefined) return false;
    const s = String(userType).toLowerCase();
    return ['admin', 'manager', 'operator', 'finance'].includes(s);
  }

  async getUserRoles(userId?: string) {
    const endpoint = userId ? `/user-roles/?user_id=${userId}` : '/user-roles/';
    return this.request<any[]>(endpoint);
  }

  async checkAdminRole(userId: string) {
    return this.request<{ is_admin: boolean }>(`/user-roles/check-admin/?user_id=${encodeURIComponent(userId)}`);
  }

  // User management endpoints (admin only)
  async getUsers() {
    return this.request<any[]>('/users/');
  }

  // User groups (equipment visibility) - admin/manager/operator only
  async getUserGroups() {
    return this.request<{ user_groups: UserGroupSummary[]; count: number }>('/user-groups/');
  }

  async createUserGroup(data: { name: string; code: string; description?: string }) {
    return this.request<UserGroupSummary>('/user-groups/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getUserGroup(id: number) {
    return this.request<UserGroupDetail>(`/user-groups/${id}/`);
  }

  async updateUserGroup(id: number, data: { name?: string; code?: string; description?: string }) {
    return this.request<UserGroupSummary>(`/user-groups/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteUserGroup(id: number) {
    return this.request<{ message: string }>(`/user-groups/${id}/`, {
      method: 'DELETE',
    });
  }

  async getUserGroupMembers(groupId: number) {
    return this.request<{ members: UserGroupMember[]; count: number }>(`/user-groups/${groupId}/members/`);
  }

  async addUserGroupMember(groupId: number, userId: number) {
    return this.request<UserGroupMember>(`/user-groups/${groupId}/members/`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  }

  async removeUserGroupMember(groupId: number, userId: number) {
    return this.request<{ message: string }>(`/user-groups/${groupId}/members/`, {
      method: 'DELETE',
      body: JSON.stringify({ user_id: userId }),
    });
  }

  async getUserGroupEquipment(groupId: number) {
    return this.request<{ equipment: Array<{ equipment_id: number; code: string; name: string; status: string }>; count: number }>(`/user-groups/${groupId}/equipment/`);
  }

  async assignEquipmentToUserGroup(groupId: number, equipmentIds: number[]) {
    return this.request<{ message: string; assigned_count: number }>(`/user-groups/${groupId}/equipment/`, {
      method: 'POST',
      body: JSON.stringify({ equipment_ids: equipmentIds }),
    });
  }

  async unassignEquipmentFromUserGroup(groupId: number, equipmentIds: number[]) {
    return this.request<{ message: string; unassigned_count: number }>(`/user-groups/${groupId}/equipment/`, {
      method: 'DELETE',
      body: JSON.stringify({ equipment_ids: equipmentIds }),
    });
  }

  // Department endpoints
  async getDepartments(type?: string, groupByType: boolean = false) {
    const params = new URLSearchParams();
    if (type) {
      params.append('type', type);
    }
    if (groupByType) {
      params.append('group_by_type', 'true');
    }
    const queryString = params.toString();
    const url = queryString ? `/departments/?${queryString}` : '/departments/';
    return this.request<{ 
      departments: Array<{ 
        id: number; 
        name: string; 
        code: string; 
        department_type: string;
        department_type_display: string;
      }>; 
      count: number;
      grouped?: {
        internal: Array<{ id: number; name: string; code: string; department_type: string; department_type_display: string }>;
        external: Array<{ id: number; name: string; code: string; department_type: string; department_type_display: string }>;
      };
    }>(url);
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
    department?: number | null;
  }) {
    const body: Record<string, string | number | null> = {
      email: data.email,
      password: data.password,
      full_name: data.full_name,
      role: data.role,
    };
    if (data.department !== undefined && data.department !== null) {
      body.department = data.department;
    }
    return this.request<any>('/users/', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async updateUser(id: string, data: { full_name?: string; name?: string; role?: string; department?: number | null }) {
    const body: Record<string, string | number | null> = {};
    if (data.full_name !== undefined) body.name = data.full_name;
    if (data.name !== undefined) body.name = data.name;
    if (data.role !== undefined) body.user_type = data.role;
    if (data.department !== undefined) body.department = data.department;
    return this.request<any>(`/users/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async approveUser(userId: string) {
    return this.request<{ message: string; user: any }>(`/users/${userId}/approve/`, {
      method: 'POST',
    });
  }

  async rejectUser(userId: string) {
    return this.request<{ message: string; user: any }>(`/users/${userId}/reject/`, {
      method: 'POST',
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

  // Wallet join request endpoints
  async getFacultyByEmail(email: string) {
    return this.request<{
      faculty: {
        id: number;
        name: string;
        email: string;
        phone?: string | null;
        profile_picture?: string | null;
      };
      has_wallet: boolean;
    }>(`/wallet/faculty-by-email/?email=${encodeURIComponent(email)}`);
  }

  async requestWalletJoin(facultyEmail: string, message?: string) {
    return this.request<{ message: string }>('/wallet/join-request/', {
      method: 'POST',
      body: JSON.stringify({ faculty_email: facultyEmail, message }),
    });
  }

  async getWalletJoinRequests() {
    return this.request<{
      requests: Array<{
        id: number;
        student: number;
        student_name: string;
        student_email: string;
        student_phone?: string | null;
        student_profile_picture?: string | null;
        faculty: number;
        faculty_name: string;
        faculty_email: string;
        faculty_phone?: string | null;
        faculty_profile_picture?: string | null;
        wallet: number;
        status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
        status_display: string;
        message?: string;
        faculty_response?: string;
        created_at: string;
        updated_at: string;
        responded_at: string | null;
      }>;
      count: number;
    }>('/wallet/join-requests/');
  }

  async approveWalletJoinRequest(requestId: number) {
    return this.request<{ message: string }>(`/wallet/join-requests/${requestId}/approve/`, {
      method: 'POST',
    });
  }

  async rejectWalletJoinRequest(requestId: number) {
    return this.request<{ message: string }>(`/wallet/join-requests/${requestId}/reject/`, {
      method: 'POST',
    });
  }

  async cancelWalletJoinRequest(requestId: number) {
    return this.request<{ message: string }>(`/wallet/join-requests/${requestId}/cancel/`, {
      method: 'POST',
    });
  }

  async removeStudentFromWallet(requestId: number, responseMessage?: string) {
    return this.request<{ message: string }>(`/wallet/join-requests/${requestId}/remove/`, {
      method: 'POST',
      body: JSON.stringify({ response_message: responseMessage }),
    });
  }

  // Wallet recharge request endpoints
  async sendUserOtpForRecharge(amount: number, departmentId: number, projectDetails?: string) {
    return this.request<{
      request_id: number;
      message: string;
    }>('/wallet/recharge-request/send-otp/', {
      method: 'POST',
      body: JSON.stringify({ amount, department_id: departmentId, project_details: projectDetails }),
    });
  }

  async createWalletRechargeRequest(requestId: number, userOtp: string) {
    return this.request<{
      request: {
        id: number;
        user: number;
        user_name: string;
        user_email: string;
        wallet: number;
        amount: string;
        project_details?: string;
        status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
        status_display: string;
        approved_by_email?: string;
        response_message?: string;
        created_at: string;
        updated_at: string;
        responded_at: string | null;
      };
      message: string;
    }>('/wallet/recharge-request/', {
      method: 'POST',
      body: JSON.stringify({ request_id: requestId, user_otp: userOtp }),
    });
  }

  async getWalletRechargeRequests() {
    return this.request<{
      requests: Array<{
        id: number;
        user: number;
        user_name: string;
        user_email: string;
        wallet: number;
        amount: string;
        project_details?: string;
        status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
        status_display: string;
        approved_by_email?: string;
        response_message?: string;
        created_at: string;
        updated_at: string;
        responded_at: string | null;
      }>;
      count: number;
    }>('/wallet/recharge-requests/');
  }

  async cancelWalletRechargeRequest(requestId: number) {
    return this.request<{
      request: any;
      message: string;
    }>(`/wallet/recharge-requests/${requestId}/cancel/`, {
      method: 'POST',
    });
  }

  // Booking endpoints
  // Booking action endpoints (operator/manager only)
  async completeBooking(bookingId: number) {
    return this.request<{
      message: string;
      booking: any;
    }>(`/bookings/${bookingId}/complete/`, {
      method: 'POST',
    });
  }

  async refundBooking(bookingId: number, notes?: string) {
    return this.request<{
      message: string;
      booking: any;
      refund_amount?: string;
      wallet_balance?: string;
    }>(`/bookings/${bookingId}/refund/`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  }

  async absentBooking(bookingId: number, notes?: string) {
    return this.request<{
      message: string;
      booking: any;
    }>(`/bookings/${bookingId}/absent/`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  }

  async rescheduleBooking(bookingId: number, startTime: string, endTime: string) {
    return this.request<{
      message: string;
      booking: any;
    }>(`/bookings/${bookingId}/reschedule/`, {
      method: 'POST',
      body: JSON.stringify({ start_time: startTime, end_time: endTime }),
    });
  }

  async cancelBooking(bookingId: number, refund: boolean = false, notes?: string) {
    return this.request<{
      message: string;
      booking: any;
      refund_amount?: string;
    }>(`/bookings/${bookingId}/cancel/`, {
      method: 'POST',
      body: JSON.stringify({ refund, notes }),
    });
  }

  async userCancelBooking(bookingId: number, refund: boolean = false, notes?: string) {
    return this.request<{
      message: string;
      booking: any;
      refund_amount?: string;
    }>(`/bookings/${bookingId}/user-cancel/`, {
      method: 'POST',
      body: JSON.stringify({ refund, notes }),
    });
  }

  async userRescheduleBooking(bookingId: number, startTime: string, endTime: string) {
    return this.request<{
      message: string;
      booking: any;
    }>(`/bookings/${bookingId}/user-reschedule/`, {
      method: 'POST',
      body: JSON.stringify({ start_time: startTime, end_time: endTime }),
    });
  }

  async getBookingEvents(bookingId: number) {
    return this.request<{
      booking_id: number;
      events: BookingEvent[];
      count: number;
    }>(`/bookings/${bookingId}/events/`);
  }

  async createBookingEventComment(bookingId: number, comment: string, sendNotification: boolean = true) {
    return this.request<{
      message: string;
      event: BookingEvent;
    }>(`/bookings/${bookingId}/events/comment/`, {
      method: 'POST',
      body: JSON.stringify({ comment, send_notification: sendNotification }),
    });
  }

  async getBookings(params?: {
    user_id?: string | number;
    equipment_id?: string | number;
    status?: string;
    start_date?: string;
    end_date?: string;
    ordering?: string;
  }) {
    const queryParams = new URLSearchParams();
    
    if (params?.user_id) {
      queryParams.append('user_id', String(params.user_id));
    }
    if (params?.equipment_id) {
      queryParams.append('equipment_id', String(params.equipment_id));
    }
    if (params?.status) {
      queryParams.append('status', params.status);
    }
    if (params?.start_date) {
      queryParams.append('start_date', params.start_date);
    }
    if (params?.end_date) {
      queryParams.append('end_date', params.end_date);
    }
    if (params?.ordering) {
      queryParams.append('ordering', params.ordering);
    }
    
    const queryString = queryParams.toString();
    const endpoint = queryString ? `/bookings/?${queryString}` : '/bookings/';
    
    return this.request<{
      bookings: Array<{
        booking_id: number;
        user: number;
        user_email: string;
        user_name: string;
        equipment: number;
        equipment_code: string;
        equipment_name: string;
        charge_profile: number;
        user_type_snapshot: string;
        total_time_minutes: number;
        total_hours: number;
        total_charge: string;
        input_values: Record<string, string | boolean | string[]>;
        selected_parameters: any;
        charge_breakdown: Array<{
          amount: number;
          description: string;
        }>;
        status: string;
        status_display: string;
        notes: string;
        start_time: string;
        end_time: string;
        daily_slots: Array<{
          id: number;
          slot_master: number;
          slot_number: number;
          slot_name: string;
          equipment_code: string;
          date: string;
          start_datetime: string;
          end_datetime: string;
          status: string;
          booking: number;
          booking_id: number;
          created_at: string;
          updated_at: string;
        }>;
        created_at: string;
        updated_at: string;
      }>;
      count: number;
    }>(endpoint);
  }

  async createBooking(data: {
    equipment_id: string | number;
    start_time: string;
    end_time: string;
    total_hours: number;
    total_cost: number;
    status?: string;
    input_values?: Record<string, string | boolean | string[]>;
  }) {
    return this.request<{
      id: number;
      equipment_id: number | string;
      user: number;
      start_time: string;
      end_time: string;
      total_hours: number;
      total_cost: string;
      status: string;
      status_display: string;
      created_at: string;
      updated_at: string;
    }>('/bookings/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async bookEquipment(equipmentId: string | number, data: {
    start_time: string;
    end_time: string;
    total_hours: number;
    total_cost: number;
    status?: string;
    input_values?: Record<string, string | boolean | string[]>;
  }) {
    return this.request<{
      id: number;
      equipment_id: number | string;
      user: number;
      start_time: string;
      end_time: string;
      total_hours: number;
      total_cost: string;
      status: string;
      status_display: string;
      created_at: string;
      updated_at: string;
    }>(`/equipments/${equipmentId}/book/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateBooking(bookingId: number | string, data: {
    status?: string;
    start_time?: string;
    end_time?: string;
  }) {
    return this.request<any>(`/bookings/${bookingId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Notice Board endpoints (public)
  async getPublicNotices(limit?: number) {
    const params = new URLSearchParams();
    if (limit) {
      params.append('limit', limit.toString());
    }
    params.append('is_active', 'true'); // Only get active notices
    const queryString = params.toString();
    const endpoint = queryString ? `/notices/?${queryString}` : '/notices/';
    
    return this.request<{
      notices: Array<{
        notice_id: number;
        title: string;
        description: string;
        content?: string;
        notice_type: string;
        is_active: boolean;
        priority?: number;
        created_at: string;
        updated_at: string;
        created_by?: number;
        created_by_name?: string;
      }>;
      count: number;
    }>(endpoint);
  }

  // Notice Board endpoints (admin - requires authentication)
  async createNotice(data: {
    title: string;
    description: string;
    content?: string;
    notice_type?: "info" | "warning" | "urgent";
    is_active?: boolean;
    priority?: number;
  }) {
    return this.request<{
      notice_id: number;
      title: string;
      description: string;
      notice_type: string;
      is_active: boolean;
      created_at: string;
    }>('/notices/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateNotice(noticeId: number | string, data: {
    title?: string;
    description?: string;
    content?: string;
    notice_type?: "info" | "warning" | "urgent";
    is_active?: boolean;
    priority?: number;
  }) {
    return this.request<any>(`/notices/${noticeId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteNotice(noticeId: number | string) {
    return this.request<{ message: string }>(`/notices/${noticeId}/`, {
      method: 'DELETE',
    });
  }

  // Ticket endpoints
  async getTickets(params?: {
    status?: string;
    ticket_type?: string;
    priority?: string;
    user_id?: string | number;
    assigned_to?: string | number;
  }) {
    const queryParams = new URLSearchParams();
    
    if (params?.status) {
      queryParams.append('status', params.status);
    }
    if (params?.ticket_type) {
      queryParams.append('ticket_type', params.ticket_type);
    }
    if (params?.priority) {
      queryParams.append('priority', params.priority);
    }
    if (params?.user_id) {
      queryParams.append('user_id', String(params.user_id));
    }
    if (params?.assigned_to) {
      queryParams.append('assigned_to', String(params.assigned_to));
    }
    
    const queryString = queryParams.toString();
    const endpoint = queryString ? `/tickets/?${queryString}` : '/tickets/';
    
    return this.request<{
      tickets: Array<{
        ticket_id: number;
        user: number | null;
        user_name: string | null;
        user_email: string | null;
        public_name: string | null;
        public_email: string | null;
        public_phone: string | null;
        ticket_type: string;
        ticket_type_display: string;
        subject: string;
        description: string;
        related_equipment: number | null;
        related_equipment_name: string | null;
        related_equipment_code: string | null;
        related_booking: number | null;
        related_booking_id: number | null;
        status: string;
        status_display: string;
        priority: string;
        priority_display: string;
        assigned_to: number | null;
        assigned_to_name: string | null;
        assigned_to_email: string | null;
        resolution_notes: string | null;
        created_at: string;
        updated_at: string;
        resolved_at: string | null;
        closed_at: string | null;
        comments: Array<{
          comment_id: number;
          ticket: number;
          user: number | null;
          user_name: string | null;
          user_email: string | null;
          comment: string;
          is_internal: boolean;
          created_at: string;
          updated_at: string;
        }>;
        comments_count: number;
      }>;
      count: number;
    }>(endpoint);
  }

  async createTicket(data: {
    public_name?: string;
    public_email?: string;
    public_phone?: string;
    ticket_type: number;
    subject: string;
    description: string;
    related_equipment?: number | null;
    related_booking?: number | null;
  }) {
    return this.request<{
      ticket_id: number;
      user: number | null;
      user_name: string | null;
      user_email: string | null;
      public_name: string | null;
      public_email: string | null;
      public_phone: string | null;
      ticket_type: number;
      ticket_type_display: string;
      subject: string;
      description: string;
      status: string;
      status_display: string;
      priority: string;
      priority_display: string;
      created_at: string;
    }>('/tickets/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTicket(ticketId: number | string) {
    return this.request<{
      ticket_id: number;
      user: number | null;
      user_name: string | null;
      user_email: string | null;
      public_name: string | null;
      public_email: string | null;
      public_phone: string | null;
      ticket_type: string;
      ticket_type_display: string;
      subject: string;
      description: string;
      related_equipment: number | null;
      related_equipment_name: string | null;
      related_equipment_code: string | null;
      related_booking: number | null;
      related_booking_id: number | null;
      status: string;
      status_display: string;
      priority: string;
      priority_display: string;
      assigned_to: number | null;
      assigned_to_name: string | null;
      assigned_to_email: string | null;
      resolution_notes: string | null;
      created_at: string;
      updated_at: string;
      resolved_at: string | null;
      closed_at: string | null;
      comments: Array<{
        comment_id: number;
        ticket: number;
        user: number | null;
        user_name: string | null;
        user_email: string | null;
        comment: string;
        is_internal: boolean;
        created_at: string;
        updated_at: string;
      }>;
      comments_count: number;
    }>(`/tickets/${ticketId}/`);
  }

  async updateTicket(ticketId: number | string, data: {
    status?: string;
    priority?: string;
    assigned_to?: number | null;
    resolution_notes?: string;
    description?: string;
  }) {
    return this.request<any>(`/tickets/${ticketId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getTicketComments(ticketId: number | string) {
    return this.request<{
      comments: Array<{
        comment_id: number;
        ticket: number;
        user: number | null;
        user_name: string | null;
        user_email: string | null;
        comment: string;
        is_internal: boolean;
        created_at: string;
        updated_at: string;
      }>;
      count: number;
    }>(`/tickets/${ticketId}/comments/`);
  }

  async createTicketComment(ticketId: number | string, comment: string, isInternal: boolean = false) {
    return this.request<{
      comment_id: number;
      ticket: number;
      user: number | null;
      user_name: string | null;
      user_email: string | null;
      comment: string;
      is_internal: boolean;
      created_at: string;
      updated_at: string;
    }>(`/tickets/${ticketId}/comments/create/`, {
      method: 'POST',
      body: JSON.stringify({ comment, is_internal: isInternal }),
    });
  }

  // Ticket Type endpoints
  async getTicketTypes() {
    return this.request<{
      ticket_types: Array<{
        ticket_type_id: number;
        code: string;
        name: string;
        description: string | null;
        is_active: boolean;
        display_order: number;
        created_at: string;
        updated_at: string;
      }>;
      count: number;
    }>('/ticket-types/');
  }
}

export const apiClient = new ApiClient(API_BASE_URL);

