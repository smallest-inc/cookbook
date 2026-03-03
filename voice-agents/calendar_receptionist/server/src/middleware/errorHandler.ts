import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

export default function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  logger.error('unhandled_error', { message: err?.message, stack: err?.stack });
  const payload: Record<string, unknown> = { error: err?.message || 'Internal server error' };
  // Atoms extracts $.confirmationMessage - include it on confirm-meeting errors so Atoms doesn't crash
  if (req.path?.includes('confirm-meeting')) {
    payload.confirmationMessage = "I'm sorry, something went wrong while booking your meeting. Please try again or call back later.";
  }
  res.status(err?.status || 500).json(payload);
}
