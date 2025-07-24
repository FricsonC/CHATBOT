import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';

export function verifyToken(req, res, next) {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'Token no proporcionado' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Compatibilidad con múltiples estructuras de token
    req.user = {
      id: decoded.id_usuario || decoded.id || decoded.userId,
      tipo_usuario: decoded.tipo_usuario || decoded.role
    };
    
    console.log('Usuario autenticado:', req.user); // Para depuración
    next();
  } catch (error) {
    console.error('Error en verificación de token:', error);
    res.status(401).json({ 
      success: false, 
      message: 'Token inválido o expirado',
      error: error.message 
    });
  }
}