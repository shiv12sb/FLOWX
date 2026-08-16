const https = require('https');
const prisma = require('../config/database');
const { signToken } = require('../utils/jwt');
const env = require('../config/env');

/**
 * Helper function to make HTTPS POST requests
 */
function httpsPost(host, path, headers, body) {
  return new Promise((resolve, reject) => {
    const options = {
      host,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            body: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            body: data
          });
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * Helper function to make HTTPS GET requests
 */
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            body: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            body: data
          });
        }
      });
    }).on('error', reject);
  });
}

/**
 * Find or create user from Google OAuth
 */
async function handleGoogleCallback(code) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    const error = new Error('Google OAuth is not configured. Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET.');
    error.statusCode = 500;
    throw error;
  }

  if (!code) {
    const error = new Error('Authorization code missing from Google callback.');
    error.statusCode = 400;
    throw error;
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await httpsPost('oauth2.googleapis.com', '/token', {}, {
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_CALLBACK_URL,
      grant_type: 'authorization_code'
    });

    if (tokenResponse.statusCode !== 200 || !tokenResponse.body.access_token) {
      const error = new Error('Failed to obtain access token from Google.');
      error.statusCode = 401;
      throw error;
    }

    // Fetch user info from Google
    const userInfoResponse = await httpsGet(
      `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${tokenResponse.body.access_token}`
    );

    if (userInfoResponse.statusCode !== 200 || !userInfoResponse.body.email) {
      const error = new Error('Failed to fetch user information from Google.');
      error.statusCode = 401;
      throw error;
    }

    const { email, name, picture } = userInfoResponse.body;

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: name || email.split('@')[0],
          email,
          role: 'USER',
          authProvider: 'GOOGLE',
          isActive: true,
          passwordHash: null
        }
      });
    } else if (user.authProvider === 'LOCAL') {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { authProvider: 'GOOGLE' }
      });
    } else if (user.authProvider !== 'GOOGLE') {
      const error = new Error('This account is already linked to a different sign-in provider. Please use the original sign-in method.');
      error.statusCode = 409;
      throw error;
    }

    if (!user.isActive) {
      const error = new Error('User account is inactive.');
      error.statusCode = 401;
      throw error;
    }

    // Generate JWT
    const token = signToken({ userId: user.id, role: user.role });

    return {
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        authProvider: user.authProvider
      }
    };
  } catch (error) {
    if (error.statusCode) throw error;
    const err = new Error(`Google OAuth error: ${error.message}`);
    err.statusCode = 500;
    throw err;
  }
}

/**
 * Generate Google OAuth redirect URL
 */
function getGoogleAuthUrl() {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new Error('Google OAuth is not configured.');
  }

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_CALLBACK_URL,
    response_type: 'code',
    scope: 'openid profile email',
    access_type: 'offline'
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Find or create user from Apple OAuth
 */
async function handleAppleCallback(code, idToken) {
  if (!env.APPLE_CLIENT_ID || !env.APPLE_TEAM_ID || !env.APPLE_KEY_ID || !env.APPLE_PRIVATE_KEY) {
    const error = new Error('Apple OAuth is not configured. Missing required credentials.');
    error.statusCode = 500;
    throw error;
  }

  if (!code) {
    const error = new Error('Authorization code missing from Apple callback.');
    error.statusCode = 400;
    throw error;
  }

  try {
    // Decode id_token to extract user info (simplified)
    // In production, you should verify the JWT signature
    const base64Url = idToken.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      Buffer.from(base64, 'base64')
        .toString()
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    const payload = JSON.parse(jsonPayload);

    if (!payload.email) {
      const error = new Error('No email in Apple token.');
      error.statusCode = 400;
      throw error;
    }

    const email = payload.email;

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: payload.name || email.split('@')[0],
          email,
          role: 'USER',
          authProvider: 'APPLE',
          isActive: true,
          passwordHash: null
        }
      });
    } else if (user.authProvider === 'LOCAL') {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { authProvider: 'APPLE' }
      });
    } else if (user.authProvider !== 'APPLE') {
      const error = new Error('This account is already linked to a different sign-in provider. Please use the original sign-in method.');
      error.statusCode = 409;
      throw error;
    }

    if (!user.isActive) {
      const error = new Error('User account is inactive.');
      error.statusCode = 401;
      throw error;
    }

    // Generate JWT
    const token = signToken({ userId: user.id, role: user.role });

    return {
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        authProvider: user.authProvider
      }
    };
  } catch (error) {
    if (error.statusCode) throw error;
    const err = new Error(`Apple OAuth error: ${error.message}`);
    err.statusCode = 500;
    throw err;
  }
}

/**
 * Generate Apple OAuth redirect URL
 */
function getAppleAuthUrl() {
  if (!env.APPLE_CLIENT_ID) {
    throw new Error('Apple OAuth is not configured.');
  }

  const params = new URLSearchParams({
    client_id: env.APPLE_CLIENT_ID,
    redirect_uri: env.APPLE_CALLBACK_URL,
    response_type: 'code id_token',
    response_mode: 'form_post',
    scope: 'openid email',
    use_popup: 'true'
  });

  return `https://appleid.apple.com/auth/authorize?${params.toString()}`;
}

module.exports = {
  handleGoogleCallback,
  getGoogleAuthUrl,
  handleAppleCallback,
  getAppleAuthUrl
};
