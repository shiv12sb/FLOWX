# FLOWX OAuth Implementation Guide

## Overview

This document explains the OAuth implementation for FLOWX authentication, covering Google Login and Apple Login.

### Status Summary

| Provider | Status | Notes |
|----------|--------|-------|
| Email/Password | ✅ Fully Implemented | Works without configuration |
| Google OAuth | ✅ Implemented (Requires Setup) | Environment variables needed |
| Apple OAuth | ✅ Implemented (Requires Setup) | Environment variables needed |

---

## What Was Implemented

### Backend Changes

#### 1. New OAuth Service (`backend/src/services/oauthService.js`)
- `handleGoogleCallback(code)` - Exchanges Google auth code for JWT
- `handleAppleCallback(code, idToken)` - Exchanges Apple auth code for JWT
- `getGoogleAuthUrl()` - Generates Google OAuth consent URL
- `getAppleAuthUrl()` - Generates Apple OAuth consent URL
- HTTPS utilities for token exchange with OAuth providers

#### 2. Auth Controller Updates (`backend/src/controllers/authController.js`)
- `initiateGoogleAuth()` - Returns Google OAuth URL
- `googleCallback()` - Handles Google callback and returns JWT
- `initiateAppleAuth()` - Returns Apple OAuth URL
- `appleCallback()` - Handles Apple callback and returns JWT

#### 3. Auth Routes Updates (`backend/src/routes/authRoutes.js`)
```
GET  /api/auth/google/initiate   → Returns OAuth URL
POST /api/auth/google/callback   → Handles OAuth response
GET  /api/auth/apple/initiate    → Returns OAuth URL
POST /api/auth/apple/callback    → Handles OAuth response
```

#### 4. Environment Configuration (`backend/src/config/env.js`)
Added OAuth environment variable support:
```javascript
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_CALLBACK_URL
APPLE_CLIENT_ID
APPLE_TEAM_ID
APPLE_KEY_ID
APPLE_PRIVATE_KEY
APPLE_CALLBACK_URL
```

### Frontend Changes

#### 1. OAuth Handlers (`js/auth.js`)
- `initiateGoogleAuth()` - Opens Google auth popup
- `initiateAppleAuth()` - Opens Apple auth popup
- Popup communication via postMessage
- Automatic token extraction and storage
- Error handling and user feedback

#### 2. OAuth Callback Page (`pages/oauth-callback.html`)
- Receives OAuth provider redirect
- Exchanges code for JWT via backend
- Communicates result back to main auth window
- Self-closes popup on completion

#### 3. Button Binding
Google and Apple buttons now have click handlers that initiate OAuth flow.

---

## Google OAuth Setup

### Step 1: Create Google OAuth 2.0 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google+ API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API"
   - Click it and press "Enable"
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application"
   - Add authorized redirect URIs:
     ```
     http://localhost:4000/api/auth/google/callback
     http://localhost:8080/pages/oauth-callback.html
     https://yourdomain.com/api/auth/google/callback
     https://yourdomain.com/pages/oauth-callback.html
     ```
   - Copy the Client ID and Client Secret

### Step 2: Add to Environment

Add to `backend/.env`:
```env
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback
```

For production:
```env
GOOGLE_CLIENT_ID=YOUR_PROD_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_PROD_CLIENT_SECRET
GOOGLE_CALLBACK_URL=https://yourdomain.com/api/auth/google/callback
```

### Step 3: Restart Backend
```bash
npm run dev
```

---

## Apple OAuth Setup

### Step 1: Create Apple App ID and Service ID

