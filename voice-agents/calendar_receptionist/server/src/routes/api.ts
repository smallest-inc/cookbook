import { Router } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

router.get('/availability', (req, res) => {
  const p = path.resolve(__dirname, '../../outputs/availability.json');
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'no availability yet' });
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'failed to read availability' });
  }
});

router.get('/last-event', (req, res) => {
  const p = path.resolve(__dirname, '../../outputs/lastEvent.json');
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'no event yet' });
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'failed to read last event' });
  }
});

export default router;
