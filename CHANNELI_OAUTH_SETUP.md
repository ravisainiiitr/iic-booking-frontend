# Channeli OAuth 2.0 Setup Guide for IIT Roorkee

This guide explains how to configure Channeli (IIT Roorkee's OAuth system) authentication for your LabBooking Pro application.

## Overview

Channeli is IIT Roorkee's centralized authentication and authorization service. This application uses OAuth 2.0 protocol to authenticate users through Channeli.

## Prerequisites

1. Access to IIT Roorkee Channeli Developer Console
2. Lovable Cloud backend enabled (already configured)
3. Administrator access to configure OAuth providers

## Step 1: Register Your Application on Channeli

1. Go to Channeli Developer Console: https://channeli.in/developer/
2. Log in with your IIT Roorkee credentials
3. Click "Create New Application"
4. Fill in the application details:
   - **Application Name**: LabBooking Pro
   - **Description**: Laboratory Equipment Booking Management System
   - **Redirect URI**: `{YOUR_APP_URL}/auth` (e.g., https://yourapp.lovable.app/auth)
   - **Application Type**: Web Application

5. Note down the following credentials:
   - **Client ID**
   - **Client Secret**

## Step 2: Configure OAuth in Lovable Cloud Backend

Since you cannot access Supabase dashboard directly, you'll need to use custom OAuth configuration:

### Option A: Using Supabase Custom OAuth Provider

1. Open your backend (Cloud tab in Lovable)
2. Navigate to Authentication > Providers
3. Add a new custom OAuth provider with these settings:

```
Provider Name: Channeli
Authorization URL: https://channeli.in/oauth/authorise/
Token URL: https://channeli.in/oauth/token/
User Info URL: https://channeli.in/open_auth/get_user_data/
Client ID: [Your Channeli Client ID]
Client Secret: [Your Channeli Client Secret]
Scopes: openid profile email
```

### Option B: Create an Edge Function for Channeli OAuth

If custom provider is not available, you can create an edge function to handle the OAuth flow:

1. Create a file: `supabase/functions/channeli-auth/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CHANNELI_CLIENT_ID = Deno.env.get('CHANNELI_CLIENT_ID')
const CHANNELI_CLIENT_SECRET = Deno.env.get('CHANNELI_CLIENT_SECRET')
const CHANNELI_REDIRECT_URI = Deno.env.get('CHANNELI_REDIRECT_URI')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { code } = await req.json()

    // Exchange code for token
    const tokenResponse = await fetch('https://channeli.in/open_auth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: CHANNELI_CLIENT_ID!,
        client_secret: CHANNELI_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: CHANNELI_REDIRECT_URI!,
      }),
    })

    const tokenData = await tokenResponse.json()

    // Get user data
    const userResponse = await fetch('https://channeli.in/open_auth/get_user_data/', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    })

    const userData = await userResponse.json()

    // Create or update user in Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data, error } = await supabaseClient.auth.admin.createUser({
      email: userData.person.email,
      email_confirm: true,
      user_metadata: {
        full_name: userData.person.fullName,
        enrollment_number: userData.person.enrolmentNumber,
        channeli_id: userData.person.id,
      },
    })

    if (error) throw error

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

2. Add the required secrets in Lovable Cloud:
   - CHANNELI_CLIENT_ID
   - CHANNELI_CLIENT_SECRET
   - CHANNELI_REDIRECT_URI

## Step 3: Update Frontend Code

The frontend code has already been updated with the Channeli login button. The OAuth flow will:

1. Redirect users to Channeli authorization page
2. User logs in with IIT Roorkee credentials
3. Channeli redirects back to your app with authorization code
4. Your backend exchanges code for access token
5. User data is fetched and user is logged in

## Step 4: Testing

1. Click "Login with Channeli" button on the main page
2. You'll be redirected to Channeli login page
3. Enter your IIT Roorkee credentials
4. Authorize the application
5. You'll be redirected back to the dashboard

## Channeli API Endpoints

- **Authorization**: `https://channeli.in/oauth/authorise/`
- **Token Exchange**: `https://channeli.in/open_auth/token/`
- **User Data**: `https://channeli.in/open_auth/get_user_data/`

## Scopes Available

- `openid` - Basic user identification
- `profile` - User profile information
- `email` - User email address
- `phone` - User phone number
- `user` - Full user data access

## User Data Structure

Channeli returns user data in this format:

```json
{
  "person": {
    "id": 123,
    "fullName": "John Doe",
    "email": "john.doe@iitr.ac.in",
    "enrolmentNumber": "12345678",
    "roles": [...],
    "currentYear": 3,
    "branch": "CSE"
  }
}
```

## Security Notes

1. Never expose Client Secret in frontend code
2. Always use HTTPS for redirect URIs
3. Validate state parameter to prevent CSRF attacks
4. Store tokens securely
5. Implement proper error handling

## Troubleshooting

### "Invalid redirect URI" Error
- Ensure the redirect URI in Channeli matches exactly with your app URL
- Check for trailing slashes

### "Invalid client credentials" Error
- Verify Client ID and Client Secret are correct
- Check if they're properly configured in backend secrets

### User not getting created
- Check backend logs in Cloud tab
- Verify email confirmation is disabled in auth settings
- Ensure RLS policies allow user creation

## Additional Resources

- [Channeli Documentation](https://channeli.in/developer/docs/)
- [OAuth 2.0 Specification](https://oauth.net/2/)
- [Lovable Cloud Docs](https://docs.lovable.dev/features/cloud)

## Support

For Channeli-specific issues, contact IIT Roorkee Information Management Group (IMG).
For application issues, refer to Lovable documentation or support channels.
