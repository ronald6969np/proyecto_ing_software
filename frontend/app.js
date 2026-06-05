const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3000' 
    : 'https://TU_URL_DE_RENDER.onrender.com'; // Nota para mí: cambiar esta URL después

// Elementos del DOM - Autenticación y Layout
const sections = {
    login: document.getElementById('login-section'),
    dashboard: document.getElementById('dashboard-section')
};

const loginForm = document.getElementById('login-form');
const btnLogout = document.getElementById('btn-logout');
const currentUserSpan = document.getElementById('current-user-name');
const currentUserRoleSpan = document.getElementById('current-user-role');
const btnSalesDashboard = document.getElementById('btn-sales-dashboard');

// Elementos del DOM - Gestión de Usuarios
const usersTableBody = document.getElementById('users-tbody');
const tableLoading = document.getElementById('table-loading');
const tableEmpty = document.getElementById('table-empty');
const modalOverlay = document.getElementById('user-modal');
const modalTitle = document.getElementById('modal-title');
const userForm = document.getElementById('user-form');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCancelModal = document.getElementById('btn-cancel-modal');
const btnCreateUser = document.getElementById('btn-create-user');
const passwordGroup = document.getElementById('password-group');
const passwordInput = document.getElementById('user-password');

// Elementos del DOM - Gestión de Productos (Equipos)
const productsTableBody = document.getElementById('products-tbody');
const productsLoading = document.getElementById('products-loading');
const productsEmpty = document.getElementById('products-empty');
const productModal = document.getElementById('product-modal');
const productModalTitle = document.getElementById('product-modal-title');
const productForm = document.getElementById('product-form');
const btnCloseProductModal = document.getElementById('btn-close-product-modal');
const btnCancelProductModal = document.getElementById('btn-cancel-product-modal');
const btnCreateProduct = document.getElementById('btn-create-product');

// Elementos del DOM - Gestión de Clientes
const clientsTableBody = document.getElementById('clients-tbody');
const clientsLoading = document.getElementById('clients-loading');
const clientsEmpty = document.getElementById('clients-empty');
const clientModal = document.getElementById('client-modal');
const clientModalTitle = document.getElementById('client-modal-title');
const clientForm = document.getElementById('client-form');
const btnCloseClientModal = document.getElementById('btn-close-client-modal');
const btnCancelClientModal = document.getElementById('btn-cancel-client-modal');
const btnCreateClient = document.getElementById('btn-create-client');

// Elementos del DOM - Gestión de Cotizaciones (CRM)
const cotizacionesTableBody = document.getElementById('cotizaciones-tbody');
const cotizacionesLoading = document.getElementById('cotizaciones-loading');
const cotizacionesEmpty = document.getElementById('cotizaciones-empty');
const cotizacionModal = document.getElementById('cotizacion-modal');
const cotizacionModalTitle = document.getElementById('cotizacion-modal-title');
const cotizacionForm = document.getElementById('cotizacion-form');
const btnCloseCotizacionModal = document.getElementById('btn-close-cotizacion-modal');
const btnCancelCotizacionModal = document.getElementById('btn-cancel-cotizacion-modal');
const btnCreateCotizacion = document.getElementById('btn-create-cotizacion');
const cotizacionClientSelect = document.getElementById('cotizacion-client');

// Elementos del DOM - Calculadora de Importaciones
const calculadoraForm = document.getElementById('calculadora-form');
const calcUrlProducto = document.getElementById('calc-url-producto');
const calcPrecioFob = document.getElementById('calc-precio-fob');
const calcCostoEnvio = document.getElementById('calc-costo-envio');
const calcResCif = document.getElementById('calc-res-cif');
const calcResIva = document.getElementById('calc-res-iva');
const calcResTotal = document.getElementById('calc-res-total');
const calcMensajeContainer = document.getElementById('calc-mensaje-container');
const calcMensajeTexto = document.getElementById('calc-mensaje-texto');

// Estado
let currentUser = null;
let token = localStorage.getItem('token');

// Mapa de roles legibles
const ROL_LABELS = {
    admin: 'Administrador',
    usuario: 'Usuario',
    vendedor: 'Vendedor',
    agente: 'Agente',
    transportista: 'Transportista'
};

