import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

const deriveEncryptionKey = (secret: string) =>
  createHash('sha256').update(secret).digest();

const oauthEncryptionKey = deriveEncryptionKey(
  env.OAUTH_TOKEN_ENCRYPTION_SECRET || env.JWT_REFRESH_SECRET,
);

export const randomBase64Url = (bytes = 32) =>
  randomBytes(bytes).toString('base64url');

export const hashOpaqueToken = (value: string) =>
  createHash('sha256').update(value).digest('base64url');

export const encryptOAuthSecret = (value: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', oauthEncryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, encrypted, tag].map(item => item.toString('base64url')).join('.');
};

export const decryptOAuthSecret = (value: string) => {
  const [ivPart, encryptedPart, tagPart] = value.split('.');
  if (!ivPart || !encryptedPart || !tagPart) {
    throw new Error('Invalid encrypted secret payload');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    oauthEncryptionKey,
    Buffer.from(ivPart, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
};
