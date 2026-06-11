const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const path = require('path');

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_jwt_key_123';

// Roles válidos del sistema
const ROLES_VALIDOS = ['admin', 'usuario', 'vendedor', 'agente', 'transportista'];

// Middlewares
app.use(cors());
app.use(express.json());

// Servir archivos estáticos del frontend
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

// GET /clientes - Listar clientes con conteo de cotizaciones (CRM)
app.get('/clientes', verificarToken, async (req, res) => {
    try {
        const [clientes] = await db.query(`
            SELECT
                c.id, c.nombre, c.email, c.telefono, c.direccion,
                c.estado, c.fecha_creacion,
                COUNT(CASE WHEN cot.estado = 'activa' THEN 1 END)  AS cotizaciones_activas,
                COUNT(CASE WHEN cot.estado = 'pagada' THEN 1 END)  AS cotizaciones_pagadas
            FROM clientes c
            LEFT JOIN cotizaciones cot ON cot.cliente_id = c.id
            GROUP BY c.id
            ORDER BY c.fecha_creacion DESC
        `);
        res.json(clientes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al obtener los clientes' });
    }
});

// POST /clientes - Crear un cliente (protegido: solo admin)
app.post('/clientes', verificarToken, soloAdmin, async (req, res) => {
    const { nombre, email, telefono, direccion, estado } = req.body;
    if (!nombre || !email) {
        return res.status(400).json({ mensaje: 'Nombre y email son obligatorios' });
    }
    const estadosValidos = ['en_atencion', 'atendido'];
    const estadoFinal = estadosValidos.includes(estado) ? estado : 'en_atencion';
    try {
        const [existentes] = await db.query('SELECT id FROM clientes WHERE email = ?', [email]);
        if (existentes.length > 0) {
            return res.status(400).json({ mensaje: 'El email ya está registrado para otro cliente' });
        }
        const [resultado] = await db.query(
            'INSERT INTO clientes (nombre, email, telefono, direccion, estado) VALUES (?, ?, ?, ?, ?)',
            [nombre, email, telefono || '', direccion || '', estadoFinal]
        );
        res.status(201).json({ mensaje: 'Cliente creado exitosamente', clienteId: resultado.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al crear el cliente' });
    }
});

// PUT /clientes/:id - Actualizar un cliente incluyendo estado (protegido: solo admin)
app.put('/clientes/:id', verificarToken, soloAdmin, async (req, res) => {
    const { id } = req.params;
    const { nombre, email, telefono, direccion, estado } = req.body;
    if (!nombre || !email) {
        return res.status(400).json({ mensaje: 'Nombre y email son obligatorios' });
    }
    const estadosValidos = ['en_atencion', 'atendido'];
    const estadoFinal = estadosValidos.includes(estado) ? estado : 'en_atencion';
    try {
        const [existentes] = await db.query('SELECT id FROM clientes WHERE email = ? AND id != ?', [email, id]);
        if (existentes.length > 0) {
            return res.status(400).json({ mensaje: 'El email ya está registrado para otro cliente' });
        }
        const [resultado] = await db.query(
            'UPDATE clientes SET nombre = ?, email = ?, telefono = ?, direccion = ?, estado = ? WHERE id = ?',
            [nombre, email, telefono || '', direccion || '', estadoFinal, id]
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
// RUTAS CRUD DE COTIZACIONES (CRM)
// ==========================================

// GET /cotizaciones - Listar todas las cotizaciones con datos del cliente (admin)
app.get('/cotizaciones', verificarToken, soloAdmin, async (req, res) => {
    try {
        const [cotizaciones] = await db.query(`
            SELECT cot.id, cot.cliente_id, cot.url_producto, cot.valor_cif,
                   cot.costo_total_aduana, cot.estado, cot.estado_logistico, cot.fecha_creacion,
                   c.nombre AS cliente_nombre, c.email AS cliente_email
            FROM cotizaciones cot
            JOIN clientes c ON cot.cliente_id = c.id
            ORDER BY cot.fecha_creacion DESC
        `);
        res.json(cotizaciones);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al obtener las cotizaciones' });
    }
});

/**
 * GET /todas-cotizaciones
 * Lista todas las cotizaciones. Acceso: admin y agente.
 */
app.get('/todas-cotizaciones', verificarToken, async (req, res) => {
    const rolesPermitidos = ['admin', 'agente'];
    if (!rolesPermitidos.includes(req.usuarioRol)) {
        return res.status(403).json({ mensaje: 'Acceso denegado' });
    }
    try {
        const [cotizaciones] = await db.query(`
            SELECT cot.id, cot.cliente_id, cot.url_producto, cot.valor_cif,
                   cot.costo_total_aduana, cot.estado, cot.estado_logistico, cot.fecha_creacion,
                   c.nombre AS cliente_nombre, c.email AS cliente_email
            FROM cotizaciones cot
            JOIN clientes c ON cot.cliente_id = c.id
            ORDER BY cot.fecha_creacion DESC
        `);
        res.json(cotizaciones);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al obtener las cotizaciones' });
    }
});

/**
 * GET /mis-cotizaciones
 * Devuelve las cotizaciones del cliente autenticado, identificado por su email.
 * Acceso: cualquier usuario autenticado.
 */
app.get('/mis-cotizaciones', verificarToken, async (req, res) => {
    try {
        // El usuario autenticado es un cliente registrado en la tabla clientes por email
        const [usuarios] = await db.query('SELECT email FROM usuarios WHERE id = ?', [req.usuarioId]);
        if (!usuarios.length) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        const email = usuarios[0].email;

        const [cotizaciones] = await db.query(`
            SELECT cot.id, cot.url_producto, cot.valor_cif,
                   cot.costo_total_aduana, cot.estado, cot.estado_logistico, cot.fecha_creacion,
                   c.nombre AS cliente_nombre
            FROM cotizaciones cot
            JOIN clientes c ON cot.cliente_id = c.id
            WHERE c.email = ?
            ORDER BY cot.fecha_creacion DESC
        `, [email]);
        res.json(cotizaciones);
    } catch (error) {
        console.error('[GET /mis-cotizaciones]', error);
        res.status(500).json({ mensaje: 'Error al obtener tus cotizaciones' });
    }
});

// GET /cotizaciones/cliente/:id - Cotizaciones de un cliente específico
app.get('/cotizaciones/cliente/:id', verificarToken, soloAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const [cotizaciones] = await db.query(
            'SELECT * FROM cotizaciones WHERE cliente_id = ? ORDER BY fecha_creacion DESC',
            [id]
        );
        res.json(cotizaciones);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al obtener las cotizaciones del cliente' });
    }
});

// POST /cotizaciones - Crear una cotización (protegido: solo admin)
app.post('/cotizaciones', verificarToken, soloAdmin, async (req, res) => {
    const { cliente_id, url_producto, valor_cif, costo_total_aduana, estado } = req.body;
    if (!cliente_id || !url_producto) {
        return res.status(400).json({ mensaje: 'El cliente y la URL del producto son obligatorios' });
    }
    const estadosValidos = ['activa', 'pagada'];
    const estadoFinal = estadosValidos.includes(estado) ? estado : 'activa';
    try {
        const [resultado] = await db.query(
            'INSERT INTO cotizaciones (cliente_id, url_producto, valor_cif, costo_total_aduana, estado) VALUES (?, ?, ?, ?, ?)',
            [cliente_id, url_producto, valor_cif || null, costo_total_aduana || null, estadoFinal]
        );
        res.status(201).json({ mensaje: 'Cotización creada exitosamente', cotizacionId: resultado.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al crear la cotización' });
    }
});

// PUT /cotizaciones/:id - Actualizar estado de una cotización (protegido: solo admin)
app.put('/cotizaciones/:id', verificarToken, soloAdmin, async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;
    const estadosValidos = ['activa', 'pagada'];
    if (!estadosValidos.includes(estado)) {
        return res.status(400).json({ mensaje: `Estado inválido. Use: ${estadosValidos.join(', ')}` });
    }
    try {
        const [resultado] = await db.query('UPDATE cotizaciones SET estado = ? WHERE id = ?', [estado, id]);
        if (resultado.affectedRows === 0) return res.status(404).json({ mensaje: 'Cotización no encontrada' });
        res.json({ mensaje: 'Cotización actualizada correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al actualizar la cotización' });
    }
});

/**
 * PUT /cotizaciones/:id/estado-logistico
 * Actualiza el estado logístico de una cotización.
 * Acceso: admin y agente.
 */
app.put('/cotizaciones/:id/estado-logistico', verificarToken, async (req, res) => {
    const rolesPermitidos = ['admin', 'agente'];
    if (!rolesPermitidos.includes(req.usuarioRol)) {
        return res.status(403).json({ mensaje: 'Acceso denegado: se requiere rol admin o agente' });
    }
    const { id } = req.params;
    const { estado_logistico } = req.body;
    const estadosValidos = ['pendiente', 'comprado', 'en_camino', 'en_aduana', 'listo_para_recoger'];
    if (!estadosValidos.includes(estado_logistico)) {
        return res.status(400).json({ mensaje: `Estado logístico inválido. Use: ${estadosValidos.join(', ')}` });
    }
    try {
        const [resultado] = await db.query(
            'UPDATE cotizaciones SET estado_logistico = ? WHERE id = ?',
            [estado_logistico, id]
        );
        if (resultado.affectedRows === 0) return res.status(404).json({ mensaje: 'Cotización no encontrada' });
        res.json({ mensaje: 'Estado logístico actualizado correctamente', estado_logistico });
    } catch (error) {
        console.error('[PUT /cotizaciones/:id/estado-logistico]', error);
        res.status(500).json({ mensaje: 'Error al actualizar el estado logístico' });
    }
});

// DELETE /cotizaciones/:id - Eliminar una cotización (protegido: solo admin)
app.delete('/cotizaciones/:id', verificarToken, soloAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const [resultado] = await db.query('DELETE FROM cotizaciones WHERE id = ?', [id]);
        if (resultado.affectedRows === 0) return res.status(404).json({ mensaje: 'Cotización no encontrada' });
        res.json({ mensaje: 'Cotización eliminada correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al eliminar la cotización' });
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
 * GET /api/admin/pedidos
 * Endpoint dedicado para el panel de Admin.
 * Devuelve todos los pedidos con JOIN a la tabla de usuarios
 * para obtener el nombre del cliente.
 * Acceso: solo admin.
 */
app.get('/api/admin/pedidos', verificarToken, soloAdmin, async (req, res) => {
    try {
        const [pedidos] = await db.query(`
            SELECT
                p.id,
                u.nombre  AS cliente_nombre,
                u.email   AS cliente_email,
                p.url_producto,
                p.total_a_pagar,
                p.estado,
                p.fecha_creacion
            FROM pedidos_importacion p
            JOIN usuarios u ON p.cliente_id = u.id
            ORDER BY p.fecha_creacion DESC
        `);
        res.json(pedidos);
    } catch (error) {
        console.error('[GET /api/admin/pedidos]', error);
        res.status(500).json({ mensaje: 'Error al obtener los pedidos' });
    }
});


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
    const estadosValidos = ['cotizando', 'esperando_pago', 'pago_confirmado', 'siendo_comprado', 'en_transito', 'en_aduana', 'entregado', 'cancelado', 'finalizado'];

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

    const precioNum = parseFloat(precio_origen);
    const arancelNum = parseFloat(arancel_calculado);
    const totalNum = parseFloat(total_a_pagar);

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

        // Generar URL dinámica del código QR que apunta al endpoint público de confirmación
        const confirmUrl = `${req.protocol}://${req.get('host')}/api/pedidos/${id}/confirmar-qr`;
        const qrData = encodeURIComponent(confirmUrl);
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${qrData}`;

        res.json({
            mensaje: 'Cotización enviada exitosamente',
            estado: 'esperando_pago',
            pedido_id: parseInt(id),
            total_a_pagar: totalNum,
            qr_url: qrUrl
        });

    } catch (error) {
        console.error('[POST /api/pedidos/:id/cotizar]', error);
        res.status(500).json({ mensaje: 'Error al procesar la cotización' });
    }
});

/**
 * Función interna compartida: confirma el pago de un pedido.
 * Cambia el estado a 'pago_confirmado' e inserta un mensaje automático.
 * @param {number|string} id - ID del pedido
 * @param {number|null} emisorIdOverride - ID del usuario emisor del mensaje (si se conoce)
 * @returns {object} { facturaNum, mensajeRow, pedido }
 */
async function _procesarConfirmacionPago(id, emisorIdOverride = null) {
    // Verificar que el pedido exista
    const [pedidos] = await db.query(
        'SELECT id, estado, agente_id, total_a_pagar FROM pedidos_importacion WHERE id = ?',
        [id]
    );
    if (pedidos.length === 0) throw Object.assign(new Error('Pedido no encontrado'), { statusCode: 404 });

    const pedido = pedidos[0];
    // Bloquear si el pago ya fue procesado en cualquier estado posterior a 'esperando_pago'
    const ESTADOS_YA_PAGADOS = [
        'pago_confirmado', 'siendo_comprado', 'en_transito',
        'en_aduana', 'listo_para_entrega', 'entregado', 'finalizado'
    ];
    if (ESTADOS_YA_PAGADOS.includes(pedido.estado)) {
        throw Object.assign(new Error('Este pedido ya tiene el pago confirmado'), { statusCode: 409 });
    }

    // Número de factura aleatorio (formato: FACT-YYYYMMDD-XXXXX)
    const now = new Date();
    const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const rand = Math.floor(10000 + Math.random() * 90000);
    const facturaNum = `FACT-${date}-${rand}`;

    // Remitente del mensaje: agente asignado al pedido, o emisorIdOverride como fallback
    const emisorId = pedido.agente_id || emisorIdOverride;
    if (!emisorId) throw Object.assign(new Error('No hay agente asignado para emitir el mensaje'), { statusCode: 422 });

    // 1. Cambiar estado a 'pago_confirmado'
    await db.query(
        "UPDATE pedidos_importacion SET estado = 'pago_confirmado' WHERE id = ?",
        [id]
    );

    // 2. Insertar mensaje automático del sistema
    const mensajeAutomatico = `✅ Pago confirmado exitosamente. Factura N°${facturaNum} emitida. El agente iniciará la compra pronto.`;
    const [insertResult] = await db.query(
        'INSERT INTO mensajes_chat (pedido_id, usuario_id, contenido_mensaje) VALUES (?, ?, ?)',
        [id, emisorId, mensajeAutomatico]
    );

    // 3. Recuperar el mensaje recién creado con datos del remitente
    const [mensajeRows] = await db.query(`
        SELECT
            m.id, m.pedido_id, m.contenido_mensaje, m.fecha_envio,
            u.id AS usuario_id, u.nombre AS usuario_nombre, u.rol AS usuario_rol
        FROM mensajes_chat m
        JOIN usuarios u ON m.usuario_id = u.id
        WHERE m.id = ?
    `, [insertResult.insertId]);

    return { facturaNum, mensajeRow: mensajeRows[0], pedido };
}

/**
 * POST /api/pedidos/:id/simular-pago
 * Webhook simulado del banco: confirma el pago, cambia estado a 'pago_confirmado'
 * e inserta un mensaje automático del sistema en mensajes_chat.
 * El remitente es el agente asignado (o el usuario autenticado como fallback).
 */
app.post('/api/pedidos/:id/simular-pago', verificarToken, async (req, res) => {
    const { id } = req.params;
    console.log(`\n🚀 [INICIO] Simulando pago para el pedido ID: ${id}`);

    try {
        const { facturaNum, mensajeRow } = await _procesarConfirmacionPago(id, req.usuarioId);

        console.log(`✅ [ÉXITO] _procesarConfirmacionPago terminó. Enviando estado 'pago_confirmado' al frontend.`);
        res.json({
            mensaje: 'Pago simulado exitosamente',
            estado: 'pago_confirmado',
            pedido_id: parseInt(id),
            factura: facturaNum,
            mensaje_chat: mensajeRow
        });

    } catch (error) {
        console.error('❌ [ERROR en simular-pago]:', error);
        const status = error.statusCode || 500;
        res.status(status).json({ mensaje: error.message || 'Error al simular el pago' });
    }
});

async function _procesarConfirmacionPago(id, emisorIdOverride = null) {
    console.log(`🛠️ [PROCESANDO] Entrando a _procesarConfirmacionPago para pedido ID: ${id}`);

    const [pedidos] = await db.query('SELECT id, estado, agente_id FROM pedidos_importacion WHERE id = ?', [id]);
    if (pedidos.length === 0) throw Object.assign(new Error('Pedido no encontrado'), { statusCode: 404 });

    const pedido = pedidos[0];
    const emisorId = pedido.agente_id || emisorIdOverride;

    console.log(`📝 [BASE DE DATOS] Haciendo UPDATE a 'pago_confirmado'...`);

    // 1. Cambiar estado a 'pago_confirmado'
    await db.query("UPDATE pedidos_importacion SET estado = 'pago_confirmado' WHERE id = ?", [id]);

    console.log(`✔️ [BASE DE DATOS] UPDATE terminado.`);

    // 2. Insertar mensaje automático
    const facturaNum = `FACT-TEST-${Math.floor(Math.random() * 90000)}`;
    const mensajeAutomatico = `✅ Pago confirmado exitosamente. Factura N°${facturaNum} emitida.`;

    const [insertResult] = await db.query(
        'INSERT INTO mensajes_chat (pedido_id, usuario_id, contenido_mensaje) VALUES (?, ?, ?)',
        [id, emisorId, mensajeAutomatico]
    );

    const [mensajeRows] = await db.query(`SELECT m.*, u.nombre AS usuario_nombre FROM mensajes_chat m JOIN usuarios u ON m.usuario_id = u.id WHERE m.id = ?`, [insertResult.insertId]);

    console.log(`🏁 [FIN] Saliendo de _procesarConfirmacionPago.`);
    return { facturaNum, mensajeRow: mensajeRows[0], pedido };
}

/**
 * GET /api/pedidos/:id/confirmar-qr
 * Endpoint PÚBLICO (sin token) que simula la acción de escanear el QR.
 * Confirma el pago del pedido, cambia estado a 'pago_confirmado' y
 * devuelve una página HTML de confirmación amigable.
 */
app.get('/api/pedidos/:id/confirmar-qr', async (req, res) => {
    const { id } = req.params;

    try {
        const { facturaNum } = await _procesarConfirmacionPago(id, null);

        // Devolver página HTML de confirmación
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pago Confirmado — TechStore Imports</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 1.5rem;
    }
    .card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 1.5rem;
      padding: 2.5rem 2rem;
      max-width: 420px;
      width: 100%;
      text-align: center;
      backdrop-filter: blur(12px);
      box-shadow: 0 25px 50px rgba(0,0,0,0.5);
    }
    .icon { font-size: 3.5rem; margin-bottom: 1rem; }
    h1 { color: #34d399; font-size: 1.375rem; font-weight: 800; margin-bottom: 0.5rem; }
    .subtitle { color: #94a3b8; font-size: 0.875rem; line-height: 1.6; margin-bottom: 1.5rem; }
    .factura {
      background: rgba(52,211,153,0.1);
      border: 1px solid rgba(52,211,153,0.25);
      border-radius: 0.75rem;
      padding: 0.75rem 1rem;
      color: #6ee7b7;
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      margin-bottom: 1.5rem;
    }
    .note { color: #64748b; font-size: 0.75rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>Pago Registrado Correctamente</h1>
    <p class="subtitle">
      Tu pago ha sido confirmado y tu solicitud de importación
      ha pasado al siguiente estado. El agente iniciará la compra pronto.
    </p>
    <div class="factura">Factura N° ${facturaNum}</div>
    <p class="note">Puedes cerrar esta ventana y volver a la aplicación.</p>
  </div>
</body>
</html>`);

    } catch (error) {
        console.error('[GET /api/pedidos/:id/confirmar-qr]', error);
        const status = error.statusCode || 500;

        // Para errores (ej: ya confirmado), también devolver HTML amigable
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.status(status).send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aviso — TechStore Imports</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 1.5rem;
    }
    .card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 1.5rem;
      padding: 2.5rem 2rem;
      max-width: 420px;
      width: 100%;
      text-align: center;
      backdrop-filter: blur(12px);
    }
    .icon { font-size: 3.5rem; margin-bottom: 1rem; }
    h1 { color: #f59e0b; font-size: 1.25rem; font-weight: 800; margin-bottom: 0.5rem; }
    .msg { color: #94a3b8; font-size: 0.875rem; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">ℹ️</div>
    <h1>Aviso</h1>
    <p class="msg">${error.message || 'Ocurrió un error al procesar la confirmación.'}</p>
  </div>
</body>
</html>`);
    }
});


/**
 * PUT /api/pedidos/:id/estado
 * Permite al agente actualizar el pedido a los nuevos estados logísticos.
 * Inserta automáticamente un mensaje en el chat informando al cliente del nuevo estado.
 * Acceso: admin, agente.
 */
app.put('/api/pedidos/:id/estado', verificarToken, async (req, res) => {
    const rolesPermitidos = ['admin', 'agente'];
    if (!rolesPermitidos.includes(req.usuarioRol)) {
        return res.status(403).json({ mensaje: 'Acceso denegado: se requiere rol admin o agente' });
    }

    const { id } = req.params;
    const { estado } = req.body;

    const ESTADOS_LOGISTICOS = [
        'siendo_comprado',
        'en_transito',
        'en_aduana',
        'listo_para_entrega',
        'entregado'
    ];

    if (!estado || !ESTADOS_LOGISTICOS.includes(estado)) {
        return res.status(400).json({
            mensaje: `Estado inválido. Los estados logísticos permitidos son: ${ESTADOS_LOGISTICOS.join(', ')}`
        });
    }

    // Mensajes automáticos por estado
    const MENSAJES_ESTADO = {
        'siendo_comprado': '🛒 ¡Excelente! Tu agente ha iniciado la compra del producto en origen. Te mantendremos informado/a.',
        'en_transito': '✈️ Tu paquete está en tránsito hacia Bolivia. El envío internacional está en camino.',
        'en_aduana': '🏛️ Tu paquete llegó a Bolivia y está siendo procesado por la Aduana Nacional. Este proceso puede tomar unos días.',
        'listo_para_entrega': '📦 ¡Tu paquete está listo para entrega! Nuestro equipo coordinará la entrega contigo muy pronto.',
        'entregado': '🏁 ¡Tu importación fue entregada exitosamente! Gracias por confiar en TechStore Imports. ¡Disfruta tu producto!'
    };

    try {
        // Verificar que el pedido exista y obtener el agente asignado
        const [pedidos] = await db.query(
            'SELECT id, estado, agente_id FROM pedidos_importacion WHERE id = ?',
            [id]
        );
        if (pedidos.length === 0) {
            return res.status(404).json({ mensaje: 'Pedido no encontrado' });
        }

        const pedido = pedidos[0];

        // Actualizar el estado del pedido
        await db.query(
            'UPDATE pedidos_importacion SET estado = ? WHERE id = ?',
            [estado, id]
        );

        // Determinar el emisor del mensaje: agente asignado o el usuario autenticado
        const emisorId = pedido.agente_id || req.usuarioId;

        // Insertar mensaje automático en el chat
        const mensajeAutomatico = MENSAJES_ESTADO[estado];
        const [insertResult] = await db.query(
            'INSERT INTO mensajes_chat (pedido_id, usuario_id, contenido_mensaje) VALUES (?, ?, ?)',
            [id, emisorId, mensajeAutomatico]
        );

        // Recuperar el mensaje recién creado con datos del remitente
        const [mensajeRows] = await db.query(`
            SELECT
                m.id, m.pedido_id, m.contenido_mensaje, m.fecha_envio,
                u.id AS usuario_id, u.nombre AS usuario_nombre, u.rol AS usuario_rol
            FROM mensajes_chat m
            JOIN usuarios u ON m.usuario_id = u.id
            WHERE m.id = ?
        `, [insertResult.insertId]);

        res.json({
            mensaje: 'Estado logístico actualizado correctamente',
            estado,
            pedido_id: parseInt(id),
            mensaje_chat: mensajeRows[0]
        });

    } catch (error) {
        console.error('[PUT /api/pedidos/:id/estado]', error);
        res.status(500).json({ mensaje: 'Error al actualizar el estado logístico' });
    }
});

// 30. POST /calcular-importacion - Calculadora de Importaciones para Bolivia (público)
app.post('/calcular-importacion', async (req, res) => {
    try {
        const { url_producto, precio_fob, costo_envio } = req.body;

        if (!url_producto || typeof url_producto !== 'string' || url_producto.trim() === '') {
            return res.status(400).json({ mensaje: 'El enlace del producto (url_producto) es obligatorio.' });
        }

        const fPrecioFob = (precio_fob !== undefined && precio_fob !== null && precio_fob !== '') ? Number(precio_fob) : NaN;
        const tienePrecio = !isNaN(fPrecioFob) && fPrecioFob > 0;

        if (tienePrecio) {
            const fCostoEnvio = (costo_envio !== undefined && costo_envio !== null && costo_envio !== '') ? Number(costo_envio) : NaN;
            if (isNaN(fCostoEnvio) || fCostoEnvio < 0) {
                return res.status(400).json({ mensaje: 'El costo de envío es obligatorio y debe ser mayor o igual a 0.' });
            }

            const valor_cif = parseFloat((fPrecioFob + fCostoEnvio).toFixed(2));
            const iva_importacion = parseFloat((valor_cif * (13 / 87)).toFixed(2));
            const costo_total_aduana = parseFloat((valor_cif + iva_importacion).toFixed(2));

            return res.json({
                valor_cif,
                iva_importacion,
                costo_total_aduana
            });
        } else {
            return res.json({ mensaje: 'Cotización pendiente de revisión mediante el enlace.' });
        }
    } catch (error) {
        console.error('[POST /calcular-importacion Error]', error);
        return res.status(500).json({ mensaje: 'Error interno del servidor al realizar el cálculo.' });
    }
});

// ==========================================
// REGISTRO PÚBLICO DE CLIENTES
// POST /api/auth/register
// ==========================================

/**
 * POST /api/auth/register
 * Permite a cualquier visitante crear una cuenta con rol "usuario" (cliente).
 * No requiere token. Valida estrictamente los campos, verifica duplicados,
 * hashea la contraseña con bcrypt y devuelve un JWT listo para usar.
 *
 * Body: { nombre, email, password }
 * Response 201: { mensaje, token, usuario: { id, nombre, email, rol } }
 */
app.post('/api/auth/register', async (req, res) => {
    const { nombre, email, password } = req.body;

    // ── Validación de presencia ──────────────────────────────────────────────
    if (!nombre || typeof nombre !== 'string' || nombre.trim().length < 2) {
        return res.status(400).json({ mensaje: 'El nombre es obligatorio y debe tener al menos 2 caracteres.' });
    }

    if (!email || typeof email !== 'string') {
        return res.status(400).json({ mensaje: 'El correo electrónico es obligatorio.' });
    }

    // Validación de formato de email con regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ mensaje: 'El correo electrónico no tiene un formato válido.' });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ mensaje: 'La contraseña es obligatoria y debe tener al menos 6 caracteres.' });
    }

    const nombreLimpio = nombre.trim();
    const emailLimpio = email.trim().toLowerCase();

    try {
        // ── Verificar que el correo no esté ya registrado ────────────────────
        const [existentes] = await db.query(
            'SELECT id FROM usuarios WHERE email = ?',
            [emailLimpio]
        );
        if (existentes.length > 0) {
            return res.status(409).json({ mensaje: 'Ya existe una cuenta registrada con ese correo electrónico.' });
        }

        // ── Hashear contraseña con bcrypt (10 rondas) ────────────────────────
        const salt = await bcrypt.genSalt(10);
        const passwordEncriptada = await bcrypt.hash(password, salt);

        // ── Insertar usuario con rol "usuario" (cliente por defecto) ─────────
        const [resultado] = await db.query(
            'INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)',
            [nombreLimpio, emailLimpio, passwordEncriptada, 'usuario']
        );

        const nuevoUsuarioId = resultado.insertId;

        // ── Generar JWT igual al login (sesión inmediata) ────────────────────
        const token = jwt.sign(
            { id: nuevoUsuarioId, rol: 'usuario' },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        return res.status(201).json({
            mensaje: 'Cuenta creada exitosamente. ¡Bienvenido a TechStore!',
            token,
            usuario: {
                id: nuevoUsuarioId,
                nombre: nombreLimpio,
                email: emailLimpio,
                rol: 'usuario'
            }
        });

    } catch (error) {
        console.error('[POST /api/auth/register]', error);
        return res.status(500).json({ mensaje: 'Error interno al registrar el usuario. Inténtalo de nuevo.' });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
});