// --- Utilidades Generales ---

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconText = '';
    const textToCheck = (message || '').toLowerCase();
    const isLogro = textToCheck.includes('éxito') ||
        textToCheck.includes('exito') ||
        textToCheck.includes('correctamente') ||
        textToCheck.includes('registrad') ||
        textToCheck.includes('enviad') ||
        textToCheck.includes('confirmad') ||
        textToCheck.includes('bienvenido') ||
        textToCheck.includes('creado') ||
        textToCheck.includes('actualizado') ||
        textToCheck.includes('eliminado');
    const isCredenciales = textToCheck.includes('credenciales') || textToCheck.includes('incorrect');

    if (!isLogro && !isCredenciales) {
        if (type === 'success') iconText = 'bien';
        if (type === 'error') iconText = 'error';
    }

    const iconSpan = iconText
        ? `<span class="toast-label font-bold text-xs uppercase" style="background: rgba(0,0,0,0.15); padding: 2px 6px; border-radius: 3px; margin-right: 8px;">${iconText}</span>`
        : '';

    toast.innerHTML = `${iconSpan}<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 4500);
}

function showSection(sectionName) {
    Object.values(sections).forEach(sec => sec.classList.remove('active'));
    if (sections[sectionName]) {
        sections[sectionName].classList.add('active');
    }
}

function getAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

// --- Lógica del Sistema de Pestañas (Tabs) ---

function switchTab(tabId) {
    // Si no es admin y quiere entrar a otra pestaña, denegar
    if (currentUser && currentUser.rol !== 'admin' && tabId !== 'usuarios-tab') {
        showToast('Acceso restringido: Solo administradores pueden ver esta sección.', 'warning');
        return;
    }

    // Desactivar todos los botones de pestaña y contenidos
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // Activar el correspondiente
    const targetBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    const targetContent = document.getElementById(tabId);

    if (targetBtn) targetBtn.classList.add('active');
    if (targetContent) targetContent.classList.add('active');

    // Cargar los datos correspondientes
    if (tabId === 'usuarios-tab') {
        fetchUsers();
    } else if (tabId === 'productos-tab') {
        fetchProducts();
    } else if (tabId === 'clientes-tab') {
        fetchClients();
    } else if (tabId === 'cotizaciones-tab') {
        fetchCotizaciones();
    }
}

// --- Flujo de Autenticación ---

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = e.target.querySelector('button');
    btn.textContent = 'Iniciando...';
    btn.disabled = true;

    try {
        console.log('[Login] Intentando iniciar sesión para:', email);
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.mensaje || data.error || 'Error al iniciar sesión');
        }

        console.log('[Login] Exitoso', data);
        token = data.token;
        localStorage.setItem('token', token);
        if (data.usuario) {
            localStorage.setItem('currentUser', JSON.stringify(data.usuario));
            updateCurrentUserUI(data.usuario);
        }

        showToast('Bienvenido a TechStore Imports', 'success');
        showSection('dashboard');
        loginForm.reset();

        // Cargar vista por defecto (usuarios)
        switchTab('usuarios-tab');

    } catch (error) {
        console.error('[Login Error]', error);
        showToast(error.message, 'error');
    } finally {
        btn.textContent = 'Iniciar Sesión';
        btn.disabled = false;
    }
}

function handleLogout() {
    token = null;
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    showSection('login');
    showToast('Sesión cerrada correctamente', 'info');
}

function updateCurrentUserUI(user) {
    if (user) {
        currentUser = user;

        if (user.rol === 'agente') {
            window.location.href = 'agent_dashboard.html';
            return;
        }

        if (user.rol === 'usuario') {
            window.location.href = 'client_dashboard.html';
            return;
        }

        currentUserSpan.textContent = user.nombre || 'Usuario';
        currentUserRoleSpan.textContent = ROL_LABELS[user.rol] || user.rol;

        const dashboardTabs = document.getElementById('dashboard-tabs');
        if (user.rol === 'admin') {
            btnCreateUser.style.display = 'inline-flex';
            if (dashboardTabs) dashboardTabs.style.display = 'flex';
            if (btnSalesDashboard) btnSalesDashboard.style.display = 'inline-flex';
        } else {
            btnCreateUser.style.display = 'none';
            if (dashboardTabs) dashboardTabs.style.display = 'none';
            if (btnSalesDashboard) btnSalesDashboard.style.display = 'none';
            // Forzar a usuarios-tab si es rol no admin
            switchTab('usuarios-tab');
        }
    }
}

// --- CRUD: GESTIÓN DE USUARIOS ---

async function fetchUsers() {
    tableLoading.style.display = 'block';
    tableEmpty.style.display = 'none';
    usersTableBody.innerHTML = '';

    console.log('[FetchUsers] Solicitando lista de usuarios...');

    try {
        if (!token) throw new Error('No hay sesión activa. Por favor, inicia sesión.');

        const response = await fetch(`${API_URL}/usuarios`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            throw new Error('Error al leer la respuesta del servidor (JSON inválido)');
        }

        if (response.status === 401 || response.status === 403) {
            handleLogout();
            throw new Error('Sesión expirada o no autorizada. Vuelve a iniciar sesión.');
        }

        if (!response.ok) {
            throw new Error(data.mensaje || data.error || `Error del servidor: ${response.status}`);
        }

        const usersArray = Array.isArray(data) ? data : (data.usuarios || data.data || []);
        tableLoading.style.display = 'none';

        if (usersArray.length === 0) {
            tableEmpty.style.display = 'block';
        } else {
            renderUsers(usersArray);
        }

    } catch (error) {
        console.error('[FetchUsers Error]', error);
        tableLoading.style.display = 'none';
        if (token) {
            tableEmpty.style.display = 'block';
            tableEmpty.textContent = 'Ocurrió un error al cargar los usuarios.';
            showToast(error.message, 'error');
        }
    }
}

function renderUsers(users) {
    usersTableBody.innerHTML = '';

    users.forEach(user => {
        const tr = document.createElement('tr');
        const fecha = user.fecha_creacion
            ? new Date(user.fecha_creacion).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' })
            : 'N/A';

        const rolColors = {
            admin: { bg: '#dbeafe', color: '#1e40af' },
            usuario: { bg: '#f1f5f9', color: '#475569' },
            vendedor: { bg: '#dcfce7', color: '#166534' },
            agente: { bg: '#fef9c3', color: '#854d0e' },
            transportista: { bg: '#fce7f3', color: '#9d174d' }
        };
        const rc = rolColors[user.rol] || rolColors.usuario;
        const rolBadge = `<span class="badge" style="background:${rc.bg}; color:${rc.color};">${ROL_LABELS[user.rol] || user.rol}</span>`;

        // Mostrar acciones de edición y borrado SOLO si el logueado es admin
        const actionsHtml = currentUser && currentUser.rol === 'admin'
            ? `<button class="btn btn-outline btn-sm" onclick="editUser(${user.id}, '${user.nombre.replace(/'/g, "\\'")}', '${user.email}', '${user.rol}')">Editar</button>
               <button class="btn btn-danger btn-sm" onclick="deleteUser(${user.id})">Eliminar</button>`
            : `<span style="color:var(--text-muted); font-size:0.75rem;">Sin permisos</span>`;

        tr.innerHTML = `
            <td><span style="color:var(--text-muted)">#${user.id}</span></td>
            <td style="font-weight: 500; color:var(--text-main);">${user.nombre}</td>
            <td>${user.email}</td>
            <td>${rolBadge}</td>
            <td>${fecha}</td>
            <td class="actions-cell">${actionsHtml}</td>
        `;
        usersTableBody.appendChild(tr);
    });
}

function openModal(mode = 'create', user = null) {
    const isEdit = mode === 'edit';
    modalTitle.textContent = isEdit ? 'Editar Usuario' : 'Nuevo Usuario';

    document.getElementById('user-id').value = user ? user.id : '';
    document.getElementById('user-name').value = user ? user.nombre : '';
    document.getElementById('user-email').value = user ? user.email : '';
    document.getElementById('user-role').value = user ? user.rol : 'usuario';

    if (isEdit) {
        passwordInput.required = false;
        passwordInput.value = '';
        passwordGroup.querySelector('.help-text').style.display = 'block';
    } else {
        passwordInput.required = true;
        passwordInput.value = '';
        passwordGroup.querySelector('.help-text').style.display = 'none';
    }

    modalOverlay.classList.add('active');
}

function closeModal() {
    modalOverlay.classList.remove('active');
    userForm.reset();
}

async function handleUserSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('user-id').value;
    const nombre = document.getElementById('user-name').value;
    const email = document.getElementById('user-email').value;
    const password = document.getElementById('user-password').value;
    const rol = document.getElementById('user-role').value;

    const isEdit = id !== '';
    const endpoint = isEdit ? `${API_URL}/usuarios/${id}` : `${API_URL}/usuarios`;
    const method = isEdit ? 'PUT' : 'POST';

    const payload = { nombre, email, rol };
    if (!isEdit || (isEdit && password.trim() !== '')) {
        payload.password = password;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = 'Guardando...';
    btn.disabled = true;

    try {
        const response = await fetch(endpoint, {
            method,
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        let data;
        try { data = await response.json(); } catch (err) { data = {}; }

        if (!response.ok) {
            if (response.status === 403) throw new Error('No tienes permisos suficientes');
            throw new Error(data.mensaje || data.error || 'Error al guardar el usuario');
        }

        showToast(isEdit ? 'Usuario actualizado con éxito' : 'Usuario creado con éxito', 'success');
        closeModal();
        fetchUsers();

    } catch (error) {
        console.error('[SaveUser Error]', error);
        showToast(error.message, 'error');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

window.editUser = function (id, nombre, email, rol) {
    openModal('edit', { id, nombre, email, rol });
};

window.deleteUser = async function (id) {
    if (currentUser && currentUser.id === id) {
        showToast('No puedes eliminar tu propia cuenta.', 'warning');
        return;
    }

    if (!confirm('¿Estás seguro de que deseas eliminar este usuario de forma permanente?')) return;

    try {
        const response = await fetch(`${API_URL}/usuarios/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            if (response.status === 403) throw new Error('Acceso Denegado: Solo un administrador puede realizar esta acción.');
            let data;
            try { data = await response.json(); } catch (e) { data = {}; }
            throw new Error(data.mensaje || data.error || 'Error al eliminar usuario');
        }

        showToast('Usuario eliminado correctamente', 'success');
        fetchUsers();

    } catch (error) {
        console.error('[DeleteUser Error]', error);
        showToast(error.message, 'error');
    }
};

