const authService = require('../services/authService');
const env = require('../config/environment');

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
  };
}

function setAuthCookie(res, token) {
  res.cookie('token', token, { ...cookieOptions(), maxAge: SEVEN_DAYS_MS });
}

async function register(req, res) {
  const { name, email, password } = req.body;
  const user = await authService.registerUser({ name, email, password });
  const token = authService.generateToken(user);
  setAuthCookie(res, token);
  res.status(201).json({ success: true, data: { user } });
}

async function login(req, res) {
  const { email, password } = req.body;
  const user = await authService.loginUser({ email, password });
  const token = authService.generateToken(user);
  setAuthCookie(res, token);
  res.status(200).json({ success: true, data: { user } });
}

async function logout(req, res) {
  res.clearCookie('token', cookieOptions());
  res.status(200).json({ success: true, data: {} });
}

async function me(req, res) {
  res.status(200).json({ success: true, data: { user: req.user } });
}

module.exports = { register, login, logout, me };
