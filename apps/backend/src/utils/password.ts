import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(nodeScrypt);
const secretLength = 64;

const deriveSecret = async (plainText: string, salt: string) => {
  const derived = await scrypt(plainText, salt, secretLength);
  return Buffer.isBuffer(derived) ? derived : Buffer.from(derived as ArrayBuffer);
};

const createSalt = () => randomBytes(16).toString('hex');

export const hashSecret = async (plainText: string, salt = createSalt()) => {
  const hash = await deriveSecret(plainText, salt);
  return {
    hash: hash.toString('hex'),
    salt,
  };
};

export const compareSecret = async (plainText: string, hashed: string, salt: string) => {
  const next = await deriveSecret(plainText, salt);
  const current = Buffer.from(hashed, 'hex');

  if (current.length !== next.length) {
    return false;
  }

  return timingSafeEqual(current, next);
};

export const hashPassword = hashSecret;
export const comparePassword = compareSecret;
