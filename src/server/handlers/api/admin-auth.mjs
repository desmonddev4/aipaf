import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

// Hash password using scrypt
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, 64);
  return `${salt}.${derivedKey.toString('hex')}`;
}

// Verify password against hash
export async function verifyPassword(password, hash) {
  const [salt, key] = hash.split('.');
  if (!salt || !key) return false;
  const derivedKey = await scryptAsync(password, salt, 64);
  return timingSafeEqual(Buffer.from(key, 'hex'), derivedKey);
}

// Generate 6-digit verification code
export function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Check if verification code is valid (not expired)
export function isVerificationCodeValid(expiresAt) {
  return new Date(expiresAt) > new Date();
}
