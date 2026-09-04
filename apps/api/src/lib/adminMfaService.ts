import jwt from 'jsonwebtoken';
import { generateSecret, generateURI, verify } from 'otplib';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';

const MFA_ISSUER = 'GOFAM Admin';

type AdminMfaTokenType = 'admin_mfa_setup' | 'admin_mfa_verify' | 'admin_password_reset';

interface AdminMfaTokenPayload {
  sub: string;
  type: AdminMfaTokenType;
}

export function createAdminMfaToken(userId: string, type: AdminMfaTokenType): string {
  return jwt.sign({ sub: userId, type }, env.JWT_SECRET, { expiresIn: '10m' });
}

export function verifyAdminMfaToken(token: string, expected: AdminMfaTokenType): string {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AdminMfaTokenPayload;
    if (payload.type !== expected) {
      throw new AppError('Invalid MFA session', 401);
    }
    return payload.sub;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('MFA session expired. Sign in again.', 401);
  }
}

export function beginAdminMfaSetup(email: string) {
  const secret = generateSecret();
  const otpauthUri = generateURI({
    issuer: MFA_ISSUER,
    label: email,
    secret,
  });
  return { secret, otpauthUri };
}

export async function verifyAdminTotp(secret: string, code: string): Promise<boolean> {
  const result = await verify({ secret, token: code });
  return result.valid;
}

export async function assertAdminTotp(secret: string, code: string) {
  const ok = await verifyAdminTotp(secret, code);
  if (!ok) {
    throw new AppError('Invalid authentication code', 401);
  }
}
