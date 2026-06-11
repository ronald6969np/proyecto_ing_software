const mysql = require('mysql2/promise');
require('dotenv').config();

// Crear un pool de conexiones (recomendado para producción y manejar múltiples peticiones)
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'agencia_db',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function initDatabaseTables() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                email VARCHAR(100) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                rol ENUM('admin', 'usuario', 'vendedor', 'agente', 'transportista') NOT NULL DEFAULT 'usuario',
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Crear tabla productos
        await pool.query(`
            CREATE TABLE IF NOT EXISTS productos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(150) NOT NULL,
                descripcion TEXT,
                precio DECIMAL(10, 2) NOT NULL,
                stock INT NOT NULL DEFAULT 0,
                categoria VARCHAR(100) NOT NULL,
                imagen_url VARCHAR(255)
            )
        `);
        // Crear tabla clientes (CRM)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS clientes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(150) NOT NULL,
                email VARCHAR(150) NOT NULL UNIQUE,
                telefono VARCHAR(20),
                direccion VARCHAR(255),
                estado ENUM('en_atencion', 'atendido') NOT NULL DEFAULT 'en_atencion',
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        // Agregar columna estado si migrando desde BD anterior
        try {
            await pool.query("ALTER TABLE clientes ADD COLUMN estado ENUM('en_atencion', 'atendido') NOT NULL DEFAULT 'en_atencion'");
        } catch (e) { /* Columna ya existe, ignorar */ }

        // Crear tabla cotizaciones (CRM)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS cotizaciones (
                id INT AUTO_INCREMENT PRIMARY KEY,
                cliente_id INT NOT NULL,
                url_producto VARCHAR(500) NOT NULL,
                valor_cif DECIMAL(10, 2),
                costo_total_aduana DECIMAL(10, 2),
                estado ENUM('activa', 'pagada') NOT NULL DEFAULT 'activa',
                estado_logistico ENUM('pendiente','comprado','en_camino','en_aduana','listo_para_recoger') NOT NULL DEFAULT 'pendiente',
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
            )
        `);
        // Agregar estado_logistico si migrando desde BD anterior
        try {
            await pool.query("ALTER TABLE cotizaciones ADD COLUMN estado_logistico ENUM('pendiente','comprado','en_camino','en_aduana','listo_para_recoger') NOT NULL DEFAULT 'pendiente'");
        } catch (e) { /* Columna ya existe, ignorar */ }
        // Crear tabla pedidos_importacion
        await pool.query(`
            CREATE TABLE IF NOT EXISTS pedidos_importacion (
                id INT AUTO_INCREMENT PRIMARY KEY,
                cliente_id INT NOT NULL,
                agente_id INT,
                url_producto VARCHAR(500) NOT NULL,
                precio_origen DECIMAL(10, 2) NOT NULL DEFAULT 0,
                arancel_calculado DECIMAL(10, 2) DEFAULT 0,
                total_a_pagar DECIMAL(10, 2) DEFAULT 0,estado ENUM('cotizando', 'esperando_pago', 'pago_confirmado', 'siendo_comprado', 'en_transito', 'en_aduana', 'listo_para_entrega', 'entregado', 'cancelado', 'finalizado') NOT NULL DEFAULT 'cotizando',
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (cliente_id) REFERENCES usuarios(id) ON DELETE CASCADE,
                FOREIGN KEY (agente_id) REFERENCES usuarios(id) ON DELETE SET NULL
            )
        `);
        // Crear tabla mensajes_chat
        await pool.query(`
            CREATE TABLE IF NOT EXISTS mensajes_chat (
                id INT AUTO_INCREMENT PRIMARY KEY,
                pedido_id INT NOT NULL,
                usuario_id INT NOT NULL,
                contenido_mensaje TEXT NOT NULL,
                fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (pedido_id) REFERENCES pedidos_importacion(id) ON DELETE CASCADE,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
            )
        `);
        console.log('Tablas inicializadas: usuarios, productos, clientes (CRM), cotizaciones, pedidos_importacion, mensajes_chat.');
    } catch (error) {
        console.error('Error al inicializar tablas de la base de datos:', error);
    }
}

// Probar la conexión inicial, inicializar tablas y correr seed secuencialmente
pool.getConnection()
    .then(async connection => {
        console.log('Conexión a la base de datos MySQL establecida correctamente.');
        connection.release();
        await initDatabaseTables();
        await seedDatabase();
    })
    .catch(err => {
        console.error('Error al conectar o inicializar la base de datos:', err);
    });

// --- Script de inicialización y seed ---
async function seedDatabase() {
    console.log('--- Iniciando seed de la base de datos ---');
    const bcrypt = require('bcrypt');
    const adminEmail = 'admin' + '@' + 'techstore.com';
    const agentEmail = 'agente' + '@' + 'techstore.com';
    const clientEmail = 'cliente' + '@' + 'techstore.com';

    try {
        // Seed Admin
        const [adminRows] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [adminEmail]);
        if (adminRows.length === 0) {
            const hash = await bcrypt.hash('admin123', 10);
            await pool.query("INSERT INTO usuarios (nombre, email, password, rol) VALUES ('Admin', ?, ?, 'admin')", [adminEmail, hash]);
            console.log('Usuario admin creado (admin@techstore.com / admin123)');
        } else {
            console.log('Admin ya existe.');
        }

        // Seed Agentgit 
        const [agentRows] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [agentEmail]);
        if (agentRows.length === 0) {
            const hash = await bcrypt.hash('agente123', 10);
            await pool.query("INSERT INTO usuarios (nombre, email, password, rol) VALUES ('Agente Ronald', ?, ?, 'agente')", [agentEmail, hash]);
            console.log('Agente creado (agente@techstore.com / agente123)');
        } else {
            console.log('Agente ya existe.');
        }

        // Seed Demo Client (for pedidos seed)
        const [clientRows] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [clientEmail]);
        if (clientRows.length === 0) {
            const hash = await bcrypt.hash('cliente123', 10);
            await pool.query("INSERT INTO usuarios (nombre, email, password, rol) VALUES ('Cliente Demo', ?, ?, 'usuario')", [clientEmail, hash]);
            console.log('Cliente creado (cliente@techstore.com / cliente123)');
        } else {
            console.log('Cliente ya existe.');
        }

        // Seed: 1 pedido de prueba limpio (sin mensajes) para empezar desde cero
        const [pedidoCount] = await pool.query('SELECT COUNT(*) as cnt FROM pedidos_importacion');
        if (pedidoCount[0].cnt === 0) {
            const [[agente]] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [agentEmail]);
            const [[cliente]] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [clientEmail]);

            if (agente && cliente) {
                await pool.query(
                    `INSERT INTO pedidos_importacion
                        (cliente_id, agente_id, url_producto, precio_origen, arancel_calculado, total_a_pagar, estado)
                     VALUES (?, ?, 'https://example.com/producto-de-prueba', 0.00, 0.00, 0.00, 'cotizando')`,
                    [cliente.id, agente.id]
                );
                console.log('Pedido de prueba inicial creado listo para usar.');
            }
        } else {
            console.log('Pedidos ya existen, no se sobreescribe el seed.');
        }
    } catch (err) {
        console.error('Error durante el seed de la base de datos:', err);
    }
    console.log('--- Seed finalizado ---');
}

module.exports = pool;
