import bcrypt from 'bcryptjs';

export const hashPassword = (plainText: string) => bcrypt.hash(plainText, 10);
export const comparePassword = (plainText: string, hashed: string) =>
  bcrypt.compare(plainText, hashed);
