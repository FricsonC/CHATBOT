import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { conmysql } from '../bd.js';
import { JWT_SECRET } from '../config.js';
import { upload } from '../config/multer.js';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

cloudinary.config({
  cloud_name: 'dhttyci5g',
  api_key: '665522465541433',
  api_secret: '4qXzO8uGt7UM9_o6NrlJZ50-18o'
});

function bufferToStream(buffer) {
  const readable = new Readable();
  readable.push(buffer);
  readable.push(null);
  return readable;
}

// Registrar nuevo usuario
export const registerUser = async (req, res) => {
  const connection = await conmysql.getConnection();
  await connection.beginTransaction();

  try {
    const { nombre, email, contrasena, telefono, direccion, fecha_nacimiento, genero, ocupacion, biografia, red_social } = req.body;
    const tipo_usuario = 'ciudadano';

    if (!nombre || !email || !contrasena || !fecha_nacimiento || !genero) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Faltan campos obligatorios' });
    }

    if (!['masculino', 'femenino', 'otro'].includes(genero.toLowerCase())) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Género no válido' });
    }

    const [existingUser] = await connection.query('SELECT id_usuario FROM usuarios WHERE email = ?', [email]);
    if (existingUser.length > 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'El correo ya está registrado' });
    }

    const hashedPassword = await bcrypt.hash(contrasena, 10);

    const [userResult] = await connection.query(
      `INSERT INTO usuarios (tipo_usuario, nombre, email, contrasena, telefono, direccion) VALUES (?, ?, ?, ?, ?, ?)`,
      [tipo_usuario, nombre, email, hashedPassword, telefono, direccion]
    );
    const userId = userResult.insertId;

    let fotoPerfilUrl = null;
    if (req.file && req.file.buffer) {
      fotoPerfilUrl = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({
          folder: 'usuarios_perfiles',
          transformation: { width: 500, height: 500, crop: 'limit' }
        }, async (error, result) => {
          if (error) {
            await connection.rollback();
            reject(error);
          } else {
            resolve(result.secure_url);
          }
        });
        bufferToStream(req.file.buffer).pipe(stream);
      });
    }

    await connection.query(
      `INSERT INTO perfiles_ciudadanos (id_usuario, foto_perfil, fecha_nacimiento, genero, ocupacion, biografia, red_social) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, fotoPerfilUrl, fecha_nacimiento, genero, ocupacion, biografia, red_social]
    );

    const token = jwt.sign({ id: userId, tipo_usuario }, JWT_SECRET, { expiresIn: '24h' });

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      data: {
        token,
        user: { id: userId, nombre, email, tipo_usuario },
        foto_perfil: fotoPerfilUrl
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error en registerUser:', error);
    res.status(500).json({ success: false, message: 'Error al registrar usuario', error: error.message });
  } finally {
    connection.release();
  }
};

// Iniciar sesión
export const loginUser = async (req, res) => {
  try {
    const { email, contrasena } = req.body;
    const [users] = await conmysql.query(
      `SELECT id_usuario, nombre, email, tipo_usuario, contrasena, activo FROM usuarios WHERE email = ? AND activo = 1`,
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado o inactivo' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(contrasena, user.contrasena);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }

    const token = jwt.sign({ id: user.id_usuario, tipo_usuario: user.tipo_usuario }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      data: {
        token,
        user: {
          id: user.id_usuario,
          nombre: user.nombre,
          email: user.email,
          tipo_usuario: user.tipo_usuario
        }
      }
    });
  } catch (error) {
    console.error('Error en loginUser:', error);
    res.status(500).json({ success: false, message: 'Error al iniciar sesión', error: error.message });
  }
};

// Obtener todos los usuarios ciudadanos (per_id = 2)
export const obtenerUsuarios = async (req, res) => {
  try {
    const [usuarios] = await conmysql.query(
      `SELECT u.id_usuario, u.nombre, u.email, u.telefono, u.direccion, 
              u.fecha_registro, pc.fecha_nacimiento, pc.genero, 
              pc.ocupacion, pc.biografia, pc.red_social
       FROM usuarios u
       LEFT JOIN perfiles_ciudadanos pc ON u.id_usuario = pc.id_usuario
       WHERE u.tipo_usuario = 'ciudadano' AND u.activo = 1`
    );

    res.json({
      success: true,
      data: usuarios
    });

  } catch (error) {
    console.error('Error al obtener ciudadanos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener ciudadanos'
    });
  }
};

// Obtener perfil de usuario
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.params.id;

    // Obtener datos básicos del usuario
    const [users] = await conmysql.query(
      `SELECT id_usuario, tipo_usuario, nombre, email, telefono, direccion, fecha_registro 
       FROM usuarios WHERE id_usuario = ? AND activo = 1`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Usuario no encontrado' 
      });
    }

    const user = users[0];
    const response = { user };

    // Si es ciudadano, obtener perfil
    if (user.tipo_usuario === 'ciudadano') {
      const [profiles] = await conmysql.query(
        `SELECT id_perfil_ciudadano, foto_perfil, fecha_nacimiento, genero, 
                ocupacion, biografia, red_social 
         FROM perfiles_ciudadanos WHERE id_usuario = ?`,
        [userId]
      );

      if (profiles.length > 0) {
        response.perfil = profiles[0];
      }
    }

    res.json({
      success: true,
      message: 'Perfil obtenido exitosamente',
      data: response
    });

  } catch (error) {
    return handleError(res, error, 'obtener perfil');
  }
};

// Actualizar perfil de usuario
export const updateUserProfile = async (req, res) => {
  const connection = await conmysql.getConnection();
  await connection.beginTransaction();

  try {
    const userId = req.user.id;
    const { nombre, telefono, direccion, fecha_nacimiento, genero, ocupacion, biografia, red_social } = req.body;

    // Actualizar datos básicos
    await connection.query(
      `UPDATE usuarios 
       SET nombre = ?, telefono = ?, direccion = ? 
       WHERE id_usuario = ?`,
      [nombre, telefono, direccion, userId]
    );

    // Verificar tipo de usuario
    const [user] = await connection.query(
      'SELECT tipo_usuario FROM usuarios WHERE id_usuario = ?',
      [userId]
    );

    if (user[0].tipo_usuario === 'ciudadano') {
      // Procesar imagen si se envió
      let fotoPerfilUrl = null;
      if (req.file) {
        try {
          // Eliminar imagen anterior si existe
          const [profile] = await connection.query(
            'SELECT foto_perfil FROM perfiles_ciudadanos WHERE id_usuario = ?',
            [userId]
          );

          if (profile.length > 0 && profile[0].foto_perfil) {
            const urlParts = profile[0].foto_perfil.split('/');
            const publicId = urlParts[urlParts.length - 1].split('.')[0];
            await cloudinary.uploader.destroy(`usuarios_perfiles/${publicId}`);
          }

          // Subir nueva imagen
          const uploadResult = await cloudinary.uploader.upload(req.file.path, {
            folder: 'usuarios_perfiles',
            transformation: { width: 500, height: 500, crop: 'limit' }
          });
          fotoPerfilUrl = uploadResult.secure_url;
        } catch (error) {
          await connection.rollback();
          return handleError(res, error, 'actualizar imagen de perfil');
        }
      }

      // Actualizar o crear perfil
      const [profile] = await connection.query(
        'SELECT id_perfil_ciudadano FROM perfiles_ciudadanos WHERE id_usuario = ?',
        [userId]
      );

      if (profile.length > 0) {
        await connection.query(
          `UPDATE perfiles_ciudadanos 
           SET fecha_nacimiento = ?, genero = ?, ocupacion = ?, 
               biografia = ?, red_social = ?, ${fotoPerfilUrl ? 'foto_perfil = ?,' : ''}
               fecha_actualizacion = CURRENT_TIMESTAMP 
           WHERE id_usuario = ?`,
          [fecha_nacimiento, genero, ocupacion, biografia, red_social, ...(fotoPerfilUrl ? [fotoPerfilUrl] : []), userId]
        );
      } else {
        await connection.query(
          `INSERT INTO perfiles_ciudadanos 
           (id_usuario, foto_perfil, fecha_nacimiento, genero, ocupacion, biografia, red_social) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [userId, fotoPerfilUrl, fecha_nacimiento, genero, ocupacion, biografia, red_social]
        );
      }
    }

    await connection.commit();
    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente'
    });

  } catch (error) {
    await connection.rollback();
    return handleError(res, error, 'actualizar perfil');
  } finally {
    connection.release();
  }
};