// --- CRUD: GESTIÓN DE PRODUCTOS (EQUIPOS) ---

async function fetchProducts() {
    productsLoading.style.display = 'block';
    productsEmpty.style.display = 'none';
    productsTableBody.innerHTML = '';

    try {
        const response = await fetch(`${API_URL}/productos`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.mensaje || 'Error al obtener productos');

        productsLoading.style.display = 'none';

        if (data.length === 0) {
            productsEmpty.style.display = 'block';
        } else {
            renderProducts(data);
        }
    } catch (error) {
        console.error('[FetchProducts Error]', error);
        productsLoading.style.display = 'none';
        productsEmpty.style.display = 'block';
        productsEmpty.textContent = 'Error al cargar productos.';
        showToast(error.message, 'error');
    }
}

function renderProducts(products) {
    productsTableBody.innerHTML = '';
    products.forEach(p => {
        const tr = document.createElement('tr');

        const imgHtml = p.imagen_url
            ? `<img src="${p.imagen_url}" alt="${p.nombre}" style="width:40px; height:40px; object-fit:cover; border-radius:6px; border: 1px solid var(--border);">`
            : `<span style="font-size:1.5rem;">📦</span>`;

        tr.innerHTML = `
            <td><span style="color:var(--text-muted)">#${p.id}</span></td>
            <td>${imgHtml}</td>
            <td style="font-weight: 500; color:var(--text-main);">${p.nombre}</td>
            <td><small>${p.descripcion || 'Sin descripción'}</small></td>
            <td><span class="badge" style="background:#f1f5f9; color:#475569;">${p.categoria}</span></td>
            <td style="font-weight: 600;">$${parseFloat(p.precio).toFixed(2)}</td>
            <td style="font-weight: 500; color: ${p.stock > 0 ? 'var(--success)' : 'var(--danger)'};">${p.stock} u.</td>
            <td class="actions-cell">
                <button class="btn btn-outline btn-sm" onclick="editProduct(${p.id}, '${p.nombre.replace(/'/g, "\\'")}', '${(p.descripcion || '').replace(/'/g, "\\'")}', ${p.precio}, ${p.stock}, '${p.categoria.replace(/'/g, "\\'")}', '${(p.imagen_url || '').replace(/'/g, "\\'")}')">Editar</button>
                <button class="btn btn-danger btn-sm" onclick="deleteProduct(${p.id})">Eliminar</button>
            </td>
        `;
        productsTableBody.appendChild(tr);
    });
}

