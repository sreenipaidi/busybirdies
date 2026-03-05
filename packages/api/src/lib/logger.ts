import pino from 'pino';
import { getConfig } from '../config.js';

let _logger: pino.Logger | null = null;

/**
 * Get the application-level structured logger.
 * Uses pino for JSON structured logging in production
 * and pino-pretty for development.
 */
export function getLogger(): pino.Logger {
  if (!_logger) {
    const config = getConfig();
    _logger = pino({
      level: config.LOG_LEVEL,
      transport:
        config.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
            }
          : undefined,
    });
  }
  return _logger;
}
