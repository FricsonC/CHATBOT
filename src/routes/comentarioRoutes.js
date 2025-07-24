import express from 'express';
import { 
  createComentario, 
  getComentariosByCancha, 
  deleteComentario
} from '../controladores/comentarioCtrl.js';
import { verifyToken } from '../jwt/verifyToken.js';

const router = express.Router();

// Ruta pública
router.get('/cancha/:id_cancha', getComentariosByCancha);

// Rutas protegidas
router.post('/', verifyToken, createComentario);
router.delete('/:id', verifyToken, deleteComentario);

export default router;