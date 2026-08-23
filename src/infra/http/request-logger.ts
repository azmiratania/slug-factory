import type { NextFunction, Request, Response } from 'express';

/** Structured request logging: method, path, status, latency. */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const latencyMs = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(
      JSON.stringify({
        level: 'info',
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        latency_ms: Math.round(latencyMs * 100) / 100,
      }),
    );
  });
  next();
}
