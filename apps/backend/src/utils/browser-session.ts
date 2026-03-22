import type { Response } from 'express';
import { env } from '../config/env.js';
import { accessTokenTtlSeconds } from './token.js';

export const getBrowserSessionCookieName = () => env.BROWSER_SESSION_COOKIE_NAME;

export const setBrowserSessionCookie = (res: Response, accessToken: string) => {
  res.cookie(getBrowserSessionCookieName(), accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
    maxAge: accessTokenTtlSeconds * 1000,
  });
};

export const clearBrowserSessionCookie = (res: Response) => {
  res.clearCookie(getBrowserSessionCookieName(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
  });
};
