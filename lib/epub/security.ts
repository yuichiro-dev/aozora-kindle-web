import type { NextRequest } from 'next/server';

import { LIMIT_WINDOW_MS, MAX_REQUESTS } from './constants';

import type { RateLimitStore } from './types';

const rateLimitMap = new Map<string, RateLimitStore>();

function cleanupRateLimitMap(now: number) {
  if (rateLimitMap.size < 5000) {
    return;
  }

  for (const [ip, record] of rateLimitMap) {
    if (now > record.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}

export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for');

  return forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';
}

export function checkRateLimit(ip: string): {
  success: boolean;
  remaining: number;
} {
  const now = Date.now();

  cleanupRateLimitMap(now);

  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, {
      count: 1,
      resetTime: now + LIMIT_WINDOW_MS,
    });

    return {
      success: true,
      remaining: MAX_REQUESTS - 1,
    };
  }

  if (record.count >= MAX_REQUESTS) {
    return {
      success: false,
      remaining: 0,
    };
  }

  record.count += 1;

  return {
    success: true,
    remaining: MAX_REQUESTS - record.count,
  };
}
