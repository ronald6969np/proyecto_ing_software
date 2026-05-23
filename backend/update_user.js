const bcrypt = require('bcrypt');
const pool = require('./db.js');

async function run() {
    try {
        const hash = await bcrypt.hash('123456', 10);
        const [result] = await pool.query('UPDATE usuarios SET password = ? WHERE email = ?', [hash, 'ronald@gmail.com']);
        
        if (result.affectedRows === 0) {
            console.log("Usuario ronald@gmail.com no encontrado. Creándolo...");
            await pool.query('INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)', ['Ronald', 'ronald@gmail.com', hash, 'admin']);
            console.log("Usuario creado exitosamente con contraseña '123456'.");
        } else {
            console.log("Contraseña del usuario ronald@gmail.com actualizada a '123456'.");
        }
    } catch (error) {
        console.error("Error al operar en la base de datos:", error);
    }
    process.exit(0);
}

run();
