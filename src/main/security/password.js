'use strict';

const crypto = require('crypto');

/**
 * Hash de contraseñas con scrypt (incluido en Node, sin dependencias nativas extra).
 * Formato almacenado:  scrypt$<saltHex>$<hashHex>
 */
const KEYLEN = 64;

function hashPassword(plain) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(String(plain), salt, KEYLEN);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

function verifyPassword(plain, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  const derived = crypto.scryptSync(String(plain), salt, expected.length);
  return crypto.timingSafeEqual(expected, derived);
}

module.exports = { hashPassword, verifyPassword };