function openProductModal(mode = 'create', product = null) {
    const isEdit = mode === 'edit';
    productModalTitle.textContent = isEdit ? 'Editar Producto' : 'Nuevo Producto';

    document.getElementById('product-id').value = product ? product.id : '';
    document.getElementById('product-name').value = product ? product.nombre : '';
    document.getElementById('product-desc').value = product ? product.descripcion : '';
    document.getElementById('product-category').value = product ? product.categoria : '';
    document.getElementById('product-price').value = product ? product.precio : '';
    document.getElementById('product-stock').value = product ? product.stock : '';
    document.getElementById('product-img').value = product ? product.imagen_url : '';

    productModal.classList.add('active');
}

function closeProductModal() {
    productModal.classList.remove('active');
    productForm.reset();
}

async function handleProductSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('product-id').value;
    const nombre = document.getElementById('product-name').value;
    const descripcion = document.getElementById('product-desc').value;
    const categoria = document.getElementById('product-category').value;
    const precio = parseFloat(document.getElementById('product-price').value);
    const stock = parseInt(document.getElementById('product-stock').value);
    const imagen_url = document.getElementById('product-img').value;

    const isEdit = id !== '';
    const endpoint = isEdit ? `${API_URL}/productos/${id}` : `${API_URL}/productos`;
    const method = isEdit ? 'PUT' : 'POST';

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = 'Guardando...';
    btn.disabled = true;

    try {
        const response = await fetch(endpoint, {
            method,
            headers: getAuthHeaders(),
            body: JSON.stringify({ nombre, descripcion, categoria, precio, stock, imagen_url })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.mensaje || 'Error al guardar el producto');

        showToast(isEdit ? 'Producto actualizado con éxito' : 'Producto creado con éxito', 'success');
        closeProductModal();
        fetchProducts();
    } catch (error) {
        console.error('[SaveProduct Error]', error);
        showToast(error.message, 'error');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

window.editProduct = function (id, nombre, descripcion, precio, stock, categoria, imagen_url) {
    openProductModal('edit', { id, nombre, descripcion, precio, stock, categoria, imagen_url });
};

window.deleteProduct = async function (id) {
    if (!confirm('¿Estás seguro de que deseas eliminar este producto permanentemente?')) return;
    try {
        const response = await fetch(`${API_URL}/productos/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.mensaje || 'Error al eliminar producto');

        showToast('Producto eliminado correctamente', 'success');
        fetchProducts();
    } catch (error) {
        console.error('[DeleteProduct Error]', error);
        showToast(error.message, 'error');
    }
};

// --- CRUD: GESTIÓN DE CLIENTES ---

async function fetchClients() {
    clientsLoading.style.display = 'block';
    clientsEmpty.style.display = 'none';
    clientsTableBody.innerHTML = '';

    try {
        const response = await fetch(`${API_URL}/clientes`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.mensaje || 'Error al obtener clientes');

        clientsLoading.style.display = 'none';

        if (data.length === 0) {
            clientsEmpty.style.display = 'block';
        } else {
            renderClients(data);
        }
    } catch (error) {
        console.error('[FetchClients Error]', error);
        clientsLoading.style.display = 'none';
        clientsEmpty.style.display = 'block';
        clientsEmpty.textContent = 'Error al cargar clientes.';
        showToast(error.message, 'error');
    }
}

function renderClients(clients) {
    clientsTableBody.innerHTML = '';
    clients.forEach(c => {
        const tr = document.createElement('tr');

        // Badge de estado CRM
        const estadoBadge = c.estado === 'atendido'
            ? `<span class="badge" style="background:#dcfce7; color:#166534;">🟢 Atendido</span>`
            : `<span class="badge" style="background:#fef9c3; color:#854d0e;">🟡 En Atención</span>`;

        const activas = c.cotizaciones_activas || 0;
        const pagadas = c.cotizaciones_pagadas || 0;

        tr.innerHTML = `
            <td><span style="color:var(--text-muted)">#${c.id}</span></td>
            <td style="font-weight: 500; color:var(--text-main);">${c.nombre}</td>
            <td>${c.email}</td>
            <td>${c.telefono || '<span class="help-text">Sin teléfono</span>'}</td>
            <td>${estadoBadge}</td>
            <td style="text-align:center; font-weight:600; color: ${activas > 0 ? 'var(--warning, #b45309)' : 'var(--text-muted)'}">${activas}</td>
            <td style="text-align:center; font-weight:600; color: ${pagadas > 0 ? 'var(--success)' : 'var(--text-muted)'}">${pagadas}</td>
            <td class="actions-cell">
                <button class="btn btn-outline btn-sm" onclick="editClient(${c.id}, '${c.nombre.replace(/'/g, "\\'")}',' ${c.email}', '${(c.telefono || '').replace(/'/g, "\\'")}',' ${(c.direccion || '').replace(/'/g, "\\'")}',' ${c.estado}')">Editar</button>
                <button class="btn btn-danger btn-sm" onclick="deleteClient(${c.id})">Eliminar</button>
            </td>
        `;
        clientsTableBody.appendChild(tr);
    });
}

function openClientModal(mode = 'create', client = null) {
    const isEdit = mode === 'edit';
    clientModalTitle.textContent = isEdit ? 'Editar Cliente' : 'Nuevo Cliente';

    document.getElementById('client-id').value = client ? client.id : '';
    document.getElementById('client-name').value = client ? client.nombre : '';
    document.getElementById('client-email').value = client ? client.email : '';
    document.getElementById('client-phone').value = client ? client.telefono : '';
    document.getElementById('client-address').value = client ? client.direccion : '';
    document.getElementById('client-estado').value = client ? client.estado : 'en_atencion';

    clientModal.classList.add('active');
}

function closeClientModal() {
    clientModal.classList.remove('active');
    clientForm.reset();
}

async function handleClientSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('client-id').value;
    const nombre = document.getElementById('client-name').value;
    const email = document.getElementById('client-email').value;
    const telefono = document.getElementById('client-phone').value;
    const direccion = document.getElementById('client-address').value;
    const estado = document.getElementById('client-estado').value;

    const isEdit = id !== '';
    const endpoint = isEdit ? `${API_URL}/clientes/${id}` : `${API_URL}/clientes`;
    const method = isEdit ? 'PUT' : 'POST';

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = 'Guardando...';
    btn.disabled = true;

    try {
        const response = await fetch(endpoint, {
            method,
            headers: getAuthHeaders(),
            body: JSON.stringify({ nombre, email, telefono, direccion, estado })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.mensaje || 'Error al guardar cliente');

        showToast(isEdit ? 'Cliente actualizado con éxito' : 'Cliente creado con éxito', 'success');
        closeClientModal();
        fetchClients();
    } catch (error) {
        console.error('[SaveClient Error]', error);
        showToast(error.message, 'error');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

window.editClient = function (id, nombre, email, telefono, direccion, estado) {
    openClientModal('edit', { id, nombre: nombre.trim(), email: email.trim(), telefono: telefono.trim(), direccion: direccion.trim(), estado });
};

window.deleteClient = async function (id) {
    if (!confirm('¿Estás seguro de que deseas eliminar este cliente? Se borrarán sus cotizaciones asociadas.')) return;
    try {
        const response = await fetch(`${API_URL}/clientes/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.mensaje || 'Error al eliminar cliente');

        showToast('Cliente eliminado correctamente', 'success');
        fetchClients();
    } catch (error) {
        console.error('[DeleteClient Error]', error);
        showToast(error.message, 'error');
    }
};

// --- CRUD: GESTIÓN DE COTIZACIONES (CRM) ---

async function fetchCotizaciones() {
    cotizacionesLoading.style.display = 'block';
    cotizacionesEmpty.style.display = 'none';
    cotizacionesTableBody.innerHTML = '';

    try {
        const response = await fetch(`${API_URL}/cotizaciones`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.mensaje || 'Error al obtener cotizaciones');

        cotizacionesLoading.style.display = 'none';

        if (data.length === 0) {
            cotizacionesEmpty.style.display = 'block';
        } else {
            renderCotizaciones(data);
        }
    } catch (error) {
        console.error('[FetchCotizaciones Error]', error);
        cotizacionesLoading.style.display = 'none';
        cotizacionesEmpty.style.display = 'block';
        cotizacionesEmpty.textContent = 'Error al cargar cotizaciones.';
        showToast(error.message, 'error');
    }
}

function renderCotizaciones(cotizaciones) {
    cotizacionesTableBody.innerHTML = '';
    cotizaciones.forEach(cot => {
        const tr = document.createElement('tr');

        const fecha = cot.fecha_creacion
            ? new Date(cot.fecha_creacion).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' })
            : 'N/A';

        const estadoBadge = cot.estado === 'pagada'
            ? `<span class="badge" style="background:#dcfce7; color:#166534;">🟢 Pagada</span>`
            : `<span class="badge" style="background:#fef9c3; color:#854d0e;">🟡 Activa</span>`;

        const urlCorta = cot.url_producto.length > 35
            ? `<a href="${cot.url_producto}" target="_blank" title="${cot.url_producto}" style="color:var(--accent);">${cot.url_producto.substring(0, 35)}…</a>`
            : `<a href="${cot.url_producto}" target="_blank" style="color:var(--accent);">${cot.url_producto}</a>`;

        // Mapa de etiquetas para el select logístico
        const logisticoOpts = [
            { val: 'pendiente',          label: '⏳ Pendiente' },
            { val: 'comprado',           label: '🛏 Comprado' },
            { val: 'en_camino',          label: '🚚 En Camino' },
            { val: 'en_aduana',          label: '🏦 En Aduana' },
            { val: 'listo_para_recoger', label: '✅ Listo para Recoger' }
        ];
        const selectOpts = logisticoOpts
            .map(o => `<option value="${o.val}" ${cot.estado_logistico === o.val ? 'selected' : ''}>${o.label}</option>`)
            .join('');

        tr.innerHTML = `
            <td><span style="color:var(--text-muted)">#${cot.id}</span></td>
            <td>
                <div style="font-weight:500; color:var(--text-main);">${cot.cliente_nombre}</div>
                <div class="help-text" style="font-size:0.75rem;">${cot.cliente_email}</div>
            </td>
            <td>${urlCorta}</td>
            <td style="font-weight:600;">${cot.valor_cif ? '$' + parseFloat(cot.valor_cif).toFixed(2) : '<span class="help-text">—</span>'}</td>
            <td style="font-weight:600;">${cot.costo_total_aduana ? '$' + parseFloat(cot.costo_total_aduana).toFixed(2) : '<span class="help-text">—</span>'}</td>
            <td>${estadoBadge}</td>
            <td>
                <select
                    id="logistico-select-${cot.id}"
                    onchange="cambiarEstadoLogistico(${cot.id}, this.value)"
                    style="font-size:0.72rem; padding:4px 6px; border:2px solid #000;
                           border-radius:4px; background:#fff; cursor:pointer; font-weight:700;">
                    ${selectOpts}
                </select>
            </td>
            <td><small>${fecha}</small></td>
            <td class="actions-cell">
                <button class="btn btn-outline btn-sm" onclick="marcarCotizacionPagada(${cot.id}, '${cot.estado}')">Cambiar Estado</button>
                <button class="btn btn-danger btn-sm" onclick="deleteCotizacion(${cot.id})">Eliminar</button>
            </td>
        `;
        cotizacionesTableBody.appendChild(tr);
    });
}

window.cambiarEstadoLogistico = async function (id, estado_logistico) {
    try {
        const response = await fetch(`${API_URL}/cotizaciones/${id}/estado-logistico`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ estado_logistico })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.mensaje || 'Error al actualizar');
        showToast('Estado logístico actualizado correctamente', 'success');
    } catch (error) {
        console.error('[CambiarEstadoLogistico Error]', error);
        showToast(error.message, 'error');
        // Revertir el select si falla
        fetchCotizaciones();
    }
};

