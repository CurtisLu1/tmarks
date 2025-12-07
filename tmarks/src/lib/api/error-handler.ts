import type { NextResponse } from 'next/server';
import { badRequest, internalError, notFound } from './response';
import { DatabaseError, NotFoundError, ValidationError } from '@/lib/errors';

export function handleApiError(error: unknown): NextResponse {
  // eslint-disable-next-line no-console
  console.error('API Error:', error);

  if (error instanceof ValidationError) {
    return badRequest({
      code: 'VALIDATION_ERROR',
      message: error.message,
      details: error.fields,
    });
  }

  if (error instanceof NotFoundError) {
    return notFound(error.message, 'NOT_FOUND');
  }

  if (error instanceof DatabaseError) {
    return internalError('Database operation failed', 'DATABASE_ERROR');
  }

  if (error instanceof Error) {
    return internalError(error.message, 'INTERNAL_ERROR');
  }

  return internalError('An unexpected error occurred', 'INTERNAL_ERROR');
}

export function withErrorHandling<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<NextResponse>,
) {
  return async (...args: TArgs): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error);
    }
  };
}


