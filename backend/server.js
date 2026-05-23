const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_jwt_key_123';

// Roles válidos del sistema
const ROLES_VALIDOS = ['admin', 'usuario', 'vendedor', 'agente', 'transportista'];

// Middlewares
app.use(cors());
app.use(express.json());

// Servir archivos estáticos del frontend (carpeta frontend un nivel arriba)
app.use(express.static(path.join(__dirname, '../frontend')));

// ==========================================
// MIDDLEWARE DE AUTENTICACIÓN
// ==========================================

const verificarToken = (req, res, next) => {
    const headerAuth = req.headers['authorization'];
    if (!headerAuth) return res.status(403).json({ mensaje: 'No se proveyó un token' });

    const token = headerAuth.split(' ')[1];
    if (!token) return res.status(403).json({ mensaje: 'Formato de token inválido' });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ mensaje: 'Token inválido o expirado' });
        req.usuarioId = decoded.id;
        req.usuarioRol = decoded.rol;
        next();
    });
};

const soloAdmin = (req, res, next) => {
    if (req.usuarioRol !== 'admin') {
        return res.status(403).json({ mensaje: 'Acceso denegado: Se requiere rol de administrador' });
    }
    next();
};

// ==========================================
// RUTAS DE LA API
// ==========================================

// 1. POST /login - Autenticación de usuario
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ mensaje: 'Email y password son obligatorios' });
    }

    try {
        const [usuarios] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);
        if (usuarios.length === 0) {
            return res.status(401).json({ mensaje: 'Credenciales inválidas' });
        }

        const usuario = usuarios[0];

        const passwordValida = await bcrypt.compare(password, usuario.password);
        if (!passwordValida) {
            return res.status(401).json({ mensaje: 'Credenciales inválidas' });
        }

        const token = jwt.sign(
            { id: usuario.id, rol: usuario.rol },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            mensaje: 'Login exitoso',
            token,
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                email: usuario.email,
                rol: usuario.rol
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error en el servidor durante el login' });
    }
});

// 2. GET /usuarios - Listar usuarios (protegido: solo usuarios autenticados)
app.get('/usuarios', verificarToken, async (req, res) => {
    try {
        const [usuarios] = await db.query('SELECT id, nombre, email, rol, fecha_creacion FROM usuarios');
        res.json(usuarios);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al obtener usuarios' });
    }
});