async function populateCotizacionClientSelect() {
    cotizacionClientSelect.innerHTML = '<option value="">— Seleccionar Cliente —</option>';
    try {
        const res = await fetch(`${API_URL}/clientes`, { headers: getAuthHeaders() });
        const clientes = await res.json();
        clientes.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = `${c.nombre} (${c.email})`;
            cotizacionClientSelect.appendChild(opt);
        });
    } catch (error) {
        console.error('[PopulateCotizacionSelect Error]', error);
    }
}

async function openCotizacionModal() {
    cotizacionModalTitle.textContent = 'Nueva Cotización';
    document.getElementById('cotizacion-id').value = '';
    cotizacionForm.reset();
    await populateCotizacionClientSelect();
    cotizacionModal.classList.add('active');
}

function closeCotizacionModal() {
    cotizacionModal.classList.remove('active');
    cotizacionForm.reset();
}

async function handleCotizacionSubmit(e) {
    e.preventDefault();
    const cliente_id = parseInt(document.getElementById('cotizacion-client').value);
    const url_producto = document.getElementById('cotizacion-url').value;
    const valor_cif = parseFloat(document.getElementById('cotizacion-cif').value) || null;
    const costo_total_aduana = parseFloat(document.getElementById('cotizacion-total').value) || null;
    const estado = document.getElementById('cotizacion-estado').value;

    if (!cliente_id) {
        showToast('Debes seleccionar un cliente.', 'warning');
        return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = 'Guardando...';
    btn.disabled = true;

    try {
        const response = await fetch(`${API_URL}/cotizaciones`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ cliente_id, url_producto, valor_cif, costo_total_aduana, estado })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.mensaje || 'Error al guardar la cotización');

        showToast('Cotización creada con éxito', 'success');
        closeCotizacionModal();
        fetchCotizaciones();
        fetchClients(); // Actualizar contadores en la pestaña clientes
    } catch (error) {
        console.error('[SaveCotizacion Error]', error);
        showToast(error.message, 'error');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

window.marcarCotizacionPagada = async function (id, estadoActual) {
    const nuevoEstado = estadoActual === 'pagada' ? 'activa' : 'pagada';
    const accion = nuevoEstado === 'pagada' ? 'marcar como PAGADA' : 'reactivar';
    if (!confirm(`¿Deseas ${accion} esta cotización?`)) return;
    try {
        const response = await fetch(`${API_URL}/cotizaciones/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ estado: nuevoEstado })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.mensaje || 'Error al actualizar');
        showToast(`Cotización marcada como ${nuevoEstado}`, 'success');
        fetchCotizaciones();
        fetchClients();
    } catch (error) {
        console.error('[MarcarCotizacion Error]', error);
        showToast(error.message, 'error');
    }
};

window.deleteCotizacion = async function (id) {
    if (!confirm('¿Estás seguro de que deseas eliminar esta cotización?')) return;
    try {
        const response = await fetch(`${API_URL}/cotizaciones/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.mensaje || 'Error al eliminar cotización');
        showToast('Cotización eliminada correctamente', 'success');
        fetchCotizaciones();
        fetchClients();
    } catch (error) {
        console.error('[DeleteCotizacion Error]', error);
        showToast(error.message, 'error');
    }
};

// --- CRUD: GESTIÓN DE LOGÍSTICA / ENTREGAS ---

async function fetchDeliveries() {
    entregasLoading.style.display = 'block';
    entregasEmpty.style.display = 'none';
    entregasTableBody.innerHTML = '';

    try {
        const response = await fetch(`${API_URL}/entregas`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.mensaje || 'Error al obtener entregas');

        entregasLoading.style.display = 'none';

        if (data.length === 0) {
            entregasEmpty.style.display = 'block';
        } else {
            renderDeliveries(data);
        }
    } catch (error) {
        console.error('[FetchDeliveries Error]', error);
        entregasLoading.style.display = 'none';
        entregasEmpty.style.display = 'block';
        entregasEmpty.textContent = 'Error al cargar logística.';
        showToast(error.message, 'error');
    }
}

function renderDeliveries(deliveries) {
    entregasTableBody.innerHTML = '';
    deliveries.forEach(e => {
        const tr = document.createElement('tr');

        const fecha = e.fecha
            ? new Date(e.fecha).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : 'N/A';

        let badgeClass = 'badge-pendiente';
        let badgeLabel = 'Pendiente';
        if (e.estado_entrega === 'en_camino') {
            badgeClass = 'badge-en-camino';
            badgeLabel = 'En Camino';
        } else if (e.estado_entrega === 'entregado') {
            badgeClass = 'badge-entregado';
            badgeLabel = 'Entregado';
        }

        const estadoBadge = `<span class="badge ${badgeClass}">${badgeLabel}</span>`;

        tr.innerHTML = `
            <td><span style="color:var(--text-muted)">#${e.id}</span></td>
            <td>
                <div style="font-weight: 500; color:var(--text-main);">${e.cliente_nombre}</div>
                <div class="help-text" style="font-size:0.75rem;">${e.cliente_email}</div>
            </td>
            <td>
                <div style="font-weight: 500;">${e.producto_nombre}</div>
                <div class="help-text" style="font-size:0.75rem;">Precio unitario: $${parseFloat(e.producto_precio).toFixed(2)}</div>
            </td>
            <td style="font-weight: 500;">${e.cantidad} unid.</td>
            <td><small>${fecha}</small></td>
            <td>${estadoBadge}</td>
            <td class="actions-cell">
                <button class="btn btn-outline btn-sm" onclick="editEntrega(${e.id}, ${e.cliente_id}, ${e.producto_id}, ${e.cantidad}, '${e.estado_entrega}')">Actualizar</button>
                <button class="btn btn-danger btn-sm" onclick="deleteEntrega(${e.id})">Eliminar</button>
            </td>
        `;
        entregasTableBody.appendChild(tr);
    });
}

// Cargar listas de clientes y productos para los selectores del modal de entregas
async function populateEntregaDropdowns(selectedClientId = '', selectedProductId = '') {
    entregaClientSelect.innerHTML = '<option value="">-- Seleccionar Cliente --</option>';
    entregaProductSelect.innerHTML = '<option value="">-- Seleccionar Producto --</option>';

    try {
        // Cargar clientes
        const resClientes = await fetch(`${API_URL}/clientes`, { headers: getAuthHeaders() });
        const clientes = await resClientes.json();
        clientes.forEach(c => {
            const option = document.createElement('option');
            option.value = c.id;
            option.textContent = `${c.nombre} (${c.email})`;
            if (c.id == selectedClientId) option.selected = true;
            entregaClientSelect.appendChild(option);
        });

        // Cargar productos
        const resProductos = await fetch(`${API_URL}/productos`, { headers: getAuthHeaders() });
        const productos = await resProductos.json();
        productos.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = `${p.nombre} (Stock: ${p.stock})`;
            if (p.id == selectedProductId) option.selected = true;
            entregaProductSelect.appendChild(option);
        });
    } catch (error) {
        console.error('[PopulateDropdowns Error]', error);
        showToast('Error al cargar opciones de clientes o productos.', 'error');
    }
}

