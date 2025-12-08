import { withErrorHandling } from '@/lib/api/error-handler';
import { verifyDatabaseConnection } from '@/lib/db';
import { internalError, success } from '@/lib/api/response';

export const GET = withErrorHandling(async () => {
  try {
    await verifyDatabaseConnection();
    return success({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Health check failed:', error);
    return internalError('Dependency check failed', 'HEALTH_FAILED');
  }
});


