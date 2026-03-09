import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { getConfig } from '../config.js';
import type { UserRole } from '@busybirdies/shared';

/** JWT payload shape for all tokens issued by the platform. */
export interface JwtPayload {
  /** Subject: user ID */
  sub: string;
  /** Tenant ID */
  tid: string;
  /** User role */
  role: UserRole;
  /** Issued at (Unix timestamp) */
  iat: number;
  /** Expiration (Unix timestamp) */
  exp: number;
}

/**
 * Parse a human-readable duration (e.g., '8h', '24h') into seconds.
 */
function parseExpiryToSeconds(expiry: string): number {
  const match = expiry.match(/^(\d+)([hms])$/);
  if (!match) {
    return 8 * 60 * 60; // default 8 hours
  }
  const value = parseInt(match[1] ?? '8', 10);
  const unit = match[2];
  switch (unit) {
    case 'h':
      return value * 60 * 60;
    case 'm':
      return value * 60;
    case 's':
      return value;
    default:
      return 8 * 60 * 60;
  }
}

/**
 * Sign a JWT token with the given payload and expiry duration.
 * @param payload - Object containing sub, tid, and role
 * @param expiresIn - Token lifetime (e.g., '8h', '24h')
 * @returns The signed JWT string
 */
export function signToken(
  payload: { sub: string; tid: string; role: UserRole },
  expiresIn: string,
): string {
  const config = getConfig();
  const options: SignOptions = {
    expiresIn: parseExpiryToSeconds(expiresIn),
    issuer: config.JWT_ISSUER,
  };
  return jwt.sign(payload, config.JWT_SECRET, options);
}

/**
 * Verify and decode a JWT token.
 * Throws if the token is invalid, expired, or has an incorrect issuer.
 * @param token - The JWT string to verify
 * @returns The decoded payload
 */
export function verifyToken(token: string): JwtPayload {
  const config = getConfig();
  const decoded = jwt.verify(token, config.JWT_SECRET, {
    issuer: config.JWT_ISSUER,
  });
  return decoded as JwtPayload;
}

/**
 * Compute the remaining TTL (in seconds) for a token from its expiration timestamp.
 * Returns 0 if the token is already expired.
 */
export function tokenRemainingTtl(exp: number): number {
  const remaining = exp - Math.floor(Date.now() / 1000);
  return remaining > 0 ? remaining : 0;
}