async function openEntregaModal(mode = 'create', entrega = null) {
    const isEdit = mode === 'edit';
    entregaModalTitle.textContent = isEdit ? 'Actualizar Logística de Entrega' : 'Nueva Entrega Logística';

    document.getElementById('entrega-id').value = entrega ? entrega.id : '';
    document.getElementById('entrega-qty').value = entrega ? entrega.cantidad : 1;
    document.getElementById('entrega-status').value = entrega ? entrega.estado_entrega : 'pendiente';

    // Poblar de forma asíncrona los selectores
    await populateEntregaDropdowns(entrega ? entrega.cliente_id : '', entrega ? entrega.producto_id : '');

    entregaModal.classList.add('active');
}

function closeEntregaModal() {
    entregaModal.classList.remove('active');
    entregaForm.reset();
}

async function handleEntregaSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('entrega-id').value;
    const cliente_id = parseInt(document.getElementById('entrega-client').value);
    const producto_id = parseInt(document.getElementById('entrega-product').value);
    const cantidad = parseInt(document.getElementById('entrega-qty').value);
    const estado_entrega = document.getElementById('entrega-status').value;

    if (!cliente_id || !producto_id) {
        showToast('Debes seleccionar un cliente y un producto válidos.', 'warning');
        return;
    }

    const isEdit = id !== '';
    const endpoint = isEdit ? `${API_URL}/entregas/${id}` : `${API_URL}/entregas`;
    const method = isEdit ? 'PUT' : 'POST';

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = 'Guardando...';
    btn.disabled = true;

    try {
        const response = await fetch(endpoint, {
            method,
            headers: getAuthHeaders(),
            body: JSON.stringify({ cliente_id, producto_id, cantidad, estado_entrega })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.mensaje || 'Error al guardar la entrega');

        showToast(isEdit ? 'Registro logístico actualizado' : 'Entrega registrada con éxito', 'success');
        closeEntregaModal();
        fetchDeliveries();
    } catch (error) {
        console.error('[SaveEntrega Error]', error);
        showToast(error.message, 'error');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

window.editEntrega = function (id, cliente_id, producto_id, cantidad, estado_entrega) {
    openEntregaModal('edit', { id, cliente_id, producto_id, cantidad, estado_entrega });
};

window.deleteEntrega = async function (id) {
    if (!confirm('¿Estás seguro de que deseas eliminar este registro de entrega?')) return;
    try {
        const response = await fetch(`${API_URL}/entregas/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.mensaje || 'Error al eliminar entrega');

        showToast('Registro logístico eliminado correctamente', 'success');
        fetchDeliveries();
    } catch (error) {
        console.error('[DeleteEntrega Error]', error);
        showToast(error.message, 'error');
    }
};

// --- Lógica de la Calculadora de Importaciones ---

function handlePrecioFobInput() {
    const val = parseFloat(calcPrecioFob.value);
    if (!isNaN(val) && val > 0) {
        calcCostoEnvio.disabled = false;
        calcCostoEnvio.required = true;
    } else {
        calcCostoEnvio.disabled = true;
        calcCostoEnvio.required = false;
        calcCostoEnvio.value = '';
    }
}

async function handleCalculadoraSubmit(e) {
    e.preventDefault();

    const url_producto = calcUrlProducto.value;
    const precio_fob = calcPrecioFob.value;
    const costo_envio = calcCostoEnvio.value;

    // Reiniciar resultados y contenedor de mensajes
    calcResCif.value = '';
    calcResIva.value = '';
    calcResTotal.value = '';
    calcMensajeContainer.style.display = 'none';
    calcMensajeTexto.textContent = '';

    try {
        const payload = {
            url_producto,
            precio_fob: precio_fob !== '' ? parseFloat(precio_fob) : null,
            costo_envio: costo_envio !== '' ? parseFloat(costo_envio) : null
        };

        const response = await fetch(`${API_URL}/calcular-importacion`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.mensaje || 'Error al realizar el cálculo');
        }

        if (data.mensaje) {
            // Muestra mensaje de pendiente de revisión
            calcMensajeTexto.textContent = data.mensaje;
            calcMensajeContainer.style.display = 'block';
            calcMensajeContainer.style.background = 'var(--sky-blue)';
            calcMensajeContainer.style.borderColor = 'var(--ink)';

            calcResCif.placeholder = 'Pendiente';
            calcResIva.placeholder = 'Pendiente';
            calcResTotal.placeholder = 'Pendiente';
        } else {
            // Muestra los resultados matemáticos
            calcResCif.value = data.valor_cif.toFixed(2);
            calcResIva.value = data.iva_importacion.toFixed(2);
            calcResTotal.value = data.costo_total_aduana.toFixed(2);
        }

    } catch (error) {
        console.error('[Calculadora Submit Error]', error);
        showToast(error.message, 'error');
    }
}

// --- Inicialización ---

function init() {
    // Asignar Event Listeners de Autenticación
    loginForm.addEventListener('submit', handleLogin);
    btnLogout.addEventListener('click', handleLogout);

    // Event Listeners: MODAL USUARIOS
    btnCreateUser.addEventListener('click', () => openModal('create'));
    btnCloseModal.addEventListener('click', closeModal);
    btnCancelModal.addEventListener('click', closeModal);
    userForm.addEventListener('submit', handleUserSubmit);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });

    // Event Listeners: MODAL PRODUCTOS
    btnCreateProduct.addEventListener('click', () => openProductModal('create'));
    btnCloseProductModal.addEventListener('click', closeProductModal);
    btnCancelProductModal.addEventListener('click', closeProductModal);
    productForm.addEventListener('submit', handleProductSubmit);
    productModal.addEventListener('click', (e) => {
        if (e.target === productModal) closeProductModal();
    });

    // Event Listeners: MODAL CLIENTES
    btnCreateClient.addEventListener('click', () => openClientModal('create'));
    btnCloseClientModal.addEventListener('click', closeClientModal);
    btnCancelClientModal.addEventListener('click', closeClientModal);
    clientForm.addEventListener('submit', handleClientSubmit);
    clientModal.addEventListener('click', (e) => {
        if (e.target === clientModal) closeClientModal();
    });

    // Event Listeners: MODAL COTIZACIONES
    if (btnCreateCotizacion) btnCreateCotizacion.addEventListener('click', () => openCotizacionModal());
    if (btnCloseCotizacionModal) btnCloseCotizacionModal.addEventListener('click', closeCotizacionModal);
    if (btnCancelCotizacionModal) btnCancelCotizacionModal.addEventListener('click', closeCotizacionModal);
    if (cotizacionForm) cotizacionForm.addEventListener('submit', handleCotizacionSubmit);
    if (cotizacionModal) cotizacionModal.addEventListener('click', (e) => {
        if (e.target === cotizacionModal) closeCotizacionModal();
    });

    // Event Listeners: CALCULADORA
    if (calcPrecioFob) {
        calcPrecioFob.addEventListener('input', handlePrecioFobInput);
    }
    if (calculadoraForm) {
        calculadoraForm.addEventListener('submit', handleCalculadoraSubmit);
    }

    // Event Listeners: NAVEGACIÓN POR PESTAÑAS (TABS)
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            switchTab(tabId);
        });
    });

    // Validar estado de la sesión al cargar la página
    if (token) {
        console.log('[Init] Sesión activa detectada (Token encontrado).');
        try {
            const savedUser = JSON.parse(localStorage.getItem('currentUser'));
            updateCurrentUserUI(savedUser);
        } catch (e) {
            console.warn('[Init] No se pudo parsear el usuario actual guardado.', e);
        }
        showSection('dashboard');
        switchTab('usuarios-tab');
    } else {
        console.log('[Init] No hay sesión activa. Mostrando Login.');
        showSection('login');
    }
}

// Iniciar aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', init);
