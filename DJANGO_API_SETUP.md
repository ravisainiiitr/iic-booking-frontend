# Django REST API Setup Guide

This document outlines the expected Django REST API endpoints that the React frontend uses.

## Base URL
The React frontend expects the Django API to be running at: `http://127.0.0.1:8000/api`

You can configure this by setting the `VITE_API_URL` environment variable in your `.env` file.

## Required Endpoints

### Authentication

#### GET `/api/auth/omniport/authorize/`
Get Omniport authorization URL for OAuth login.

**Query Parameters:**
- `redirect_uri` (optional): Custom redirect URI (defaults to configured callback URL)

**Response:**
```json
{
  "auth_url": "https://omniport.iicbooking.in/oauth/authorize/?...",
  "state": "random_state_token"
}
```

#### POST `/api/auth/omniport/callback/`
Exchange Omniport authorization code for Django auth token.

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
  "token": "7fcd3abefc80c1b98086addc4c11c5bfb37ce862",
  "user": {
    "id": 1,
    "name": "Admin",
    "email": "admin@iicbooking.iitr.ac.in",
    "user_type": "admin",
    "emp_id": "ADMIN",
    "phone_number": "8979322490",
    "profile_picture": "http://127.0.0.1:8000/media/profile_pictures/Photo.jpg",
    "department": 1,
    "department_name": "IIC Admin",
    "department_code": "ADMIN",
    "supervisor": null,
    "uses_admin_panel": true,
    "uses_react_app": false,
    "uses_omniport_auth": false,
    "uses_email_auth": false,
    "url": "http://127.0.0.1:8000/api/users/1/"
  }
}
```

#### POST `/api/auth/register/`
Register a new user (optional, if email/password registration is enabled)
```json
{
  "email": "user@example.com",
  "password": "password123",
  "full_name": "John Doe"
}
```
Response:
```json
{
  "token": "7fcd3abefc80c1b98086addc4c11c5bfb37ce862",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "user@example.com",
    "user_type": "external",
    "emp_id": "EMP001",
    "phone_number": "1234567890",
    "profile_picture": "http://127.0.0.1:8000/media/profile_pictures/default.jpg",
    "department": 1,
    "department_name": "Department Name",
    "department_code": "DEPT",
    "supervisor": null,
    "uses_admin_panel": false,
    "uses_react_app": true,
    "uses_omniport_auth": false,
    "uses_email_auth": true,
    "url": "http://127.0.0.1:8000/api/users/1/"
  }
}
```

#### POST `/api/auth/login/`
Login user with email/password (optional, if email/password login is enabled)
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```
Response:
```json
{
  "token": "7fcd3abefc80c1b98086addc4c11c5bfb37ce862",
  "user": {
    "id": 1,
    "name": "Admin",
    "email": "admin@iicbooking.iitr.ac.in",
    "user_type": "admin",
    "emp_id": "ADMIN",
    "phone_number": "8979322490",
    "profile_picture": "http://127.0.0.1:8000/media/profile_pictures/Photo.jpg",
    "department": 1,
    "department_name": "IIC Admin",
    "department_code": "ADMIN",
    "supervisor": null,
    "uses_admin_panel": true,
    "uses_react_app": false,
    "uses_omniport_auth": false,
    "uses_email_auth": false,
    "url": "http://127.0.0.1:8000/api/users/1/"
  }
}
```

#### GET `/api/auth/user/`
Get current authenticated user (requires Token authentication)
Response:
```json
{
  "id": 1,
  "name": "Admin",
  "email": "admin@iicbooking.iitr.ac.in",
  "user_type": "admin",
  "emp_id": "ADMIN",
  "phone_number": "8979322490",
  "profile_picture": "http://127.0.0.1:8000/media/profile_pictures/Photo.jpg",
  "department": 1,
  "department_name": "IIC Admin",
  "department_code": "ADMIN",
  "supervisor": null,
  "uses_admin_panel": true,
  "uses_react_app": false,
  "uses_omniport_auth": false,
  "uses_email_auth": false,
  "url": "http://127.0.0.1:8000/api/users/1/"
}
```

