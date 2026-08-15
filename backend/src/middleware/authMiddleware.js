const prisma = require('../config/database');
const { verifyToken } = require('../utils/jwt');

async function authenticate(req, res, next) {
  try {
    // Test bypass: set SKIP_AUTH_FOR_TEST=1 to allow routes to run in smoke tests
    if (process.env.SKIP_AUTH_FOR_TEST === '1' && req.user) return next();
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token missing.'
      });
    }

    const token = authHeader.replace('Bearer ', '').trim();

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token.'
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        authProvider: true,
        isActive: true,
        createdAt: true
      }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User account is inactive or not found.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this resource.'
      });
    }

    next();
  };
}

module.exports = {
  authenticate,
  requireRole
};
