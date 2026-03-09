// Test setup file for Vitest
// We set test environment variables before any config module is loaded.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-that-is-256-bits-long!!';
process.env.JWT_ISSUER = 'busybirdies-test';
process.env.JWT_EMPLOYEE_EXPIRY = '8h';
process.env.JWT_CLIENT_EXPIRY = '24h';
process.env.DATABASE_URL = 'postgresql://supportdesk:supportdesk@localhost:5432/supportdesk_test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.LOG_LEVEL = 'silent';
process.env.SENDGRID_WEBHOOK_SECRET = 'test-webhook-secret-for-unit-tests';