### Profiles

**Note:** `GET /api/profiles/me/` returns the same response as `GET /api/auth/user/`. Use `/api/auth/user/` instead.

#### PUT `/api/users/{user_id}/`
Update user profile

**Writable Fields:**
- `name` (string, max 255) - Name of User
- `user_type` (choice) - User Type: admin, student, faculty, external, manager, operator, finance, type_8, type_9, type_10
- `emp_id` (string, max 50) - Employee/Student ID
- `phone_number` (string, max 20) - Contact phone number
- `profile_picture` (image upload) - User profile picture
- `department` (field/ID) - Department the user belongs to

**Read-Only Fields (cannot be updated):**
- `id`, `email`, `department_name`, `department_code`, `supervisor`, `uses_admin_panel`, `uses_react_app`, `uses_omniport_auth`, `uses_email_auth`, `url`

**Example Request:**
```json
{
  "name": "John Doe",
  "user_type": "faculty",
  "emp_id": "EMP001",
  "phone_number": "8979322490",
  "profile_picture": "http://127.0.0.1:8000/media/profile_pictures/Photo.jpg"
}
```

#### POST `/api/profiles/me/avatar/`
Upload avatar (multipart/form-data with 'avatar' field)

### Equipment

#### GET `/api/equipment/`
Get all equipment

#### GET `/api/equipment/{id}/`
Get equipment by ID

#### PATCH `/api/equipment/{id}/`
Update equipment (admin only)
```json
{
  "name": "Equipment Name",
  "category": "Category",
  "description": "Description",
  "video_url": "https://...",
  "available": true,
  "internal_rate": 50.00,
  "external_rate": 100.00,
  "location": "Lab 101",
  "technical_contact": "contact@example.com",
  "full_details_url": "https://..."
}
```

### Bookings

#### GET `/api/bookings/`
Get all bookings for current user

#### GET `/api/bookings/?user_id={id}`
Get bookings for specific user (admin only)

#### POST `/api/bookings/`
Create a new booking
```json
{
  "equipment_id": "equipment_id",
  "start_time": "2025-01-20T09:00:00Z",
  "end_time": "2025-01-20T10:00:00Z",
  "total_hours": 1.0,
  "total_cost": 50.00,
  "status": "pending"
}
```

#### PATCH `/api/bookings/{id}/`
Update booking

### Wallets

#### GET `/api/wallets/me/`
Get current user's wallet with recent transactions
Response:
```json
{
  "wallet": {
    "id": 1,
    "user": 1,
    "balance": "0.00",
    "created_at": "2025-12-20T21:37:45.759613+05:30",
    "updated_at": "2025-12-20T21:37:45.759623+05:30",
    "transactions": []
  },
  "recent_transactions": []
}
```

#### GET `/api/wallets/me/balance/`
Get current wallet balance
Response:
```json
{
  "balance": "1000.00"
}
```

#### POST `/api/wallets/me/credit/`
Credit (add) money to wallet
```json
{
  "amount": 100.00,
  "description": "Wallet recharge"
}
```
Response:
```json
{
  "wallet": {
    "id": 1,
    "user": 1,
    "balance": "1100.00",
    "created_at": "2025-12-20T21:37:45.759613+05:30",
    "updated_at": "2025-12-20T21:37:45.759623+05:30"
  },
  "transaction": {
    "id": 1,
    "amount": "100.00",
    "type": "credit",
    "description": "Wallet recharge",
    "created_at": "2025-12-20T21:40:00.000000+05:30"
  }
}
```

