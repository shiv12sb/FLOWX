const authService = require('../services/authService');
const { handleGoogleCallback, getGoogleAuthUrl, handleAppleCallback, getAppleAuthUrl } = require('../services/oauthService');

async function signup(req, res, next) {
  try {
    const { name, email, password, phone } = req.body;
    const result = await authService.signup({ name, email, password, phone });

    return res.status(201).json({
      success: true,
      message: 'Signup successful.',
      data: {
        user: result.user,
        token: result.token
      }
    });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });

    return res.json({
      success: true,
      message: 'Login successful.',
      data: {
        user: result.user,
        token: result.token
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getMe(req, res, next) {
  try {
    const user = await authService.getCurrentUser(req.user.id);
    return res.json({
      success: true,
      message: 'Current user loaded.',
      data: user
    });
  } catch (error) {
    next(error);
  }
}

async function logout(req, res) {
  return res.json({
    success: true,
    message: 'Logout successful. Remove the client token and redirect to login.'
  });
}

async function updateMe(req, res, next) {
  try {
    const { name, phone } = req.body || {};
    const user = await authService.updateCurrentUser(req.user.id, { name, phone });
    return res.json({
      success: true,
      message: 'Profile updated successfully.',
      data: user
    });
  } catch (error) {
    next(error);
  }
}

async function initiateGoogleAuth(req, res, next) {
  try {
    const url = getGoogleAuthUrl();
    return res.json({
      success: true,
      data: { url }
    });
  } catch (error) {
    next(error);
  }
}

async function googleCallback(req, res, next) {
  try {
    const code = req.body?.code || req.query?.code;
    const authError = req.query?.error || req.body?.error;

    if (authError) {
      const error = new Error(authError === 'access_denied' ? 'Google sign-in was cancelled.' : authError);
      error.statusCode = 401;
      throw error;
    }

    const result = await handleGoogleCallback(code);

    if (req.accepts('html') && !req.headers['content-type']?.includes('application/json')) {
      return res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><title>Google Sign In</title></head><body><script>window.opener && window.opener.postMessage({ type: 'oauth-callback', provider: 'google', token: ${JSON.stringify(result.token)} }, '*'); window.close();</script><p>Authentication successful. You can close this window.</p></body></html>`);
    }

    return res.json({
      success: true,
      message: 'Google authentication successful.',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function initiateAppleAuth(req, res, next) {
  try {
    const url = getAppleAuthUrl();
    return res.json({
      success: true,
      data: { url }
    });
  } catch (error) {
    next(error);
  }
}

async function appleCallback(req, res, next) {
  try {
    const code = req.body?.code || req.query?.code;
    const idToken = req.body?.id_token || req.query?.id_token;
    const authError = req.query?.error || req.body?.error;

    if (authError) {
      const error = new Error(authError === 'user_cancelled' ? 'Apple sign-in was cancelled.' : authError);
      error.statusCode = 401;
      throw error;
    }

    const result = await handleAppleCallback(code, idToken);

    if (req.accepts('html') && !req.headers['content-type']?.includes('application/json')) {
      return res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><title>Apple Sign In</title></head><body><script>window.opener && window.opener.postMessage({ type: 'oauth-callback', provider: 'apple', token: ${JSON.stringify(result.token)} }, '*'); window.close();</script><p>Authentication successful. You can close this window.</p></body></html>`);
    }

    return res.json({
      success: true,
      message: 'Apple authentication successful.',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  signup,
  login,
  getMe,
  updateMe,
  logout,
  initiateGoogleAuth,
  googleCallback,
  initiateAppleAuth,
  appleCallback
};
