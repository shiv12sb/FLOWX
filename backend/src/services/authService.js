const prisma = require('../config/database');
const { signToken } = require('../utils/jwt');
const { hashPassword, comparePassword } = require('../utils/password');

function sanitizeUser(user) {
  if (!user) return null;

  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

async function signup({ name, email, password, phone }) {
  const normalizedName = String(name || '').trim();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedPhone = phone ? String(phone).trim() : null;

  if (!normalizedName) {
    const error = new Error('Name is required.');
    error.statusCode = 400;
    throw error;
  }

  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    const error = new Error('A valid email address is required.');
    error.statusCode = 400;
    throw error;
  }

  if (!password || password.length < 8) {
    const error = new Error('Password must be at least 8 characters long.');
    error.statusCode = 400;
    throw error;
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (existingUser) {
    const error = new Error('An account with this email already exists.');
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name: normalizedName,
      email: normalizedEmail,
      phone: normalizedPhone,
      passwordHash,
      role: 'USER',
      authProvider: 'LOCAL',
      isActive: true
    }
  });

  const token = signToken({ userId: user.id, role: user.role });

  return {
    token,
    user: sanitizeUser(user)
  };
}

async function login({ email, password }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    const error = new Error('A valid email address is required.');
    error.statusCode = 400;
    throw error;
  }

  if (!password || password.length < 8) {
    const error = new Error('Password must be at least 8 characters long.');
    error.statusCode = 400;
    throw error;
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (!user || !user.isActive) {
    const error = new Error('Invalid email or password.');
    error.statusCode = 401;
    throw error;
  }

  const isPasswordValid = await comparePassword(password, user.passwordHash);

  if (!isPasswordValid) {
    const error = new Error('Invalid email or password.');
    error.statusCode = 401;
    throw error;
  }

  const token = signToken({ userId: user.id, role: user.role });

  return {
    token,
    user: sanitizeUser(user)
  };
}

async function getCurrentUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
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

  if (!user) {
    const error = new Error('User not found.');
    error.statusCode = 404;
    throw error;
  }

  return user;
}

async function updateCurrentUser(userId, updates = {}) {
  const name = String(updates.name || '').trim();
  const phoneValue = updates.phone === undefined ? undefined : String(updates.phone || '').trim();

  if (!name) {
    const error = new Error('Name is required.');
    error.statusCode = 400;
    throw error;
  }

  const data = {
    name,
    ...(phoneValue !== undefined ? { phone: phoneValue || null } : {})
  };

  const user = await prisma.user.update({
    where: { id: userId },
    data,
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

  return user;
}

module.exports = {
  signup,
  login,
  getCurrentUser,
  updateCurrentUser,
  sanitizeUser
};
