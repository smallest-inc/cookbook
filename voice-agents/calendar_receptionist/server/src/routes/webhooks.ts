import { Router } from 'express';
import { handleCheckAvailability, handleConfirmMeeting } from '../controllers/webhookController';

const router = Router();

router.post('/check-availability', handleCheckAvailability);
router.post('/confirm-meeting', handleConfirmMeeting);

export default router;
