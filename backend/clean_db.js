const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'techstore_imports',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 1,
    queueLimit: 0
});

async function main() {
    try {
        console.log('--- Limpiando Datos de Prueba ---');
        await pool.query('DELETE FROM mensajes_chat');
        console.log('✅ Tabla mensajes_chat vaciada.');
        await pool.query('DELETE FROM pedidos_importacion');
        console.log('✅ Tabla pedidos_importacion vaciada.');
        console.log('🎉 Limpieza completada con éxito. Vuelve a iniciar el servidor para aplicar el seed limpio.');
    } catch (err) {
        console.error('❌ Error al limpiar base de datos:', err);
    } finally {
        await pool.end();
    }
}

main();
