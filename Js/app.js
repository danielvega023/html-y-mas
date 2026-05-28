// ==================== CONFIGURACIÓN GLOBAL ====================
const API_BASE = 'http://localhost:3000';
let currentUser = null;       // { id, nombre, rol }
let charts = {};
let disciplinasList = [];
let gruposList = [];

// ==================== FUNCIONES AUXILIARES ====================
function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.style.backgroundColor = isError ? '#e74c3c' : '#14181f';
  toast.style.borderColor = isError ? '#e74c3c' : '#2299e2';
  toast.style.color = isError ? '#fff' : '#2299e2';
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

async function fetchAPI(endpoint, options = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || res.statusText);
  }
  return res.json();
}

function abrirModal(id) {
  document.getElementById(id).classList.add('open');
}
function cerrarModales() {
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('open'));
}

// ==================== SELECCIÓN DE ROL EN LOGIN ====================
function initRoleSelector() {
  const roleBtns = document.querySelectorAll('.role-btn');
  roleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      roleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

// ==================== LOGIN ====================
document.getElementById('loginBtn').onclick = async () => {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  const roleBtn = document.querySelector('.role-btn.active');
  const selectedRole = roleBtn?.dataset.role;
  if (!email || !password) return showToast('Completa todos los campos', true);
  if (!selectedRole) return showToast('Selecciona un rol', true);
  try {
    const data = await fetchAPI('/login', {
      method: 'POST',
      body: JSON.stringify({ correo: email, contrasena: password })
    });
    currentUser = data.usuario;
    if (currentUser.rol !== selectedRole) {
      showToast(`Este usuario no es ${selectedRole}. Usa el rol correcto.`, true);
      return;
    }
    sessionStorage.setItem('halcones_user', JSON.stringify(currentUser));
    document.getElementById('loginModal').classList.remove('open');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('userNameDisplay').innerText = currentUser.nombre;
    inicializarPestanas();
    cargarDatosIniciales();
  } catch (err) {
    showToast('Credenciales incorrectas o error de conexión', true);
  }
};

// ==================== INICIALIZACIÓN DE PESTAÑAS POR ROL ====================
function inicializarPestanas() {
  const navTabs = document.getElementById('navTabs');
  const tabsMap = {
    administracion: ['Inicio', 'Dashboard', 'Atletas', 'Pagos', 'Asistencia', 'Comunicados'],
    entrenador: ['Inicio', 'Asistencia', 'Mis Grupos', 'Comunicados'],
    tutor: ['Inicio', 'Mis Atletas', 'Pagos', 'Comunicados']
  };
  const tabs = tabsMap[currentUser.rol];
  navTabs.innerHTML = tabs.map(tab => `<button class="nav-tab" data-panel="panel-${tab.toLowerCase().replace(' ', '-')}">${tab}</button>`).join('');
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const panelId = btn.dataset.panel;
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      document.getElementById(panelId).classList.add('active');
      document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (panelId === 'panel-dashboard') cargarDashboard();
      if (panelId === 'panel-atletas') cargarAtletasAdmin();
      if (panelId === 'panel-pagos') cargarPagosPendientes();
      if (panelId === 'panel-comunicados') cargarComunicados();
      if (panelId === 'panel-asistencia') cargarGruposAsistencia();
      if (panelId === 'panel-mis-atletas') cargarMisAtletas();
      if (panelId === 'panel-mis-grupos') cargarGruposEntrenador();
    });
  });
  document.querySelector('.nav-tab').click();
}

