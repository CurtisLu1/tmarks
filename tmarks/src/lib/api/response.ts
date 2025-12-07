import { NextResponse } from 'next/server';
import type { ApiError, ApiResponse } from '@/lib/types';

type ErrorInput = string | ApiError | Partial<ApiError>;

function normalizeError(error: ErrorInput, defaultCode: string, defaultMessage: string): ApiError {
  if (typeof error === 'string') {
    return { code: defaultCode, message: error };
  }

  return {
    code: error.code ?? defaultCode,
    message: error.message ?? defaultMessage,
    details: error.details,
  };
}

function respondWithError(error: ApiError, status: number, init?: ResponseInit) {
  return NextResponse.json<ApiResponse>({ error }, { status, ...init });
}

export function success<T>(data: T, meta?: ApiResponse['meta'], init?: ResponseInit) {
  const body: ApiResponse<T> = { data };
  if (meta) body.meta = meta;
  return NextResponse.json(body, { status: 200, ...init });
}

export function created<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiResponse<T>>({ data }, { status: 201, ...init });
}

export function noContent(init?: ResponseInit) {
  return new NextResponse(null, { status: 204, ...init });
}

export function badRequest(error: ErrorInput, code = 'BAD_REQUEST') {
  const normalized = normalizeError(error, code, 'Bad request');
  return respondWithError(normalized, 400);
}

export function unauthorized(error: ErrorInput, code = 'UNAUTHORIZED') {
  const normalized = normalizeError(error, code, 'Unauthorized');
  return respondWithError(normalized, 401);
}

export function forbidden(error: ErrorInput, code = 'FORBIDDEN') {
  const normalized = normalizeError(error, code, 'Forbidden');
  return respondWithError(normalized, 403);
}

export function notFound(message = 'Not found', code = 'NOT_FOUND') {
  const normalized: ApiError = { code, message };
  return respondWithError(normalized, 404);
}

export function conflict(message: string, code = 'CONFLICT') {
  const normalized: ApiError = { code, message };
  return respondWithError(normalized, 409);
}

export function tooManyRequests(error: ErrorInput, headers?: HeadersInit) {
  const normalized = normalizeError(error, 'RATE_LIMIT_EXCEEDED', 'Too many requests');
  return respondWithError(normalized, 429, { headers });
}

export function internalError(message = 'Internal server error', code = 'INTERNAL_ERROR') {
  const normalized: ApiError = { code, message };
  return respondWithError(normalized, 500);
}


