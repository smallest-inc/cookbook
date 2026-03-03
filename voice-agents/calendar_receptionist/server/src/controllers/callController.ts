import { Request, Response, NextFunction } from 'express';
import smallestService from '../services/smallestService';

export async function startCall(req: Request, res: Response, next: NextFunction) {
  try {
    const { callerName, callerNumber } = req.body || {};
    // start a new session with Smallest.ai receptionist agent
    const session = await smallestService.startReceptionistSession({ callerName, callerNumber });
    res.json({ ok: true, session });
  } catch (err) {
    next(err);
  }
}

export default { startCall };