// 3. POST /usuarios - Crear nuevo usuario (protegido: solo admin)
app.post('/usuarios', verificarToken, soloAdmin, async (req, res) => {
    const { nombre, email, password, rol } = req.body;

    if (!nombre || !email || !password) {
        return res.status(400).json({ mensaje: 'Nombre, email y password son obligatorios' });
    }

    if (!ROLES_VALIDOS.includes(rol)) {
        return res.status(400).json({ mensaje: `Rol inválido. Los roles permitidos son: ${ROLES_VALIDOS.join(', ')}` });
    }

    try {
        const [existentes] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
        if (existentes.length > 0) {
            return res.status(400).json({ mensaje: 'El email ya está registrado' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordEncriptada = await bcrypt.hash(password, salt);

        const [resultado] = await db.query(
            'INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)',
            [nombre, email, passwordEncriptada, rol]
        );

        res.status(201).json({
            mensaje: 'Usuario creado exitosamente',
            usuarioId: resultado.insertId
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al crear el usuario' });
    }
});

// 4. PUT /usuarios/:id - Actualizar usuario (protegido: solo admin)
app.put('/usuarios/:id', verificarToken, soloAdmin, async (req, res) => {
    const { id } = req.params;
    const { nombre, email, rol, password } = req.body;

    if (rol && !ROLES_VALIDOS.includes(rol)) {
        return res.status(400).json({ mensaje: `Rol inválido. Los roles permitidos son: ${ROLES_VALIDOS.join(', ')}` });
    }

    try {
        if (password && password.trim() !== '') {
            // Actualizar también la contraseña
            const salt = await bcrypt.genSalt(10);
            const passwordEncriptada = await bcrypt.hash(password, salt);
            const [resultado] = await db.query(
                'UPDATE usuarios SET nombre = ?, email = ?, rol = ?, password = ? WHERE id = ?',
                [nombre, email, rol, passwordEncriptada, id]
            );
            if (resultado.affectedRows === 0) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        } else {
            const [resultado] = await db.query(
                'UPDATE usuarios SET nombre = ?, email = ?, rol = ? WHERE id = ?',
                [nombre, email, rol, id]
            );
            if (resultado.affectedRows === 0) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        res.json({ mensaje: 'Usuario actualizado correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al actualizar el usuario' });
    }
});

// 5. DELETE /usuarios/:id - Eliminar usuario (protegido: solo admin)
app.delete('/usuarios/:id', verificarToken, soloAdmin, async (req, res) => {
    const { id } = req.params;

    // Evitar que el admin se elimine a sí mismo
    if (parseInt(id) === req.usuarioId) {
        return res.status(400).json({ mensaje: 'No puedes eliminar tu propia cuenta' });
    }

    try {
        const [resultado] = await db.query('DELETE FROM usuarios WHERE id = ?', [id]);
        if (resultado.affectedRows === 0) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }
        res.json({ mensaje: 'Usuario eliminado correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al eliminar el usuario' });
    }
});

// ==========================================
// RUTAS CRUD DE PRODUCTOS (FASE 1)
// ==========================================

// GET /productos - Listar productos (protegido: todos los usuarios autenticados)
app.get('/productos', verificarToken, async (req, res) => {
    try {
        const [productos] = await db.query('SELECT * FROM productos');
        res.json(productos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al obtener los productos' });
    }
});

// POST /productos - Crear un producto (protegido: solo admin)
app.post('/productos', verificarToken, soloAdmin, async (req, res) => {
    const { nombre, descripcion, precio, stock, categoria, imagen_url } = req.body;
    if (!nombre || precio === undefined || stock === undefined || !categoria) {
        return res.status(400).json({ mensaje: 'Nombre, precio, stock y categoría son obligatorios' });
    }
    try {
        const [resultado] = await db.query(
            'INSERT INTO productos (nombre, descripcion, precio, stock, categoria, imagen_url) VALUES (?, ?, ?, ?, ?, ?)',
            [nombre, descripcion, precio, stock, categoria, imagen_url || '']
        );
        res.status(201).json({ mensaje: 'Producto creado exitosamente', productoId: resultado.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al crear el producto' });
    }
});

// PUT /productos/:id - Actualizar un producto (protegido: solo admin)
app.put('/productos/:id', verificarToken, soloAdmin, async (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, precio, stock, categoria, imagen_url } = req.body;
    if (!nombre || precio === undefined || stock === undefined || !categoria) {
        return res.status(400).json({ mensaje: 'Nombre, precio, stock y categoría son obligatorios' });
    }
    try {
        const [resultado] = await db.query(
            'UPDATE productos SET nombre = ?, descripcion = ?, precio = ?, stock = ?, categoria = ?, imagen_url = ? WHERE id = ?',
            [nombre, descripcion, precio, stock, categoria, imagen_url || '', id]
        );
        if (resultado.affectedRows === 0) return res.status(404).json({ mensaje: 'Producto no encontrado' });
        res.json({ mensaje: 'Producto actualizado correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al actualizar el producto' });
    }
});

// DELETE /productos/:id - Eliminar un producto (protegido: solo admin)
app.delete('/productos/:id', verificarToken, soloAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const [resultado] = await db.query('DELETE FROM productos WHERE id = ?', [id]);
        if (resultado.affectedRows === 0) return res.status(404).json({ mensaje: 'Producto no encontrado' });
        res.json({ mensaje: 'Producto eliminado correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al eliminar el producto' });
    }
});

// ==========================================
// RUTAS CRUD DE CLIENTES (FASE 1)
// ==========================================

// GET /clientes - Listar clientes (protegido: todos los usuarios autenticados)
app.get('/clientes', verificarToken, async (req, res) => {
    try {
        const [clientes] = await db.query('SELECT * FROM clientes');
        res.json(clientes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al obtener los clientes' });
    }
});

// POST /clientes - Crear un cliente (protegido: solo admin)
app.post('/clientes', verificarToken, soloAdmin, async (req, res) => {
    const { nombre, email, telefono, direccion } = req.body;
    if (!nombre || !email) {
        return res.status(400).json({ mensaje: 'Nombre y email son obligatorios' });
    }
    try {
        const [existentes] = await db.query('SELECT id FROM clientes WHERE email = ?', [email]);
        if (existentes.length > 0) {
            return res.status(400).json({ mensaje: 'El email ya está registrado para otro cliente' });
        }
        const [resultado] = await db.query(
            'INSERT INTO clientes (nombre, email, telefono, direccion) VALUES (?, ?, ?, ?)',
            [nombre, email, telefono || '', direccion || '']
        );
        res.status(201).json({ mensaje: 'Cliente creado exitosamente', clienteId: resultado.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al crear el cliente' });
    }
});

// PUT /clientes/:id - Actualizar un cliente (protegido: solo admin)
app.put('/clientes/:id', verificarToken, soloAdmin, async (req, res) => {
    const { id } = req.params;
    const { nombre, email, telefono, direccion } = req.body;
    if (!nombre || !email) {
        return res.status(400).json({ mensaje: 'Nombre y email son obligatorios' });
    }
    try {
        const [existentes] = await db.query('SELECT id FROM clientes WHERE email = ? AND id != ?', [email, id]);
        if (existentes.length > 0) {
            return res.status(400).json({ mensaje: 'El email ya está registrado para otro cliente' });
        }
        const [resultado] = await db.query(
            'UPDATE clientes SET nombre = ?, email = ?, telefono = ?, direccion = ? WHERE id = ?',
            [nombre, email, telefono || '', direccion || '', id]
        );
        if (resultado.affectedRows === 0) return res.status(404).json({ mensaje: 'Cliente no encontrado' });
        res.json({ mensaje: 'Cliente actualizado correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al actualizar el cliente' });
    }
});

// DELETE /clientes/:id - Eliminar un cliente (protegido: solo admin)
app.delete('/clientes/:id', verificarToken, soloAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const [resultado] = await db.query('DELETE FROM clientes WHERE id = ?', [id]);
        if (resultado.affectedRows === 0) return res.status(404).json({ mensaje: 'Cliente no encontrado' });
        res.json({ mensaje: 'Cliente eliminado correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al eliminar el cliente' });
    }
});

// ==========================================
// RUTAS CRUD DE ENTREGAS / LOGÍSTICA (FASE 1)
// ==========================================

// GET /entregas - Listar entregas con JOIN (protegido: todos los usuarios autenticados)
app.get('/entregas', verificarToken, async (req, res) => {
    try {
        const [entregas] = await db.query(`
            SELECT e.id, e.cliente_id, e.producto_id, e.cantidad, e.estado_entrega, e.fecha,
                   c.nombre AS cliente_nombre, c.email AS cliente_email,
                   p.nombre AS producto_nombre, p.precio AS producto_precio
            FROM entregas e
            JOIN clientes c ON e.cliente_id = c.id
            JOIN productos p ON e.producto_id = p.id
            ORDER BY e.fecha DESC
        `);
        res.json(entregas);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al obtener las entregas' });
    }
});

// POST /entregas - Crear una entrega (protegido: solo admin)
app.post('/entregas', verificarToken, soloAdmin, async (req, res) => {
    const { cliente_id, producto_id, cantidad, estado_entrega } = req.body;
    if (!cliente_id || !producto_id || !cantidad) {
        return res.status(400).json({ mensaje: 'Cliente, producto y cantidad son obligatorios' });
    }
    try {
        const [resultado] = await db.query(
            'INSERT INTO entregas (cliente_id, producto_id, cantidad, estado_entrega) VALUES (?, ?, ?, ?)',
            [cliente_id, producto_id, cantidad, estado_entrega || 'pendiente']
        );
        res.status(201).json({ mensaje: 'Entrega creada exitosamente', entregaId: resultado.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al crear la entrega' });
    }
});

// PUT /entregas/:id - Actualizar una entrega (protegido: solo admin)
app.put('/entregas/:id', verificarToken, soloAdmin, async (req, res) => {
    const { id } = req.params;
    const { cliente_id, producto_id, cantidad, estado_entrega } = req.body;
    if (!cliente_id || !producto_id || !cantidad || !estado_entrega) {
        return res.status(400).json({ mensaje: 'Todos los campos son obligatorios' });
    }
    try {
        const [resultado] = await db.query(
            'UPDATE entregas SET cliente_id = ?, producto_id = ?, cantidad = ?, estado_entrega = ? WHERE id = ?',
            [cliente_id, producto_id, cantidad, estado_entrega, id]
        );
        if (resultado.affectedRows === 0) return res.status(404).json({ mensaje: 'Entrega no encontrada' });
        res.json({ mensaje: 'Entrega actualizada correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al actualizar la entrega' });
    }
});

// DELETE /entregas/:id - Eliminar una entrega (protegido: solo admin)
app.delete('/entregas/:id', verificarToken, soloAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const [resultado] = await db.query('DELETE FROM entregas WHERE id = ?', [id]);
        if (resultado.affectedRows === 0) return res.status(404).json({ mensaje: 'Entrega no encontrada' });
        res.json({ mensaje: 'Entrega eliminada correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al eliminar la entrega' });
    }
});

// ==========================================
// RUTAS AUTOSERVICIO DEL CLIENTE (FASE 3)
// ==========================================

/**
 * GET /api/pedidos/mis-pedidos
 * Devuelve únicamente los pedidos del cliente autenticado.
 * IMPORTANTE: esta ruta DEBE declararse ANTES de GET /api/pedidos/:id
 * para que Express no intente parsear "mis-pedidos" como un ID numérico.
 */
app.get('/api/pedidos/mis-pedidos', verificarToken, async (req, res) => {
    try {
        const [pedidos] = await db.query(`
            SELECT
                p.id,
                p.url_producto,
                p.precio_origen,
                p.arancel_calculado,
                p.total_a_pagar,
                p.estado,
                p.fecha_creacion,
                c.id   AS cliente_id,
                c.nombre AS cliente_nombre,
                c.email  AS cliente_email,
                a.id   AS agente_id,
                a.nombre AS agente_nombre
            FROM pedidos_importacion p
            JOIN usuarios c ON p.cliente_id = c.id
            LEFT JOIN usuarios a ON p.agente_id = a.id
            WHERE p.cliente_id = ?
            ORDER BY p.fecha_creacion DESC
        `, [req.usuarioId]);
        res.json(pedidos);
    } catch (error) {
        console.error('[GET /api/pedidos/mis-pedidos]', error);
        res.status(500).json({ mensaje: 'Error al obtener tus pedidos' });
    }
});

/**
 * POST /api/pedidos
 * El cliente registra una nueva solicitud de importación como Lead activo.
 * Body: { url_producto, precio_origen }
 * - cliente_id se extrae del JWT (req.usuarioId) — nunca del body.
 * - agente_id se asigna automáticamente al primer agente disponible en el sistema.
 */
app.post('/api/pedidos', verificarToken, async (req, res) => {
    const { url_producto, precio_origen } = req.body;

    if (!url_producto || !url_producto.trim()) {
        return res.status(400).json({ mensaje: 'La URL del producto es obligatoria' });
    }

    const precioNum = parseFloat(precio_origen) || 0;

    try {
        // Buscar automáticamente el primer agente disponible
        const [agentes] = await db.query(
            "SELECT id FROM usuarios WHERE rol = 'agente' ORDER BY id ASC LIMIT 1"
        );
        const agenteId = agentes.length > 0 ? agentes[0].id : null;

        const [result] = await db.query(
            `INSERT INTO pedidos_importacion
                (cliente_id, agente_id, url_producto, precio_origen, estado)
             VALUES (?, ?, ?, ?, 'cotizando')`,
            [req.usuarioId, agenteId, url_producto.trim(), precioNum]
        );

        // Devolver el pedido recién creado con JOIN completo
        const [rows] = await db.query(`
            SELECT
                p.id, p.url_producto, p.precio_origen, p.arancel_calculado,
                p.total_a_pagar, p.estado, p.fecha_creacion,
                c.id AS cliente_id, c.nombre AS cliente_nombre, c.email AS cliente_email,
                a.id AS agente_id, a.nombre AS agente_nombre
            FROM pedidos_importacion p
            JOIN  usuarios c ON p.cliente_id = c.id
            LEFT JOIN usuarios a ON p.agente_id = a.id
            WHERE p.id = ?
        `, [result.insertId]);

        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('[POST /api/pedidos]', error);
        res.status(500).json({ mensaje: 'Error al crear el pedido' });
    }
});

// ==========================================
// RUTAS DE PEDIDOS DE IMPORTACIÓN (FASE 2)
// ==========================================

/**
 * GET /api/pedidos
 * Lista todos los pedidos de importación con datos JOIN del cliente y agente.
 * Acceso: admin, agente.
 */
app.get('/api/pedidos', verificarToken, async (req, res) => {
    try {
        const [pedidos] = await db.query(`
            SELECT
                p.id,
                p.url_producto,
                p.precio_origen,
                p.arancel_calculado,
                p.total_a_pagar,
                p.estado,
                p.fecha_creacion,
                c.id   AS cliente_id,
                c.nombre AS cliente_nombre,
                c.email  AS cliente_email,
                c.rol    AS cliente_rol,
                a.id   AS agente_id,
                a.nombre AS agente_nombre
            FROM pedidos_importacion p
            JOIN usuarios c ON p.cliente_id = c.id
            LEFT JOIN usuarios a ON p.agente_id = a.id
            ORDER BY p.fecha_creacion DESC
        `);
        res.json(pedidos);
    } catch (error) {
        console.error('[GET /api/pedidos]', error);
        res.status(500).json({ mensaje: 'Error al obtener los pedidos' });
    }
});

/**
 * GET /api/pedidos/:id
 * Detalle de un pedido específico con datos de cliente y agente.
 */
app.get('/api/pedidos/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await db.query(`
            SELECT
                p.id, p.url_producto, p.precio_origen, p.arancel_calculado,
                p.total_a_pagar, p.estado, p.fecha_creacion,
                c.id AS cliente_id, c.nombre AS cliente_nombre, c.email AS cliente_email,
                a.id AS agente_id, a.nombre AS agente_nombre
            FROM pedidos_importacion p
            JOIN  usuarios c ON p.cliente_id = c.id
            LEFT JOIN usuarios a ON p.agente_id = a.id
            WHERE p.id = ?
        `, [id]);

        if (rows.length === 0) return res.status(404).json({ mensaje: 'Pedido no encontrado' });
        res.json(rows[0]);
    } catch (error) {
        console.error('[GET /api/pedidos/:id]', error);
        res.status(500).json({ mensaje: 'Error al obtener el pedido' });
    }
});

/**
 * PATCH /api/pedidos/:id/estado
 * Actualiza el estado de un pedido. Acceso: admin, agente.
 */
app.patch('/api/pedidos/:id/estado', verificarToken, async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;
    const estadosValidos = ['cotizando', 'esperando_pago', 'finalizado'];

    if (!estado || !estadosValidos.includes(estado)) {
        return res.status(400).json({ mensaje: `Estado inválido. Use: ${estadosValidos.join(', ')}` });
    }
    try {
        const [result] = await db.query('UPDATE pedidos_importacion SET estado = ? WHERE id = ?', [estado, id]);
        if (result.affectedRows === 0) return res.status(404).json({ mensaje: 'Pedido no encontrado' });
        res.json({ mensaje: 'Estado actualizado correctamente', estado });
    } catch (error) {
        console.error('[PATCH /api/pedidos/:id/estado]', error);
        res.status(500).json({ mensaje: 'Error al actualizar el estado' });
    }
});

/**
 * GET /api/pedidos/:id/mensajes
 * Retorna todos los mensajes de un pedido con eager loading:
 * trae nombre y rol del remitente (usuario) por JOIN.
 */
app.get('/api/pedidos/:id/mensajes', verificarToken, async (req, res) => {
    const { id } = req.params;
    try {
        // Verificar que el pedido exista
        const [pedido] = await db.query('SELECT id FROM pedidos_importacion WHERE id = ?', [id]);
        if (pedido.length === 0) return res.status(404).json({ mensaje: 'Pedido no encontrado' });

        const [mensajes] = await db.query(`
            SELECT
                m.id,
                m.pedido_id,
                m.contenido_mensaje,
                m.fecha_envio,
                u.id   AS usuario_id,
                u.nombre AS usuario_nombre,
                u.rol    AS usuario_rol
            FROM mensajes_chat m
            JOIN usuarios u ON m.usuario_id = u.id
            WHERE m.pedido_id = ?
            ORDER BY m.fecha_envio ASC
        `, [id]);

        res.json(mensajes);
    } catch (error) {
        console.error('[GET /api/pedidos/:id/mensajes]', error);
        res.status(500).json({ mensaje: 'Error al obtener los mensajes' });
    }
});

/**
 * POST /api/pedidos/:id/mensajes
 * Guarda un nuevo mensaje en la conversación de un pedido.
 * El remitente se extrae del token JWT (req.usuarioId).
 * Body: { contenido_mensaje: string }
 */
app.post('/api/pedidos/:id/mensajes', verificarToken, async (req, res) => {
    const { id } = req.params;
    const { contenido_mensaje } = req.body;

    if (!contenido_mensaje || contenido_mensaje.trim() === '') {
        return res.status(400).json({ mensaje: 'El contenido del mensaje no puede estar vacío' });
    }

    try {
        // Verificar que el pedido exista
        const [pedido] = await db.query('SELECT id FROM pedidos_importacion WHERE id = ?', [id]);
        if (pedido.length === 0) return res.status(404).json({ mensaje: 'Pedido no encontrado' });

        // Insertar el mensaje usando el ID del usuario autenticado
        const [result] = await db.query(
            'INSERT INTO mensajes_chat (pedido_id, usuario_id, contenido_mensaje) VALUES (?, ?, ?)',
            [id, req.usuarioId, contenido_mensaje.trim()]
        );

        // Devolver el mensaje recién creado con datos del remitente
        const [rows] = await db.query(`
            SELECT
                m.id, m.pedido_id, m.contenido_mensaje, m.fecha_envio,
                u.id AS usuario_id, u.nombre AS usuario_nombre, u.rol AS usuario_rol
            FROM mensajes_chat m
            JOIN usuarios u ON m.usuario_id = u.id
            WHERE m.id = ?
        `, [result.insertId]);

        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('[POST /api/pedidos/:id/mensajes]', error);
        res.status(500).json({ mensaje: 'Error al guardar el mensaje' });
    }
});

/**
 * POST /api/pedidos/:id/cotizar
 * Cierre de cotización: actualiza los campos económicos del pedido,
 * cambia estado a 'esperando_pago' y devuelve la URL del QR de pago.
 * Body: { precio_origen, arancel_calculado, total_a_pagar }
 */
app.post('/api/pedidos/:id/cotizar', verificarToken, async (req, res) => {
    const { id } = req.params;
    const { precio_origen, arancel_calculado, total_a_pagar } = req.body;

    if (precio_origen === undefined || arancel_calculado === undefined || total_a_pagar === undefined) {
        return res.status(400).json({ mensaje: 'Se requieren precio_origen, arancel_calculado y total_a_pagar' });
    }

    const precioNum  = parseFloat(precio_origen);
    const arancelNum = parseFloat(arancel_calculado);
    const totalNum   = parseFloat(total_a_pagar);

    if (isNaN(precioNum) || isNaN(arancelNum) || isNaN(totalNum) || totalNum <= 0) {
        return res.status(400).json({ mensaje: 'Los valores numéricos son inválidos o el total debe ser mayor a 0' });
    }

    try {
        // Verificar que el pedido exista
        const [pedidos] = await db.query('SELECT id, estado FROM pedidos_importacion WHERE id = ?', [id]);
        if (pedidos.length === 0) return res.status(404).json({ mensaje: 'Pedido no encontrado' });

        // Actualizar campos económicos y estado en una sola query atómica
        await db.query(
            `UPDATE pedidos_importacion
             SET precio_origen      = ?,
                 arancel_calculado  = ?,
                 total_a_pagar      = ?,
                 estado             = 'esperando_pago'
             WHERE id = ?`,
            [precioNum, arancelNum, totalNum, id]
        );

        // Generar URL dinámica del código QR (API pública, sin dependencias npm)
        const totalFormatted = totalNum.toFixed(2).replace('.', '_');
        const qrData = encodeURIComponent(`Pago_Pedido_${id}_Total_${totalFormatted}_USD`);
        const qrUrl  = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${qrData}`;

        res.json({
            mensaje:   'Cotización enviada exitosamente',
            estado:    'esperando_pago',
            pedido_id: parseInt(id),
            total_a_pagar: totalNum,
            qr_url:    qrUrl
        });

    } catch (error) {
        console.error('[POST /api/pedidos/:id/cotizar]', error);
        res.status(500).json({ mensaje: 'Error al procesar la cotización' });
    }
});

/**
 * POST /api/pedidos/:id/simular-pago
 * Webhook simulado del banco: confirma el pago, cierra el pedido
 * e inserta un mensaje automático del sistema en mensajes_chat.
 * El remitente es el agente asignado (o el usuario autenticado como fallback).
 */
app.post('/api/pedidos/:id/simular-pago', verificarToken, async (req, res) => {
    const { id } = req.params;

    try {
        // Verificar que el pedido exista y esté en estado correcto
        const [pedidos] = await db.query(
            'SELECT id, estado, agente_id, total_a_pagar FROM pedidos_importacion WHERE id = ?',
            [id]
        );
        if (pedidos.length === 0) return res.status(404).json({ mensaje: 'Pedido no encontrado' });

        const pedido = pedidos[0];
        if (pedido.estado === 'finalizado') {
            return res.status(409).json({ mensaje: 'Este pedido ya está finalizado' });
        }

        // Número de factura aleatorio (formato: FACT-YYYYMMDD-XXXXX)
        const now  = new Date();
        const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const rand = Math.floor(10000 + Math.random() * 90000);
        const facturaNum = `FACT-${date}-${rand}`;

        // Remitente del mensaje automático: agente del pedido o usuario autenticado
        const emisorId = pedido.agente_id || req.usuarioId;

        // 1. Cambiar estado a 'finalizado'
        await db.query(
            "UPDATE pedidos_importacion SET estado = 'finalizado' WHERE id = ?",
            [id]
        );

        // 2. Insertar mensaje automático del sistema
        const mensajeAutomatico = `✅ Pago confirmado exitosamente. Factura N°${facturaNum} emitida. Iniciando proceso logístico.`;
        const [insertResult] = await db.query(
            'INSERT INTO mensajes_chat (pedido_id, usuario_id, contenido_mensaje) VALUES (?, ?, ?)',
            [id, emisorId, mensajeAutomatico]
        );

        // 3. Recuperar el mensaje recién creado con datos del remitente (eager loading)
        const [mensajeRows] = await db.query(`
            SELECT
                m.id, m.pedido_id, m.contenido_mensaje, m.fecha_envio,
                u.id AS usuario_id, u.nombre AS usuario_nombre, u.rol AS usuario_rol
            FROM mensajes_chat m
            JOIN usuarios u ON m.usuario_id = u.id
            WHERE m.id = ?
        `, [insertResult.insertId]);

        res.json({
            mensaje:       'Pago simulado exitosamente',
            estado:        'finalizado',
            pedido_id:     parseInt(id),
            factura:       facturaNum,
            mensaje_chat:  mensajeRows[0]
        });

    } catch (error) {
        console.error('[POST /api/pedidos/:id/simular-pago]', error);
        res.status(500).json({ mensaje: 'Error al simular el pago' });
    }
});

// Ruta para servir el archivo index.html en la raíz
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
});
