import { Router } from 'express';
import { startCall } from '../controllers/callController';

const router = Router();

// POST /api/start-call
router.post('/start-call', startCall);

export default router;
