-- Crear la base de datos
CREATE DATABASE IF NOT EXISTS agencia_db;

USE agencia_db;

-- Crear la tabla de usuarios con todos los roles del sistema
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    rol ENUM(
        'admin',
        'usuario',
        'vendedor',
        'agente',
        'transportista'
    ) NOT NULL DEFAULT 'usuario',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO
    usuarios (
        id,
        nombre,
        email,
        password,
        rol
    )
VALUES (
        1,
        'Admin',
        'admin@techstore.com',
        '$2a$10$fG6zQkY4z43oA9hT.i12I.pQx/i1E4H4wV1a4t5V.i1a4t5V.i1a4',
        'admin'
    ),
    (
        2,
        'Agente Ronald',
        'agente@techstore.com',
        '$2b$10$8.M8gQvE8Z0eBvD3lO1SBeG.VzSve/JjS4R0wQ97GkM5T0KzB3OQx',
        'agente'
    )
ON DUPLICATE KEY UPDATE
    id = id;

-- ============================================================
-- NUEVAS TABLAS (FASE 1: VENTAS Y LOGÍSTICA)
-- ============================================================

-- Tabla de productos (inventario de tecnología)
CREATE TABLE IF NOT EXISTS productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10, 2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    categoria VARCHAR(100) NOT NULL,
    imagen_url VARCHAR(255)
);

INSERT INTO
    productos (
        id,
        nombre,
        descripcion,
        precio,
        stock,
        categoria,
        imagen_url
    )
VALUES (
        1,
        'Laptop',
        'Laptop de alta gama',
        1000,
        10,
        'Electronica',
        'https://www.amazon.com/-/es/Lenovo-premium-i7-13620H-i7-1355U-pulgadas/dp/B0GX66CNNJ/ref=sr_1_4?__mk_es_US=%C3%85M%C3%85%C5%BD%C3%95%C3%91&sr=8-4'
    );

create table clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    telefono VARCHAR(20),
    direccion VARCHAR(255),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS entregas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cliente_id INT NOT NULL,
    producto_id INT NOT NULL,
    cantidad INT NOT NULL DEFAULT 1,
    estado_entrega ENUM(
        'pendiente',
        'en_camino',
        'entregado'
    ) NOT NULL DEFAULT 'pendiente',
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes (id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos (id) ON DELETE CASCADE
);

insert into
    entregas (
        cliente_id,
        producto_id,
        cantidad,
        estado_entrega
    )
values (1, 1, 1, 'pendiente');