// ==================== CARGA INICIAL DE DATOS ====================
async function cargarDatosIniciales() {
  await cargarEstadisticasInicio();
  await cargarDisciplinasYGrupos();
  if (currentUser.rol === 'administracion') {
    cargarAtletasAdmin();
    cargarDashboard();
  } else if (currentUser.rol === 'tutor') {
    cargarMisAtletas();
  } else if (currentUser.rol === 'entrenador') {
    cargarGruposEntrenador();
  }
  cargarComunicados();
  document.getElementById('logoutBtn').onclick = () => {
    sessionStorage.clear();
    location.reload();
  };
  document.getElementById('newAtletaBtn')?.addEventListener('click', () => abrirModalAtleta());
  document.getElementById('saveAtletaBtn')?.addEventListener('click', guardarAtleta);
  document.getElementById('pagoEfectivoBtn')?.addEventListener('click', () => {
    cargarAtletasEnSelect('efectivoAtleta');
    abrirModal('efectivoModal');
  });
  document.getElementById('guardarEfectivoBtn')?.addEventListener('click', registrarPagoEfectivo);
  document.getElementById('subirComprobanteBtn')?.addEventListener('click', () => {
    cargarAtletasEnSelect('compAtleta');
    abrirModal('comprobanteModal');
  });
  document.getElementById('subirComprobanteBtn2')?.addEventListener('click', subirComprobante);
  document.getElementById('nuevoComunicadoBtn')?.addEventListener('click', nuevoComunicado);
  document.getElementById('guardarAsistenciaBtn')?.addEventListener('click', guardarAsistencia);
  document.getElementById('guardarAsistenciaEntrenadorBtn')?.addEventListener('click', guardarAsistenciaEntrenador);
  document.getElementById('exportPDFBtn')?.addEventListener('click', exportarPDF);
  document.getElementById('exportExcelBtn')?.addEventListener('click', exportarExcel);
  document.getElementById('searchAtleta')?.addEventListener('input', () => cargarAtletasAdmin());
  document.getElementById('filterDisciplina')?.addEventListener('change', () => cargarAtletasAdmin());
  document.getElementById('filterEstado')?.addEventListener('change', () => cargarAtletasAdmin());
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', cerrarModales);
  });
}

async function cargarDisciplinasYGrupos() {
  try {
    const disc = await fetchAPI('/disciplinas');
    disciplinasList = disc;
    const grupos = await fetchAPI('/grupos');
    gruposList = grupos;
    const selectsDisciplina = ['atletaDisciplina', 'filterDisciplina'];
    selectsDisciplina.forEach(id => {
      const sel = document.getElementById(id);
      if (sel) sel.innerHTML = `<option value="">Todas</option>` + disc.map(d => `<option value="${d.id_disciplina}">${d.nombre}</option>`).join('');
    });
    const selectGrupo = document.getElementById('atletaGrupo');
    if (selectGrupo) selectGrupo.innerHTML = grupos.map(g => `<option value="${g.id_grupo}">${g.nombre}</option>`).join('');
  } catch(e) { console.error(e); }
}

async function cargarAtletasEnSelect(selectId) {
  try {
    const atletas = await fetchAPI('/atletas');
    const select = document.getElementById(selectId);
    if (select) {
      select.innerHTML = atletas.map(a => `<option value="${a.id_atleta}">${a.nombre} ${a.apellido}</option>`).join('');
    }
  } catch(e) { showToast('Error cargando atletas', true); }
}

async function cargarEstadisticasInicio() {
  try {
    const stats = await fetchAPI('/estadisticas');
    document.getElementById('totalAtletas').innerText = stats.activos || 0;
    document.getElementById('totalDisciplinas').innerText = stats.total_disciplinas || 0;
    document.getElementById('pagosPendientes').innerText = stats.pagos_pendientes || 0;
    const comunicados = await fetchAPI('/comunicados');
    document.getElementById('comunicadosRecientes').innerText = comunicados.length;
    const ultimos = comunicados.slice(0,3);
    const container = document.getElementById('ultimosComunicados');
    if (container) {
      container.innerHTML = ultimos.map(c => `
        <div class="aviso-card ${c.prioridad}">
          <h4>${c.titulo}</h4>
          <p>${c.mensaje.substring(0,100)}...</p>
          <small>${new Date(c.fecha_publicacion).toLocaleDateString()}</small>
        </div>
      `).join('');
    }
  } catch(e) { console.error(e); }
}

// ==================== ATLETAS (ADMIN) ====================
async function cargarAtletasAdmin() {
  try {
    let atletas = await fetchAPI('/atletas');
    const searchTerm = document.getElementById('searchAtleta')?.value.toLowerCase() || '';
    const disciplinaId = document.getElementById('filterDisciplina')?.value;
    const estado = document.getElementById('filterEstado')?.value;
    atletas = atletas.filter(a => {
      const matchName = (a.nombre + ' ' + a.apellido).toLowerCase().includes(searchTerm);
      const matchDisc = !disciplinaId || a.id_disciplina == disciplinaId;
      const matchEstado = !estado || a.estado === estado;
      return matchName && matchDisc && matchEstado;
    });
    const tbody = document.getElementById('atletasTableBody');
    tbody.innerHTML = atletas.map(a => `
      <tr>
        <td>${a.nombre} ${a.apellido}</td>
        <td>${a.disciplina || '-'}</td>
        <td>${a.tutor || '-'}</td>
        <td><span class="badge ${a.estado}">${a.estado}</span></td>
        <td><button class="btn-outline-small" onclick="editarAtleta(${a.id_atleta})">Editar</button>
          <button class="btn-outline-small" onclick="eliminarAtleta(${a.id_atleta})">Eliminar</button></td>
      </tr>
    `).join('');
  } catch(e) { showToast('Error cargando atletas', true); }
}

