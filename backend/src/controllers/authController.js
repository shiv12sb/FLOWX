const authService = require('../services/authService');

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

module.exports = {
  signup,
  login,
  getMe,
  logout
};