#### POST `/api/wallets/me/debit/`
Debit (subtract) money from wallet
```json
{
  "amount": 50.00,
  "description": "Equipment booking payment"
}
```
Response:
```json
{
  "wallet": {
    "id": 1,
    "user": 1,
    "balance": "1050.00",
    "created_at": "2025-12-20T21:37:45.759613+05:30",
    "updated_at": "2025-12-20T21:40:30.000000+05:30"
  },
  "transaction": {
    "id": 2,
    "amount": "50.00",
    "type": "debit",
    "description": "Equipment booking payment",
    "created_at": "2025-12-20T21:40:30.000000+05:30"
  }
}
```

#### GET `/api/wallets/me/transactions/`
Get all wallet transactions for current user
Response:
```json
[
  {
    "id": 1,
    "amount": "100.00",
    "type": "credit",
    "description": "Wallet recharge",
    "created_at": "2025-12-20T21:40:00.000000+05:30"
  },
  {
    "id": 2,
    "amount": "50.00",
    "type": "debit",
    "description": "Equipment booking payment",
    "created_at": "2025-12-20T21:40:30.000000+05:30"
  }
]
```

### User Roles

#### GET `/api/user-roles/`
Get all user roles

#### GET `/api/user-roles/?user_id={id}`
Get roles for specific user

#### GET `/api/user-roles/check-admin/?user_id={id}`
Check if user has admin role
Response:
```json
{
  "is_admin": true
}
```

### User Management (Admin Only)

#### GET `/api/users/`
Get all users

#### POST `/api/users/`
Create new user
```json
{
  "email": "user@example.com",
  "password": "password123",
  "full_name": "John Doe",
  "role": "iitr_student"
}
```

#### PATCH `/api/users/{id}/`
Update user
```json
{
  "full_name": "John Doe",
  "role": "admin"
}
```

## Authentication

All endpoints (except auth endpoints) require authentication via Token:
```
Authorization: Token <auth_token>
```

**Note:** The authorization header format depends on your Django authentication backend:
- If using `rest_framework.authentication.TokenAuthentication`: Use `Token <token>`
- If using `rest_framework_simplejwt.authentication.JWTAuthentication`: Use `Bearer <token>`

The React frontend stores the token in `localStorage` as `auth_token` and uses `Token` format by default. Update `src/lib/api.ts` if your backend uses Bearer tokens.

### Omniport OAuth Flow

1. Frontend calls `GET /api/auth/omniport/authorize/` with optional `redirect_uri`
2. Backend returns `auth_url` and `state` token
3. Frontend stores `state` and redirects user to `auth_url`
4. User authenticates with Omniport
5. Omniport redirects to callback URL with `code` and `state`
6. Frontend calls `POST /api/auth/omniport/callback/` with `code` and `state`
7. Backend exchanges code for Omniport token, creates/updates user, returns Django token
8. Frontend stores token and redirects to dashboard

## CORS Configuration

Make sure your Django settings include CORS headers to allow requests from the React frontend:

```python
INSTALLED_APPS = [
    ...
    'corsheaders',
    ...
]

MIDDLEWARE = [
    ...
    'corsheaders.middleware.CorsMiddleware',
    ...
]

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",  # Vite default
    "http://localhost:3000",  # Alternative React dev server
]

# Or allow all origins in development
CORS_ALLOW_ALL_ORIGINS = True  # Only for development!
```

## Database Schema

The Django models should match the Supabase schema:

- **profiles**: id, email, full_name, phone, department, supervisor_name, avatar_url, created_at, updated_at
- **equipment**: id, name, category, description, image_url, video_url, rate_per_hour, internal_rate, external_rate, available, location, technical_contact, full_details_url, created_at, updated_at
- **bookings**: id, user_id, equipment_id, start_time, end_time, total_hours, total_cost, status, created_at, updated_at
- **wallets**: id, user_id, balance, created_at, updated_at
- **wallet_transactions**: id, wallet_id, user_id, amount, transaction_type, description, created_at
- **user_roles**: id, user_id, role, created_at

## Enums

- **booking_status**: 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled'
- **app_role**: 'admin', 'user', 'iitr_student', 'iitr_faculty', 'officer_in_charge', 'operator', 'accounts', 'external_academic', 'external_rnd', 'industrial_user'

