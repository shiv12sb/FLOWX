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
    message: 'Logout successful. Token should be removed from client storage.'
  });
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
    const { code } = req.body;
    const result = await handleGoogleCallback(code);

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
    const { code, id_token } = req.body;
    const result = await handleAppleCallback(code, id_token);

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
  logout,
  initiateGoogleAuth,
  googleCallback,
  initiateAppleAuth,
  appleCallback
};
