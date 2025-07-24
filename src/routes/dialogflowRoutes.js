import express from 'express';
import { enviarMensaje } from '../controllers/dialogflowCtrl.js';

const router = express.Router();

router.post('/', enviarMensaje); // POST /api/dialogflow

export default router;
