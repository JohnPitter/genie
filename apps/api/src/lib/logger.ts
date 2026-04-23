import pino from 'pino';
import { getConfig } from './config.ts';

let _logger: pino.Logger | null = null;

export function getLogger(): pino.Logger {
  if (_logger) return _logger;
  const config = getConfig();
  const opts: pino.LoggerOptions = { level: config.LOG_LEVEL };
  if (config.NODE_ENV === 'development') {
    opts.transport = { target: 'pino-pretty', options: { colorize: true } };
  }
  _logger = pino(opts);
  return _logger;
}

export function createContextLogger(context: string): pino.Logger {
  return getLogger().child({ context });
}