1. Go to [Apple Developer](https://developer.apple.com/)
2. Sign in with your Apple Developer account
3. Go to "Certificates, Identifiers & Profiles" > "Identifiers"
4. Create a new App ID:
   - Bundle ID: `com.yourcompany.flowx`
   - Enable "Sign in with Apple" capability
5. Create a new Service ID:
   - Description: `FLOWX Service ID`
   - Identifier: `com.yourcompany.flowx.service`
   - Enable "Sign in with Apple"
   - Configure return URLs:
     ```
     http://localhost:4000/api/auth/apple/callback
     https://yourdomain.com/api/auth/apple/callback
     ```

### Step 2: Create Private Key

1. Go to "Certificates, Identifiers & Profiles" > "Keys"
2. Click "+" to create a new key
3. Enable "Sign in with Apple"
4. Download the private key (.p8 file)
5. Keep this file safe - you'll need its contents

### Step 3: Prepare Apple Credentials

You'll need:
- Team ID (visible in top-right of Apple Developer portal)
- Key ID (from the key you created above)
- Service ID (from Step 1)
- Private Key content (the .p8 file contents)

### Step 4: Add to Environment

Add to `backend/.env`:
```env
APPLE_CLIENT_ID=com.yourcompany.flowx.service
APPLE_TEAM_ID=YOUR_TEAM_ID
APPLE_KEY_ID=YOUR_KEY_ID
APPLE_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----\nMIGEAgEAMBAGByqGSM49AgEGBSuBBAAKBG0wawIBAQQg....\n-----END PRIVATE KEY-----'
APPLE_CALLBACK_URL=http://localhost:4000/api/auth/apple/callback
```

**Important:** The private key should be stored as a single line with `\n` for newlines in the .env file, or use a .env.local file for better security.

### Step 5: Restart Backend
```bash
npm run dev
```

---

## User Flow

### Google Login
1. User clicks "Continue with Google" button
2. Frontend calls `GET /api/auth/google/initiate`
3. Backend returns Google OAuth authorization URL
4. Frontend opens popup to Google's auth screen
5. User authorizes FLOWX access
6. Google redirects to `oauth-callback.html` with authorization code
7. Callback page exchanges code for JWT via backend
8. JWT sent back to main window via postMessage
9. Frontend stores JWT in sessionStorage
10. User redirected to dashboard

### Apple Login
Same flow as Google but through Apple's OAuth endpoint.

### Email/Password Login
Works as before - no OAuth involved.

---

## API Endpoints

### Initiate OAuth Flow
```
GET /api/auth/google/initiate
GET /api/auth/apple/initiate

Response: { success: true, data: { url: "https://..." } }
Error: { success: false, message: "OAuth not configured" }
```

### Handle OAuth Callback
```
POST /api/auth/google/callback
POST /api/auth/apple/callback

Request Body:
{
  "code": "authorization_code",
  "id_token": "optional_for_apple"
}

Response: 
{
  success: true,
  data: {
    token: "jwt_token",
    user: {
      id: "user_id",
      name: "User Name",
      email: "user@example.com",
      role: "USER",
      authProvider: "GOOGLE" | "APPLE"
    }
  }
}

Error: { success: false, message: "error_description" }
```

---

## Testing Procedures

### Test 1: Email/Password Login
```bash
1. Navigate to http://localhost:8080/pages/auth.html
2. Click "Login" tab
3. Enter email: test@example.com
4. Enter password: testpassword123
5. Click "Login to dashboard"
✓ Should see success message and redirect to dashboard
```

### Test 2: Google OAuth Configuration Error
```bash
1. Don't set GOOGLE_CLIENT_ID in .env
2. Navigate to http://localhost:8080/pages/auth.html
3. Click "Continue with Google" button
✓ Should show error: "Google OAuth is not configured"
```

### Test 3: Google OAuth Success (with credentials)
```bash
1. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env
2. Restart backend: npm run dev
3. Navigate to http://localhost:8080/pages/auth.html
4. Click "Continue with Google" button
5. A popup opens with Google's login screen
6. Log in with your Google account
7. Authorize FLOWX access
✓ Should show "Login successful!" and redirect to dashboard
```

### Test 4: Apple OAuth Configuration Error
```bash
1. Don't set Apple credentials in .env
2. Navigate to http://localhost:8080/pages/auth.html
3. Click "Continue with Apple" button
✓ Should show error: "Apple OAuth is not configured"
```

### Test 5: Apple OAuth Success (with credentials)
```bash
1. Set Apple credentials in .env (APPLE_CLIENT_ID, APPLE_TEAM_ID, etc.)
2. Restart backend: npm run dev
3. Navigate to http://localhost:8080/pages/auth.html
4. Click "Continue with Apple" button
5. A popup opens with Apple's login screen
6. Log in with your Apple ID
7. Authorize FLOWX access
✓ Should show "Login successful!" and redirect to dashboard
```

### Test 6: Invalid Credentials
```bash
1. With Google/Apple configured incorrectly
2. Click OAuth button
3. After authorization, backend attempts exchange
✓ Should show error: "Failed to obtain access token"
```

### Test 7: Logout
```bash
1. Log in successfully via any method
2. On dashboard, look for logout button/menu
3. Click logout
✓ Token should be cleared from sessionStorage
✓ Next navigation to protected page should redirect to auth
```

### Test 8: Refresh After Login
```bash
1. Log in via Google or Apple
2. Note the JWT in sessionStorage
3. Refresh the page
4. Navigate to dashboard
✓ Should stay logged in (JWT still in sessionStorage)
```

### Test 9: Protected Route Access
```bash
1. Without logging in, try to access http://localhost:8080/pages/dashboard.html
✓ Should redirect to auth.html
2. Log in
✓ Should be able to access dashboard
```

---

## Error Messages & Troubleshooting

### "Google OAuth is not configured"
- **Cause**: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set
- **Fix**: Add to backend/.env and restart

### "Failed to obtain access token from Google"
- **Cause**: Invalid Client ID/Secret or incorrect callback URL
- **Fix**: Verify credentials in Google Console and .env

### "Could not open Google auth popup"
- **Cause**: Browser blocked popup
- **Fix**: User needs to allow popups for this site

### "Apple OAuth is not configured"
- **Cause**: Apple credentials not fully set
- **Fix**: Add all Apple env vars: APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY

### Popup doesn't close after auth
- **Cause**: postMessage not reaching parent window
- **Fix**: Check browser console for errors, verify origin matches

### User exists with different provider
- **Scenario**: User A created account with Google, tries to log in with Email
- **Behavior**: Current implementation allows both, updates authProvider
- **Future**: Consider preventing this with provider-specific accounts

---

## Security Considerations

1. **Never expose secrets in frontend code**
   - Client ID can be public
   - Client Secret must stay in backend .env only
   - Apple private key must be protected

2. **HTTPS in production**
   - Callback URLs must use HTTPS in production
   - OAuth tokens should only be transmitted over HTTPS

3. **Token storage**
   - Currently stored in sessionStorage (clears on browser close)
   - Consider httpOnly cookies for higher security if needed

4. **CORS configuration**
   - Backend allows configured FRONTEND_URL
   - In production, set specific FRONTEND_URL value

---

## Modifications to Existing Code

### Summary of Changes

1. **backend/src/services/oauthService.js** - NEW
   - Complete OAuth flow implementation
   - Google and Apple token exchange
   - User lookup/creation logic

2. **backend/src/controllers/authController.js** - MODIFIED
   - Added 4 new OAuth controller methods
   - Preserved all existing auth methods

3. **backend/src/routes/authRoutes.js** - MODIFIED
   - Added 4 new OAuth routes
   - Preserved all existing routes

4. **backend/src/config/env.js** - MODIFIED
   - Added 8 OAuth environment variables
   - Maintained backward compatibility (all optional)

5. **js/auth.js** - MODIFIED
   - Added Google and Apple OAuth handlers
   - Fixed typo in signup form
   - Added button event listeners
   - Preserved all existing auth methods

6. **pages/oauth-callback.html** - NEW
   - OAuth callback handler
   - Token exchange from popup
   - Parent window communication

7. **Email/Password authentication** - UNCHANGED
   - All existing functionality preserved
   - Works independently of OAuth

---

## Next Steps (Optional Enhancements)

1. **Email verification** - Send verification email after signup
2. **Password reset** - Implement forgot password flow
3. **OAuth provider linking** - Allow users to add multiple providers
4. **User profile page** - Display and edit user information
5. **Two-factor authentication** - Add TOTP or SMS 2FA
6. **Session management** - Track active sessions, logout all devices
7. **Rate limiting** - Adjust per-provider rate limits
8. **Analytics** - Track which auth methods users prefer

---

## Support

For issues with OAuth setup:
1. Check the error message displayed on auth page
2. Verify environment variables in backend/.env
3. Check browser console for JavaScript errors
4. Verify redirect URLs match exactly in provider settings
5. Ensure backend is running and accessible at configured URL