window.editarAtleta = async (id) => {
  try {
    const atleta = await fetchAPI(`/atletas/${id}`);
    document.getElementById('atletaId').value = atleta.id_atleta;
    document.getElementById('atletaNombre').value = atleta.nombre;
    document.getElementById('atletaApellido').value = atleta.apellido;
    document.getElementById('atletaFechaNac').value = atleta.fecha_nacimiento.split('T')[0];
    document.getElementById('atletaDisciplina').value = atleta.id_disciplina;
    document.getElementById('atletaGrupo').value = atleta.id_grupo;
    document.getElementById('atletaModalTitle').innerText = 'Editar Atleta';
    abrirModal('atletaModal');
  } catch(e) { showToast('Error cargando atleta', true); }
};

window.eliminarAtleta = async (id) => {
  if(confirm('¿Eliminar este atleta?')){
    await fetchAPI(`/atletas/${id}`, { method: 'DELETE' });
    showToast('Atleta eliminado');
    cargarAtletasAdmin();
  }
};

async function guardarAtleta() {
  const id = document.getElementById('atletaId').value;
  const data = {
    nombre: document.getElementById('atletaNombre').value,
    apellido: document.getElementById('atletaApellido').value,
    fecha_nacimiento: document.getElementById('atletaFechaNac').value,
    id_disciplina: document.getElementById('atletaDisciplina').value,
    id_grupo: document.getElementById('atletaGrupo').value,
    id_tutor: 1
  };
  if (!data.nombre || !data.apellido || !data.fecha_nacimiento || !data.id_disciplina) {
    return showToast('Completa los campos obligatorios', true);
  }
  try {
    if(id) await fetchAPI(`/atletas/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    else await fetchAPI('/atletas', { method: 'POST', body: JSON.stringify(data) });
    showToast('Atleta guardado');
    cerrarModales();
    cargarAtletasAdmin();
  } catch(e) { showToast('Error guardando atleta', true); }
}

function abrirModalAtleta() {
  document.getElementById('atletaId').value = '';
  document.getElementById('atletaModalTitle').innerText = 'Nuevo Atleta';
  document.querySelectorAll('#atletaModal input, #atletaModal select').forEach(i => i.value = '');
  abrirModal('atletaModal');
}

// ==================== PAGOS ====================
async function cargarPagosPendientes() {
  try {
    const pagos = await fetchAPI('/pagos');
    const pendientes = pagos.filter(p => p.estado === 'pendiente');
    const container = document.getElementById('pagosContent');
    if (!container) return;
    container.innerHTML = pendientes.map(p => `
      <div class="pago-card">
        <div class="pago-info"><strong>${p.nombre_atleta} ${p.apellido_atleta}</strong> - ${p.tipo_pago} - RD$ ${p.monto}</div>
        ${currentUser.rol === 'administracion' ? `
          <div class="pago-actions">
            <button class="btn-primary" onclick="aprobarPago(${p.id_pago}, 'aprobado')">Aprobar</button>
            <button class="btn-secondary" onclick="aprobarPago(${p.id_pago}, 'rechazado')">Rechazar</button>
          </div>
        ` : '<span class="badge pendiente">Pendiente</span>'}
      </div>
    `).join('');
    document.querySelectorAll('.pagos-tabs .tab-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.pagos-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        if (tab === 'pendientes') cargarPagosPendientes();
        else if (tab === 'historial') cargarHistorialPagos();
        else if (tab === 'subir') mostrarSubirComprobante();
      };
    });
  } catch(e) { console.error(e); }
}

window.aprobarPago = async (id, estado) => {
  let motivo = '';
  if (estado === 'rechazado') motivo = prompt('Motivo del rechazo:');
  try {
    await fetchAPI(`/pagos/${id}/estado`, { method: 'PUT', body: JSON.stringify({ estado, motivo_rechazo: motivo }) });
    showToast(`Pago ${estado}`);
    cargarPagosPendientes();
  } catch(e) { showToast('Error', true); }
};

async function cargarHistorialPagos() {
  try {
    const pagos = await fetchAPI('/pagos');
    const container = document.getElementById('pagosContent');
    container.innerHTML = pagos.map(p => `
      <div class="pago-card">
        <div class="pago-info"><strong>${p.nombre_atleta} ${p.apellido_atleta}</strong> - ${p.tipo_pago} - RD$ ${p.monto} - ${p.estado}</div>
        ${p.comprobante ? `<a href="${API_BASE}${p.comprobante}" target="_blank" class="btn-outline-small">Ver comprobante</a>` : ''}
      </div>
    `).join('');
  } catch(e) { console.error(e); }
}

function mostrarSubirComprobante() {
  const container = document.getElementById('pagosContent');
  container.innerHTML = `
    <div class="upload-area">
      <div class="upload-icon">📄</div>
      <h4>SUBIR COMPROBANTE DE TRANSFERENCIA</h4>
      <p>JPG, PNG o PDF · Máximo 5 MB</p>
      <div class="upload-form">
        <select id="compAtleta" class="input-field"></select>
        <select id="compTipo" class="input-field"><option value="mensualidad">Mensualidad</option><option value="reinscripcion">Reinscripción</option></select>
        <input type="number" id="compMonto" placeholder="Monto en RD$" class="input-field">
        <input type="file" id="compArchivo" accept="image/*,application/pdf" class="input-field">
        <button id="subirComprobanteBtn2" class="btn-primary">Enviar comprobante</button>
      </div>
    </div>
  `;
  cargarAtletasEnSelect('compAtleta');
  document.getElementById('subirComprobanteBtn2').onclick = subirComprobante;
}

async function subirComprobante() {
  const fileInput = document.getElementById('compArchivo');
  if (!fileInput.files[0]) return showToast('Seleccione un archivo', true);
  const formData = new FormData();
  formData.append('id_atleta', document.getElementById('compAtleta').value);
  formData.append('tipo_pago', document.getElementById('compTipo').value);
  formData.append('monto', document.getElementById('compMonto').value);
  formData.append('metodo_pago', 'transferencia');
  formData.append('comprobante', fileInput.files[0]);
  try {
    const res = await fetch(`${API_BASE}/pagos/con-comprobante`, { method: 'POST', body: formData });
    if (res.ok) showToast('Comprobante enviado, pendiente de aprobación');
    else showToast('Error al subir', true);
    cerrarModales();
    cargarPagosPendientes();
  } catch(e) { showToast('Error de conexión', true); }
}

async function registrarPagoEfectivo() {
  const data = {
    id_atleta: document.getElementById('efectivoAtleta').value,
    tipo_pago: document.getElementById('efectivoTipo').value,
    monto: document.getElementById('efectivoMonto').value,
    metodo_pago: 'efectivo'
  };
  if (!data.id_atleta || !data.monto) return showToast('Complete los datos', true);
  try {
    await fetchAPI('/pagos', { method: 'POST', body: JSON.stringify(data) });
    showToast('Pago registrado');
    cerrarModales();
    cargarPagosPendientes();
  } catch(e) { showToast('Error', true); }
}

// ==================== ASISTENCIA ====================
async function cargarGruposAsistencia() {
  try {
    const grupos = await fetchAPI('/grupos');
    const select = document.getElementById('asistenciaGrupo');
    select.innerHTML = grupos.map(g => `<option value="${g.id_grupo}">${g.nombre}</option>`).join('');
    document.getElementById('asistenciaFecha').value = new Date().toISOString().slice(0,10);
    cargarAtletasAsistencia();
    select.onchange = cargarAtletasAsistencia;
  } catch(e) { console.error(e); }
}

async function cargarAtletasAsistencia() {
  const grupo = document.getElementById('asistenciaGrupo').value;
  if (!grupo) return;
  try {
    const atletas = await fetchAPI(`/asistencia/grupo/${grupo}/atletas`);
    const container = document.getElementById('asistenciaLista');
    container.innerHTML = atletas.map(a => `
      <div class="asistencia-fila">
        <span>${a.nombre} ${a.apellido}</span>
        <select data-id="${a.id_atleta}">
          <option value="presente">Presente</option>
          <option value="ausente">Ausente</option>
          <option value="tarde">Tarde</option>
        </select>
        <input type="text" placeholder="Observación" data-obs="${a.id_atleta}">
      </div>
    `).join('');
  } catch(e) { console.error(e); }
}

async function guardarAsistencia() {
  const grupo = document.getElementById('asistenciaGrupo').value;
  const fecha = document.getElementById('asistenciaFecha').value;
  const registros = [];
  document.querySelectorAll('#asistenciaLista .asistencia-fila').forEach(row => {
    const select = row.querySelector('select');
    const obsInput = row.querySelector('input');
    registros.push({
      id_atleta: select.dataset.id,
      id_grupo: grupo,
      fecha,
      estado: select.value,
      observacion: obsInput.value
    });
  });
  if (registros.length === 0) return;
  try {
    await fetchAPI('/asistencia', { method: 'POST', body: JSON.stringify({ registros }) });
    showToast('Asistencia guardada');
  } catch(e) { showToast('Error', true); }
}

// ==================== ENTRENADOR ====================
async function cargarGruposEntrenador() {
  try {
    const grupos = await fetchAPI('/grupos');
    const misGrupos = grupos.filter(g => g.id_entrenador === currentUser.id);
    const select = document.getElementById('entrenadorGrupo');
    select.innerHTML = misGrupos.map(g => `<option value="${g.id_grupo}">${g.nombre}</option>`).join('');
    if (misGrupos.length) cargarAtletasEntrenador();
    select.onchange = cargarAtletasEntrenador;
  } catch(e) { console.error(e); }
}

async function cargarAtletasEntrenador() {
  const grupo = document.getElementById('entrenadorGrupo').value;
  if (!grupo) return;
  try {
    const atletas = await fetchAPI(`/asistencia/grupo/${grupo}/atletas`);
    const container = document.getElementById('entrenadorAsistenciaLista');
    container.innerHTML = atletas.map(a => `
      <div class="asistencia-fila">
        <span>${a.nombre} ${a.apellido}</span>
        <select data-id="${a.id_atleta}">
          <option value="presente">Presente</option>
          <option value="ausente">Ausente</option>
          <option value="tarde">Tarde</option>
        </select>
        <input type="text" placeholder="Observación">
      </div>
    `).join('');
  } catch(e) { console.error(e); }
}

async function guardarAsistenciaEntrenador() {
  const grupo = document.getElementById('entrenadorGrupo').value;
  const fecha = new Date().toISOString().slice(0,10);
  const registros = [];
  document.querySelectorAll('#entrenadorAsistenciaLista .asistencia-fila').forEach(row => {
    const select = row.querySelector('select');
    const obs = row.querySelector('input').value;
    registros.push({
      id_atleta: select.dataset.id,
      id_grupo: grupo,
      fecha,
      estado: select.value,
      observacion: obs
    });
  });
  if (registros.length === 0) return;
  try {
    await fetchAPI('/asistencia', { method: 'POST', body: JSON.stringify({ registros }) });
    showToast('Asistencia registrada');
  } catch(e) { showToast('Error', true); }
}

// ==================== COMUNICADOS ====================
async function cargarComunicados() {
  try {
    const comunicados = await fetchAPI('/comunicados');
    const container = document.getElementById('comunicadosLista');
    container.innerHTML = comunicados.map(c => `
      <div class="aviso-card ${c.prioridad}">
        <h4>${c.titulo}</h4>
        <p>${c.mensaje}</p>
        <small>${new Date(c.fecha_publicacion).toLocaleString()} - ${c.destinatario || 'Todos'}</small>
      </div>
    `).join('');
    document.querySelectorAll('.filter-chips .chip').forEach(chip => {
      chip.onclick = () => {
        document.querySelectorAll('.filter-chips .chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const filtro = chip.dataset.filter;
        document.querySelectorAll('.aviso-card').forEach(card => {
          if (filtro === 'todos') card.style.display = 'block';
          else if (filtro === 'urgente') card.style.display = card.classList.contains('urgente') ? 'block' : 'none';
        });
      };
    });
  } catch(e) { console.error(e); }
}

async function nuevoComunicado() {
  if (currentUser.rol !== 'administracion') return showToast('Solo administración puede crear comunicados', true);
  const titulo = prompt('Título del comunicado:');
  if (!titulo) return;
  const mensaje = prompt('Mensaje:');
  if (!mensaje) return;
  const prioridad = confirm('¿Marcar como urgente?') ? 'urgente' : 'normal';
  try {
    await fetchAPI('/comunicados', { method: 'POST', body: JSON.stringify({ titulo, mensaje, destinatario: 'todo el club', prioridad }) });
    showToast('Comunicado publicado');
    cargarComunicados();
  } catch(e) { showToast('Error', true); }
}

// ==================== DASHBOARD ADMIN ====================
async function cargarDashboard() {
  try {
    const stats = await fetchAPI('/estadisticas');
    const kpiDiv = document.getElementById('kpiContainer');
    kpiDiv.innerHTML = `
      <div class="kpi-card"><h3>${stats.total_atletas}</h3><span>Atletas totales</span></div>
      <div class="kpi-card"><h3>${stats.activos}</h3><span>Activos</span></div>
      <div class="kpi-card"><h3>${stats.pagos_pendientes}</h3><span>Pagos pendientes</span></div>
      <div class="kpi-card"><h3>${stats.pagos_aprobados}</h3><span>Pagos aprobados</span></div>
    `;
    const discData = await fetchAPI('/estadisticas/disciplinas');
    const ctxBar = document.getElementById('disciplinasChart').getContext('2d');
    const ctxPie = document.getElementById('pagosEstadoChart').getContext('2d');
    if (charts.bar) charts.bar.destroy();
    if (charts.pie) charts.pie.destroy();
    charts.bar = new Chart(ctxBar, {
      type: 'bar',
      data: { labels: discData.map(d => d.nombre), datasets: [{ label: 'Atletas', data: discData.map(d => d.total), backgroundColor: '#2299e2' }] }
    });
    charts.pie = new Chart(ctxPie, {
      type: 'pie',
      data: { labels: ['Aprobados', 'Pendientes', 'Rechazados'], datasets: [{ data: [stats.pagos_aprobados, stats.pagos_pendientes, stats.pagos_rechazados], backgroundColor: ['#2ecc71', '#f1c40f', '#e74c3c'] }] }
    });
  } catch(e) { console.error(e); }
}

// ==================== EXPORTACIONES ====================
async function exportarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text('Reporte Club Halcones', 14, 16);
  const stats = await fetchAPI('/estadisticas');
  doc.text(`Atletas activos: ${stats.activos}`, 14, 30);
  doc.text(`Pagos pendientes: ${stats.pagos_pendientes}`, 14, 40);
  const atletas = await fetchAPI('/atletas');
  const tableData = atletas.map(a => [a.nombre, a.apellido, a.disciplina || '-', a.estado]);
  doc.autoTable({ head: [['Nombre', 'Apellido', 'Disciplina', 'Estado']], body: tableData, startY: 50 });
  doc.save('reporte_halcones.pdf');
}

async function exportarExcel() {
  const atletas = await fetchAPI('/atletas');
  const pagos = await fetchAPI('/pagos');
  const ws1 = XLSX.utils.json_to_sheet(atletas.map(a => ({ Nombre: a.nombre, Apellido: a.apellido, Disciplina: a.disciplina, Estado: a.estado })));
  const ws2 = XLSX.utils.json_to_sheet(pagos.map(p => ({ Atleta: p.nombre_atleta, Monto: p.monto, Estado: p.estado, Fecha: p.fecha_pago })));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, 'Atletas');
  XLSX.utils.book_append_sheet(wb, ws2, 'Pagos');
  XLSX.writeFile(wb, 'reporte_halcones.xlsx');
}

// ==================== MIS ATLETAS (TUTOR) ====================
async function cargarMisAtletas() {
  try {
    const atletas = await fetchAPI('/atletas');
    const misAtletas = atletas.filter(a => a.id_tutor === currentUser.id);
    const tbody = document.getElementById('misAtletasBody');
    tbody.innerHTML = misAtletas.map(a => `
      <tr>
        <td>${a.nombre} ${a.apellido}</td>
        <td>${a.disciplina}</td>
        <td><span class="badge ${a.estado}">${a.estado}</span></td>
        <td><button class="btn-outline-small" onclick="showToast('Historial en construcción')">Historial</button></td>
      </tr>
    `).join('');
  } catch(e) { showToast('Error cargando tus atletas', true); }
}

// ==================== INICIALIZACIÓN GLOBAL ====================
document.addEventListener('DOMContentLoaded', () => {
  initRoleSelector();
  const savedUser = sessionStorage.getItem('halcones_user');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('userNameDisplay').innerText = currentUser.nombre;
    inicializarPestanas();
    cargarDatosIniciales();
  } else {
    document.getElementById('loginModal').classList.add('open');
  }
});