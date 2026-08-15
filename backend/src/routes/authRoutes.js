const express = require('express');
const authController = require('../controllers/authController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const { authRateLimit } = require('../middleware/rateLimitMiddleware');

const router = express.Router();

router.post('/signup', authRateLimit, authController.signup);
router.post('/login', authRateLimit, authController.login);
router.get('/me', authenticate, authController.getMe);
router.post('/logout', authenticate, authController.logout);

// OAuth routes
router.get('/google/initiate', authController.initiateGoogleAuth);
router.post('/google/callback', authController.googleCallback);
router.get('/apple/initiate', authController.initiateAppleAuth);
router.post('/apple/callback', authController.appleCallback);

module.exports = router;
