import express from 'express';
import { registerUser, loginUser, getUserProfile, updateUserProfile, deleteUser, obtenerUsuarios, verificarBloqueoReservas} from '../controladores/usuarioCtrl.js';
import { verifyToken } from '../jwt/verifyToken.js';
import { upload } from '../config/multer.js';

const router = express.Router();

// Rutas públicas
router.post('/register', upload, registerUser);
router.post('/login', loginUser);
router.get('/usuario', obtenerUsuarios);
router.get('/usuarios/:id/bloqueo', verificarBloqueoReservas);


// Rutas protegidas


router.get('/:id', verifyToken, getUserProfile);
router.put('/profile', verifyToken, upload, updateUserProfile); // Añadido upload middleware
router.delete('/:id', verifyToken, deleteUser);

export default router;