// Eliminar usuario
export const deleteUser = async (req, res) => {
  const connection = await conmysql.getConnection();
  await connection.beginTransaction();

  try {
    const userId = req.params.id;
    const requestingUserId = req.user.id;

    // Verificar permisos
    if (requestingUserId !== userId && req.user.tipo_usuario !== 'administrador') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para esta acción'
      });
    }

    // Obtener datos del usuario
    const [user] = await connection.query(
      'SELECT tipo_usuario FROM usuarios WHERE id_usuario = ?',
      [userId]
    );

    if (user.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Eliminar relaciones primero
    if (user[0].tipo_usuario === 'ciudadano') {
      // Eliminar imagen de perfil si existe
      const [profile] = await connection.query(
        'SELECT foto_perfil FROM perfiles_ciudadanos WHERE id_usuario = ?',
        [userId]
      );

      if (profile.length > 0 && profile[0].foto_perfil) {
        try {
          const urlParts = profile[0].foto_perfil.split('/');
          const publicId = urlParts[urlParts.length - 1].split('.')[0];
          await cloudinary.uploader.destroy(`usuarios_perfiles/${publicId}`);
        } catch (error) {
          console.error('Error al eliminar imagen:', error);
        }
      }

      await connection.query('DELETE FROM perfiles_ciudadanos WHERE id_usuario = ?', [userId]);
    }

    // Eliminar reservas y comentarios del usuario
    await connection.query('DELETE FROM comentarios_reservas WHERE id_usuario = ?', [userId]);
    
    // Obtener reservas para liberar disponibilidades
    const [reservas] = await connection.query(
      'SELECT id_disponibilidad FROM reservas WHERE id_usuario = ?',
      [userId]
    );
    
    await connection.query('DELETE FROM reservas WHERE id_usuario = ?', [userId]);
    
    // Liberar disponibilidades
    for (const reserva of reservas) {
      await connection.query(
        'UPDATE disponibilidad SET estado = "disponible" WHERE id_disponibilidad = ?',
        [reserva.id_disponibilidad]
      );
    }

    // Finalmente eliminar usuario
    await connection.query('DELETE FROM usuarios WHERE id_usuario = ?', [userId]);
    await connection.commit();

    res.json({
      success: true,
      message: 'Usuario eliminado exitosamente'
    });

  } catch (error) {
    await connection.rollback();
    return handleError(res, error, 'eliminar usuario');
  } finally {
    connection.release();
  }
};

//funcion para controlar el mensaje de bloqueo de reservas
// En un nuevo archivo o en authCtrl.js
export const verificarBloqueoReservas = async (req, res) => {
  try {
    const { id } = req.params;

    const [usuario] = await conmysql.query(
      `SELECT fecha_bloqueo_reservas 
       FROM usuarios 
       WHERE id_usuario = ?`,
      [id]
    );

    if (usuario.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const fechaBloqueo = usuario[0].fecha_bloqueo_reservas;

    if (!fechaBloqueo || new Date(fechaBloqueo) <= new Date()) {
      return res.json({ success: true, bloqueo: false });
    }

    const diasRestantes = Math.ceil(
      (new Date(fechaBloqueo) - new Date()) / (1000 * 60 * 60 * 24)
    );

    res.json({
      success: true,
      bloqueo: true,
      dias_restantes: diasRestantes,
      fecha_fin: fechaBloqueo
    });
  } catch (error) {
    return handleError(res, error, 'verificar bloqueo de reservas');
  }
};


export { upload };