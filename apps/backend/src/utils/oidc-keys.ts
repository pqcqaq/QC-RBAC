import { createPrivateKey, createPublicKey, generateKeyPairSync } from 'node:crypto';
import { env } from '../config/env.js';

const keyPair = (() => {
  if (env.OIDC_PRIVATE_KEY && env.OIDC_PUBLIC_KEY) {
    const privateKey = createPrivateKey(env.OIDC_PRIVATE_KEY.replace(/\\n/g, '\n'));
    const publicKey = createPublicKey(env.OIDC_PUBLIC_KEY.replace(/\\n/g, '\n'));

    return {
      privateKey,
      publicKey,
    };
  }

  const generated = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });

  return {
    privateKey: generated.privateKey,
    publicKey: generated.publicKey,
  };
})();

const publicJwk = {
  ...keyPair.publicKey.export({ format: 'jwk' }),
  use: 'sig',
  alg: 'RS256',
  kid: env.OIDC_KID,
};

export const oidcKeySet = {
  issuer: env.OAUTH_ISSUER.replace(/\/$/, ''),
  kid: env.OIDC_KID,
  privateKeyPem: keyPair.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
  publicKeyPem: keyPair.publicKey.export({ format: 'pem', type: 'spki' }).toString(),
  publicJwk,
};
