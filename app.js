/* ═══════════════════════════════════════════════════════
   HALCONES — app.js v3
   Backend: Node.js/Express · MySQL
   Endpoints base: http://localhost:3000
═══════════════════════════════════════════════════════ */

const API_BASE = 'http://localhost:3000';

let currentUser = null;       // { id, nombre, rol }
let charts = {};              // instancias Chart.js
let disciplinasList = [];
let gruposList = [];
let atletasList = [];         // cache para filtros
let attEstados = {};          // { id_atleta: 'presente'|'ausente'|'tarde' }
const attEstadosEnt = {};

/* ─── TOAST ─────────────────────────────────────────── */
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast visible ${type}`;
  clearTimeout(t._to);
  t._to = setTimeout(() => t.classList.remove('visible'), 3200);
}

/* ─── API HELPER ─────────────────────────────────────── */
async function api(endpoint, options = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { const j = await res.json(); msg = j.mensaje || j.error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

/* ─── MODALES ────────────────────────────────────────── */
function abrirModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('open');
}
function cerrarModales() {
  document.querySelectorAll('.modal').forEach(m => {
    if (m.id !== 'loginModal') m.classList.remove('open');
  });
}
document.addEventListener('click', e => {
  if (e.target.classList.contains('close-modal') ||
      (e.target.classList.contains('modal') && e.target.id !== 'loginModal')) {
    cerrarModales();
  }
});

/* ─── BADGE HELPER ───────────────────────────────────── */
function badge(estado) {
  const map = {
    activo: '✅ Activo', inactivo: '⛔ Inactivo', pendiente: '⏳ Pendiente',
    aprobado: '✅ Aprobado', rechazado: '❌ Rechazado',
    presente: 'Presente', ausente: 'Ausente', tarde: 'Tarde',
    urgente: '🚨 Urgente', normal: 'Normal'
  };
  return `<span class="badge ${estado}">${map[estado] || estado}</span>`;
}

/* ─── AVATAR INITIALS ────────────────────────────────── */
function initials(nombre = '') {
  return nombre.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
}

/* ════════════════════════════════════════════════════════
   LOGIN / REGISTER VIEW TOGGLE
════════════════════════════════════════════════════════ */
function initRoleSelector() {
  document.querySelectorAll('.role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

document.getElementById('showRegisterLink')?.addEventListener('click', e => {
  e.preventDefault();
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('registerView').classList.remove('hidden');
});

document.getElementById('showLoginLink')?.addEventListener('click', e => {
  e.preventDefault();
  document.getElementById('registerView').classList.add('hidden');
  document.getElementById('loginView').classList.remove('hidden');
});

/* ════════════════════════════════════════════════════════
   REGISTRO DE CUENTA (tutor/padre)
════════════════════════════════════════════════════════ */
document.getElementById('registerBtn')?.addEventListener('click', async () => {
  const nombre   = document.getElementById('regNombre')?.value.trim();
  const email    = document.getElementById('regEmail')?.value.trim();
  const password = document.getElementById('regPassword')?.value.trim();
  const rol      = document.getElementById('regRol')?.value;
  const telefono = document.getElementById('regTelefono')?.value.trim();
  const errEl    = document.getElementById('registerError');

  errEl.classList.remove('visible');

  if (!nombre || !email || !password) {
    errEl.textContent = 'Completa nombre, correo y contraseña.';
    return errEl.classList.add('visible');
  }
  if (password.length < 6) {
    errEl.textContent = 'La contraseña debe tener al menos 6 caracteres.';
    return errEl.classList.add('visible');
  }

  try {
    document.getElementById('registerBtn').textContent = 'Enviando…';
    await api('/registro-solicitud', {
      method: 'POST',
      body: JSON.stringify({ nombre, correo: email, contrasena: password, rol, telefono })
    });
    showToast('Solicitud enviada ✅ — espera la aprobación del administrador', 'success');
    document.getElementById('registerView').classList.add('hidden');
    document.getElementById('loginView').classList.remove('hidden');
    // Limpiar campos
    ['regNombre','regEmail','regPassword','regTelefono'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  } catch(err) {
    errEl.textContent = err.message || 'Error al enviar solicitud.';
    errEl.classList.add('visible');
  } finally {
    document.getElementById('registerBtn').textContent = 'ENVIAR SOLICITUD';
  }
});

/* ════════════════════════════════════════════════════════
   LOGIN
════════════════════════════════════════════════════════ */
document.getElementById('loginBtn').addEventListener('click', async () => {
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  const roleBtn  = document.querySelector('.role-btn.active');
  const errEl    = document.getElementById('loginError');

  errEl.classList.remove('visible');

  if (!email || !password) {
    errEl.textContent = 'Completa todos los campos.';
    return errEl.classList.add('visible');
  }
  if (!roleBtn) {
    errEl.textContent = 'Selecciona un rol.';
    return errEl.classList.add('visible');
  }

  try {
    document.getElementById('loginBtn').textContent = 'Verificando…';
    const data = await api('/login', {
      method: 'POST',
      body: JSON.stringify({ correo: email, contrasena: password })
    });
    currentUser = data.usuario;
    /* Validar que el rol coincida con el seleccionado */
    if (currentUser.rol !== roleBtn.dataset.role) {
      errEl.textContent = `Este usuario no tiene rol de ${roleBtn.dataset.role}.`;
      errEl.classList.add('visible');
      currentUser = null;
      return;
    }
    sessionStorage.setItem('halcones_user', JSON.stringify(currentUser));
    document.getElementById('loginModal').classList.remove('open');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('userNameDisplay').textContent = currentUser.nombre;
    document.getElementById('userAvatar').textContent = initials(currentUser.nombre);
    inicializarPestanas();
    cargarDatosIniciales();
  } catch (err) {
    errEl.textContent = 'Credenciales incorrectas o error de conexión.';
    errEl.classList.add('visible');
  } finally {
    document.getElementById('loginBtn').textContent = 'INGRESAR AL SISTEMA';
  }
});

/* Enter en el formulario de login */
['loginEmail','loginPassword'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('loginBtn').click();
  });
});

/* ════════════════════════════════════════════════════════
   PESTAÑAS POR ROL
════════════════════════════════════════════════════════ */
const tabsMap = {
  administracion: [
    { label: '🏠 Inicio',       panel: 'panel-inicio' },
    { label: '📊 Dashboard',    panel: 'panel-dashboard' },
    { label: '👥 Atletas',      panel: 'panel-atletas' },
    { label: '🗂️ Grupos',      panel: 'panel-grupos' },
    { label: '💰 Pagos',        panel: 'panel-pagos' },
    { label: '📋 Asistencia',   panel: 'panel-asistencia' },
    { label: '📢 Comunicados',  panel: 'panel-comunicados' },
  ],
  entrenador: [
    { label: '🏠 Inicio',       panel: 'panel-inicio' },
    { label: '🏋️ Mis Grupos',  panel: 'panel-mis-grupos' },
    { label: '📢 Comunicados',  panel: 'panel-comunicados' },
  ],
  tutor: [
    { label: '🏠 Inicio',       panel: 'panel-inicio' },
    { label: '👨‍👧 Mis Atletas', panel: 'panel-mis-atletas' },
    { label: '💰 Pagos',        panel: 'panel-pagos' },
    { label: '📢 Comunicados',  panel: 'panel-comunicados' },
  ]
};

function inicializarPestanas() {
  const navTabs = document.getElementById('navTabs');
  const tabs = tabsMap[currentUser.rol] || [];
  navTabs.innerHTML = tabs.map(t =>
    `<button class="nav-tab" data-panel="${t.panel}">${t.label}</button>`
  ).join('');

  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const panelId = btn.dataset.panel;
      switchPanel(panelId, btn);
    });
  });

  /* Activar primera pestaña */
  const first = navTabs.querySelector('.nav-tab');
  if (first) first.classList.add('active');

  /* Botón cerrar sesión */
  document.getElementById('logoutBtn').onclick = () => {
    sessionStorage.clear();
    location.reload();
  };

  /* Visibilidad de elementos por rol */
  if (currentUser.rol === 'administracion') {
    document.getElementById('nuevoComunicadoBtn')?.classList.remove('hidden');
    document.getElementById('pagoEfectivoBtn')?.classList.remove('hidden');
  }
}

function switchPanel(panelId, tabEl) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));

  const panel = document.getElementById(panelId);
  if (panel) panel.classList.add('active');
  if (tabEl) tabEl.classList.add('active');

  const loaders = {
    'panel-inicio':       cargarEstadisticasInicio,
    'panel-dashboard':    cargarDashboard,
    'panel-atletas':      cargarAtletasAdmin,
    'panel-grupos':       cargarGruposAdmin,
    'panel-pagos':        cargarPagosPendientes,
    'panel-comunicados':  cargarComunicados,
    'panel-asistencia':   cargarGruposAsistencia,
    'panel-mis-atletas':  cargarMisAtletas,
    'panel-mis-grupos':   cargarGruposEntrenador,
  };
  if (loaders[panelId]) loaders[panelId]();
}

/* ════════════════════════════════════════════════════════
   CARGA INICIAL
════════════════════════════════════════════════════════ */
async function cargarDatosIniciales() {
  await Promise.all([
    cargarDisciplinasYGrupos(),
    cargarEstadisticasInicio(),
    cargarComunicados(),
  ]);

  if (currentUser.rol === 'administracion') {
    cargarDashboard();
    cargarAtletasAdmin();
  } else if (currentUser.rol === 'tutor') {
    cargarMisAtletas();
  } else if (currentUser.rol === 'entrenador') {
    cargarGruposEntrenador();
  }

  /* Event listeners globales */
  document.getElementById('newAtletaBtn')?.addEventListener('click', abrirModalAtleta);
  document.getElementById('saveAtletaBtn')?.addEventListener('click', guardarAtleta);

  /* Grupos admin */
  document.getElementById('newGrupoBtn')?.addEventListener('click', abrirModalGrupo);
  document.getElementById('saveGrupoBtn')?.addEventListener('click', guardarGrupo);
  document.getElementById('filterGrupoDisciplina')?.addEventListener('change', cargarGruposAdmin);

  /* Inscribir atleta (tutor) */
  document.getElementById('inscribirAtletaBtn')?.addEventListener('click', abrirModalInscribir);
  document.getElementById('saveInscribirBtn')?.addEventListener('click', guardarInscripcion);
  document.getElementById('inscDisciplina')?.addEventListener('change', () => {
    filtrarGruposPorDisciplina('inscDisciplina', 'inscGrupo');
  });

  document.getElementById('pagoEfectivoBtn')?.addEventListener('click', () => {
    cargarAtletasEnSelect('efectivoAtleta');
    abrirModal('efectivoModal');
  });
  document.getElementById('guardarEfectivoBtn')?.addEventListener('click', registrarPagoEfectivo);
  document.getElementById('nuevoComunicadoBtn')?.addEventListener('click', () => abrirModal('comunicadoModal'));
  document.getElementById('guardarComunicadoBtn')?.addEventListener('click', publicarComunicado);
  document.getElementById('guardarAsistenciaBtn')?.addEventListener('click', guardarAsistencia);
  document.getElementById('guardarAsistenciaEntrenadorBtn')?.addEventListener('click', guardarAsistenciaEntrenador);
  document.getElementById('exportPDFBtn')?.addEventListener('click', exportarPDF);
  document.getElementById('exportExcelBtn')?.addEventListener('click', exportarExcel);
  document.getElementById('searchAtleta')?.addEventListener('input', cargarAtletasAdmin);
  document.getElementById('filterDisciplina')?.addEventListener('change', cargarAtletasAdmin);
  document.getElementById('filterEstado')?.addEventListener('change', cargarAtletasAdmin);
  document.getElementById('confirmarEstadoPagoBtn')?.addEventListener('click', confirmarEstadoPago);

  /* Disciplina en modal atleta filtra grupos */
  document.getElementById('atletaDisciplina')?.addEventListener('change', () => {
    filtrarGruposPorDisciplina('atletaDisciplina', 'atletaGrupo');
  });

  /* Asistencia: filtro por disciplina */
  document.getElementById('asistenciaDisciplinaFilter')?.addEventListener('change', () => {
    const idDisc = document.getElementById('asistenciaDisciplinaFilter').value;
    const asGru = document.getElementById('asistenciaGrupo');
    if (!asGru) return;
    const filtrados = idDisc
      ? gruposList.filter(g => String(g.id_disciplina) === String(idDisc))
      : gruposList;
    asGru.innerHTML = filtrados.length
      ? filtrados.map(g => `<option value="${g.id_grupo}">${g.nombre}</option>`).join('')
      : `<option value="">Sin grupos para esta disciplina</option>`;
    if (filtrados.length) cargarAtletasAsistencia();
    else {
      document.getElementById('asistenciaLista').innerHTML = `<div class="empty-state"><span class="es-icon">📋</span><h3>Sin grupos</h3><p>Esta disciplina no tiene grupos creados.</p></div>`;
      actualizarResumenAsistencia();
    }
  });

  /* Tabs de pagos */
  document.querySelectorAll('.pagos-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pagos-tabs .tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      if (tab === 'pendientes') cargarPagosPendientes();
      else if (tab === 'historial') cargarHistorialPagos();
      else if (tab === 'subir') mostrarSubirComprobante();
    });
  });

  /* Chips de comunicados */
  document.querySelectorAll('.filter-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chips .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      filtrarComunicados(chip.dataset.filter);
    });
  });
}

/* ─── Disciplinas y grupos ───────────────────────────── */
async function cargarDisciplinasYGrupos() {
  try {
    disciplinasList = await api('/disciplinas');
    gruposList = await api('/grupos');

    /* Selects de filtro atletas */
    const fDisc = document.getElementById('filterDisciplina');
    if (fDisc) {
      fDisc.innerHTML = `<option value="">Todas las disciplinas</option>` +
        disciplinasList.map(d => `<option value="${d.id_disciplina}">${d.nombre}</option>`).join('');
    }

    /* Filtro disciplina en grupos admin */
    const fGrupDisc = document.getElementById('filterGrupoDisciplina');
    if (fGrupDisc) {
      fGrupDisc.innerHTML = `<option value="">Todas las disciplinas</option>` +
        disciplinasList.map(d => `<option value="${d.id_disciplina}">${d.nombre}</option>`).join('');
    }

    /* Select de disciplina en modal atleta */
    const aDis = document.getElementById('atletaDisciplina');
    if (aDis) {
      aDis.innerHTML = disciplinasList.map(d =>
        `<option value="${d.id_disciplina}">${d.nombre}</option>`).join('');
      /* Poblar grupos para la primera disciplina */
      filtrarGruposPorDisciplina('atletaDisciplina', 'atletaGrupo');
    }

    /* Select de disciplina en modal grupo */
    const gDis = document.getElementById('grupoDisciplina');
    if (gDis) gDis.innerHTML = disciplinasList.map(d =>
      `<option value="${d.id_disciplina}">${d.nombre}</option>`).join('');

    /* Select de disciplina en inscribir modal */
    const iDis = document.getElementById('inscDisciplina');
    if (iDis) {
      iDis.innerHTML = disciplinasList.map(d =>
        `<option value="${d.id_disciplina}">${d.nombre}</option>`).join('');
      filtrarGruposPorDisciplina('inscDisciplina', 'inscGrupo');
    }

    /* Select de asistencia disciplina */
    const asDiscF = document.getElementById('asistenciaDisciplinaFilter');
    if (asDiscF) {
      asDiscF.innerHTML = `<option value="">Todas las disciplinas</option>` +
        disciplinasList.map(d => `<option value="${d.id_disciplina}">${d.nombre}</option>`).join('');
    }

    /* Select de asistencia grupo */
    const asGru = document.getElementById('asistenciaGrupo');
    if (asGru) {
      asGru.innerHTML = gruposList.map(g =>
        `<option value="${g.id_grupo}">${g.nombre}</option>`).join('');
      asGru.addEventListener('change', cargarAtletasAsistencia);
      document.getElementById('asistenciaFecha').value = new Date().toISOString().slice(0,10);
      if (gruposList.length) cargarAtletasAsistencia();
    }
  } catch(e) { console.error('cargarDisciplinasYGrupos:', e); }
}

/* Filtra el select de grupos según disciplina seleccionada */
function filtrarGruposPorDisciplina(discSelectId, grupoSelectId) {
  const idDisc = document.getElementById(discSelectId)?.value;
  const grupoSel = document.getElementById(grupoSelectId);
  if (!grupoSel) return;
  const filtrados = idDisc
    ? gruposList.filter(g => String(g.id_disciplina) === String(idDisc))
    : gruposList;
  grupoSel.innerHTML = filtrados.length
    ? filtrados.map(g => `<option value="${g.id_grupo}">${g.nombre}</option>`).join('')
    : `<option value="">Sin grupos para esta disciplina</option>`;
}

async function cargarAtletasEnSelect(selectId) {
  try {
    const atletas = await api('/atletas');
    const sel = document.getElementById(selectId);
    if (sel) sel.innerHTML = atletas.map(a =>
      `<option value="${a.id_atleta}">${a.nombre} ${a.apellido}</option>`).join('');
  } catch(e) { showToast('Error cargando atletas', 'error'); }
}

/* ════════════════════════════════════════════════════════
   PANEL INICIO — ESTADÍSTICAS
════════════════════════════════════════════════════════ */
async function cargarEstadisticasInicio() {
  try {
    const stats = await api('/estadisticas');
    document.getElementById('totalAtletas').textContent   = stats.activos ?? 0;
    document.getElementById('totalDisciplinas').textContent = stats.total_disciplinas ?? 0;
    document.getElementById('pagosPendientes').textContent  = stats.pagos_pendientes ?? 0;

    const comunicados = await api('/comunicados');
    document.getElementById('comunicadosRecientes').textContent = comunicados.length;

    const container = document.getElementById('ultimosComunicados');
    if (!container) return;
    if (!comunicados.length) {
      container.innerHTML = `<div class="empty-state"><span class="es-icon">📢</span><p>No hay comunicados recientes.</p></div>`;
      return;
    }
    container.innerHTML = comunicados.slice(0,3).map(c => `
      <div class="aviso-card ${c.prioridad || 'normal'}">
        <h4>
          ${c.titulo}
          ${badge(c.prioridad || 'normal')}
        </h4>
        <p>${(c.mensaje || '').substring(0,100)}${c.mensaje?.length > 100 ? '…' : ''}</p>
        <small>${new Date(c.fecha_publicacion).toLocaleDateString('es-DO')} · ${c.destinatario || 'Todo el club'}</small>
      </div>
    `).join('');
  } catch(e) { console.error('cargarEstadisticasInicio:', e); }
}

/* ════════════════════════════════════════════════════════
   PANEL DASHBOARD — GRÁFICOS + MOROSIDAD + SOLICITUDES
════════════════════════════════════════════════════════ */
async function cargarDashboard() {
  if (!currentUser || currentUser.rol !== 'administracion') return;
  try {
    const stats = await api('/estadisticas');

    /* KPIs */
    document.getElementById('kpiContainer').innerHTML = [
      { icon:'👥', n: stats.total_atletas,    label:'Atletas totales' },
      { icon:'✅', n: stats.activos,           label:'Activos' },
      { icon:'⏳', n: stats.pagos_pendientes,  label:'Pagos pendientes' },
      { icon:'💰', n: stats.pagos_aprobados,   label:'Pagos aprobados' },
      { icon:'❌', n: stats.pagos_rechazados ?? 0, label:'Pagos rechazados' },
    ].map(k => `
      <div class="kpi-card">
        <span class="kpi-icon">${k.icon}</span>
        <h3>${k.n ?? 0}</h3>
        <span>${k.label}</span>
      </div>
    `).join('');

    /* Gráfico barras: atletas por disciplina */
    const discData = await api('/estadisticas/disciplinas');
    const ctxBar = document.getElementById('disciplinasChart').getContext('2d');
    if (charts.bar) charts.bar.destroy();
    charts.bar = new Chart(ctxBar, {
      type: 'bar',
      data: {
        labels: discData.map(d => d.nombre),
        datasets: [{
          label: 'Atletas',
          data: discData.map(d => d.total),
          backgroundColor: 'rgba(0,115,255,.7)',
          borderColor: '#0073FF',
          borderWidth: 1,
          borderRadius: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${ctx.raw} atletas` } }
        },
        scales: {
          x: { ticks: { color: '#6B80A0', font: { family: 'DM Sans', size: 11 } }, grid: { color: 'rgba(0,115,255,.06)' } },
          y: { ticks: { color: '#6B80A0', font: { family: 'DM Sans', size: 11 } }, grid: { color: 'rgba(0,115,255,.06)' }, beginAtZero: true }
        }
      }
    });

    /* Gráfico pastel: estado de pagos */
    const ctxPie = document.getElementById('pagosEstadoChart').getContext('2d');
    if (charts.pie) charts.pie.destroy();
    charts.pie = new Chart(ctxPie, {
      type: 'doughnut',
      data: {
        labels: ['Aprobados', 'Pendientes', 'Rechazados'],
        datasets: [{
          data: [
            stats.pagos_aprobados  ?? 0,
            stats.pagos_pendientes ?? 0,
            stats.pagos_rechazados ?? 0
          ],
          backgroundColor: ['rgba(34,197,94,.75)', 'rgba(255,197,36,.75)', 'rgba(239,68,68,.75)'],
          borderColor:     ['#22C55E', '#FFC524', '#EF4444'],
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        cutout: '62%',
        plugins: {
          legend: { position: 'bottom', labels: { color: '#D2DCED', padding: 14, font: { family: 'DM Sans', size: 12 } } }
        }
      }
    });

    /* Gráfico línea: pagos por mes */
    const pagos = await api('/pagos');
    const meses = Array.from({length:12}, (_, i) => i);
    const nombresMes = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const aprobados = pagos.filter(p => p.estado === 'aprobado');
    const montosPorMes = meses.map(m => {
      return aprobados
        .filter(p => p.fecha_pago && new Date(p.fecha_pago).getMonth() === m)
        .reduce((s, p) => s + Number(p.monto), 0);
    });
    const ctxLine = document.getElementById('pagosMesChart').getContext('2d');
    if (charts.line) charts.line.destroy();
    charts.line = new Chart(ctxLine, {
      type: 'line',
      data: {
        labels: nombresMes,
        datasets: [{
          label: 'RD$ aprobados',
          data: montosPorMes,
          borderColor: '#0073FF',
          backgroundColor: 'rgba(0,115,255,.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#0073FF',
          pointRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` RD$ ${ctx.raw.toLocaleString()}` } }
        },
        scales: {
          x: { ticks: { color: '#6B80A0', font: { family: 'DM Sans', size: 11 } }, grid: { color: 'rgba(0,115,255,.06)' } },
          y: { ticks: { color: '#6B80A0', font: { family: 'DM Sans', size: 11 }, callback: v => `RD$ ${v}` }, grid: { color: 'rgba(0,115,255,.06)' }, beginAtZero: true }
        }
      }
    });

    /* Tabla de morosidad */
    const atletas = await api('/atletas');
    const morosos = [];
    for (const a of atletas.filter(a => a.estado === 'activo')) {
      const pagoAtleta = pagos.filter(p => p.id_atleta === a.id_atleta && p.estado === 'pendiente');
      if (pagoAtleta.length >= 1) {
        morosos.push({ ...a, pendientes: pagoAtleta.length });
      }
    }
    const tbody = document.getElementById('morosidadBody');
    if (tbody) {
      tbody.innerHTML = morosos.length ? morosos.map(a => `
        <tr>
          <td><div class="td-primary">${a.nombre} ${a.apellido}</div></td>
          <td>${a.disciplina || '—'}</td>
          <td>${a.tutor || '—'}</td>
          <td>${a.telefono_tutor || '—'}</td>
          <td>${badge(a.pendientes >= 3 ? 'rechazado' : 'pendiente')} ${a.pendientes} mes(es)</td>
        </tr>
      `).join('') : `<tr><td colspan="5" class="table-empty"><span class="es-icon">✅</span><p>Sin alertas de morosidad</p></td></tr>`;
    }

    /* Solicitudes de registro pendientes */
    await cargarSolicitudesRegistro();

  } catch(e) { console.error('cargarDashboard:', e); showToast('Error cargando dashboard', 'error'); }
}

/* ─── Solicitudes de registro (admin) ───────────────── */
async function cargarSolicitudesRegistro() {
  const tbody = document.getElementById('solicitudesBody');
  const badge_el = document.getElementById('solicitudesBadge');
  if (!tbody) return;
  try {
    const solicitudes = await api('/registro-solicitudes');
    const pendientes = solicitudes.filter(s => s.estado === 'pendiente');

    if (badge_el) {
      if (pendientes.length > 0) {
        badge_el.textContent = `${pendientes.length} pendiente${pendientes.length !== 1 ? 's' : ''}`;
        badge_el.classList.remove('hidden');
      } else {
        badge_el.classList.add('hidden');
      }
    }

    if (!pendientes.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="table-empty"><span class="es-icon">✅</span><p>Sin solicitudes pendientes</p></td></tr>`;
      return;
    }

    tbody.innerHTML = pendientes.map(s => `
      <tr>
        <td><div class="td-primary">${s.nombre}</div></td>
        <td>${s.correo}</td>
        <td>${badge(s.rol || 'pendiente')}</td>
        <td>${s.telefono || '—'}</td>
        <td><div class="td-secondary">${s.fecha_solicitud ? new Date(s.fecha_solicitud).toLocaleDateString('es-DO') : '—'}</div></td>
        <td>
          <div class="td-actions">
            <button class="btn-success-sm" onclick="aprobarSolicitud(${s.id_solicitud})">✅ Aprobar</button>
            <button class="btn-danger-sm"  onclick="rechazarSolicitud(${s.id_solicitud})">❌ Rechazar</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty"><p>Error cargando solicitudes.</p></td></tr>`;
  }
}

window.aprobarSolicitud = async (id) => {
  if (!confirm('¿Aprobar esta solicitud? Se creará la cuenta y el usuario podrá iniciar sesión.')) return;
  try {
    await api(`/registro-solicitudes/${id}/aprobar`, { method: 'PUT' });
    showToast('Solicitud aprobada — cuenta creada ✅', 'success');
    cargarSolicitudesRegistro();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
};

window.rechazarSolicitud = async (id) => {
  if (!confirm('¿Rechazar esta solicitud?')) return;
  try {
    await api(`/registro-solicitudes/${id}/rechazar`, { method: 'PUT' });
    showToast('Solicitud rechazada', 'info');
    cargarSolicitudesRegistro();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
};

/* ════════════════════════════════════════════════════════
   PANEL ATLETAS (admin)
════════════════════════════════════════════════════════ */
async function cargarAtletasAdmin() {
  const tbody = document.getElementById('atletasTableBody');
  if (!tbody) return;
  try {
    let atletas = await api('/atletas');
    atletasList = atletas;

    const search = document.getElementById('searchAtleta')?.value.toLowerCase() || '';
    const disc   = document.getElementById('filterDisciplina')?.value;
    const estado = document.getElementById('filterEstado')?.value;

    atletas = atletas.filter(a => {
      const nombre = `${a.nombre} ${a.apellido}`.toLowerCase();
      return (
        (!search || nombre.includes(search)) &&
        (!disc   || String(a.id_disciplina) === String(disc)) &&
        (!estado || a.estado === estado)
      );
    });

    if (!atletas.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="table-empty"><span class="es-icon">👥</span><p>No se encontraron atletas.</p></td></tr>`;
      return;
    }

    tbody.innerHTML = atletas.map(a => `
      <tr>
        <td>
          <div class="td-primary">${a.nombre} ${a.apellido}</div>
          <div class="td-secondary">Edad: ${a.fecha_nacimiento ? calcularEdad(a.fecha_nacimiento) + ' años' : '—'}</div>
        </td>
        <td>${a.disciplina || '—'}</td>
        <td>${a.grupo || '—'}</td>
        <td>
          <div class="td-primary">${a.tutor || '—'}</div>
          <div class="td-secondary">${a.telefono_tutor || ''}</div>
        </td>
        <td>${badge(a.estado)}</td>
        <td>
          <div class="td-actions">
            <button class="btn-outline-small" onclick="editarAtleta(${a.id_atleta})">✏️ Editar</button>
            ${a.estado === 'pendiente'
              ? `<button class="btn-success-sm" onclick="cambiarEstadoAtleta(${a.id_atleta},'activo')">✅</button>`
              : ''}
            <button class="btn-danger-sm" onclick="eliminarAtleta(${a.id_atleta})">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty"><p>Error cargando atletas: ${e.message}</p></td></tr>`;
  }
}

function calcularEdad(fechaNac) {
  const hoy = new Date();
  const nac = new Date(fechaNac);
  let edad = hoy.getFullYear() - nac.getFullYear();
  if (hoy.getMonth() < nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}

window.editarAtleta = async (id) => {
  try {
    const a = await api(`/atletas/${id}`);
    document.getElementById('atletaId').value       = a.id_atleta;
    document.getElementById('atletaNombre').value   = a.nombre;
    document.getElementById('atletaApellido').value = a.apellido;
    document.getElementById('atletaFechaNac').value = a.fecha_nacimiento?.split('T')[0] || '';
    document.getElementById('atletaDisciplina').value = a.id_disciplina;
    filtrarGruposPorDisciplina('atletaDisciplina', 'atletaGrupo');
    setTimeout(() => { document.getElementById('atletaGrupo').value = a.id_grupo; }, 50);
    document.getElementById('atletaTutorNombre').value   = a.tutor_nombre || a.tutor || '';
    document.getElementById('atletaTutorTelefono').value = a.telefono_tutor || '';
    document.getElementById('atletaTutorEmail').value    = a.email_tutor || '';
    document.getElementById('atletaModalTitle').textContent = '✏️ Editar Atleta';
    abrirModal('atletaModal');
  } catch(e) { showToast('Error cargando atleta: ' + e.message, 'error'); }
};

window.cambiarEstadoAtleta = async (id, estado) => {
  try {
    await api(`/atletas/${id}/estado`, { method:'PUT', body: JSON.stringify({ estado }) });
    showToast(`Atleta marcado como ${estado}`, 'success');
    cargarAtletasAdmin();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
};

window.eliminarAtleta = async (id) => {
  if (!confirm('¿Eliminar este atleta? Esta acción no se puede deshacer.')) return;
  try {
    await api(`/atletas/${id}`, { method:'DELETE' });
    showToast('Atleta eliminado', 'success');
    cargarAtletasAdmin();
  } catch(e) { showToast('Error eliminando atleta', 'error'); }
};

function abrirModalAtleta() {
  document.getElementById('atletaId').value = '';
  document.getElementById('atletaModalTitle').textContent = '➕ Nuevo Atleta';
  document.querySelectorAll('#atletaModal input, #atletaModal textarea').forEach(i => i.value = '');
  filtrarGruposPorDisciplina('atletaDisciplina', 'atletaGrupo');
  abrirModal('atletaModal');
}

async function guardarAtleta() {
  const id = document.getElementById('atletaId').value;
  const nombre      = document.getElementById('atletaNombre').value.trim();
  const apellido    = document.getElementById('atletaApellido').value.trim();
  const fechaNac    = document.getElementById('atletaFechaNac').value;
  const idDisc      = document.getElementById('atletaDisciplina').value;
  const idGrupo     = document.getElementById('atletaGrupo').value;
  const tutorNombre = document.getElementById('atletaTutorNombre').value.trim();
  const tutorTel    = document.getElementById('atletaTutorTelefono').value.trim();
  const tutorEmail  = document.getElementById('atletaTutorEmail').value.trim();

  if (!nombre || !apellido || !fechaNac || !idDisc) {
    return showToast('Completa nombre, apellido, fecha y disciplina', 'error');
  }

  const data = {
    nombre, apellido,
    fecha_nacimiento: fechaNac,
    id_disciplina: idDisc,
    id_grupo: idGrupo || null,
    nombre_tutor: tutorNombre,
    telefono_tutor: tutorTel,
    email_tutor: tutorEmail,
  };

  try {
    if (id) {
      await api(`/atletas/${id}`, { method:'PUT', body: JSON.stringify(data) });
      showToast('Atleta actualizado', 'success');
    } else {
      await api('/atletas', { method:'POST', body: JSON.stringify(data) });
      showToast('Atleta registrado — pendiente de aprobación', 'success');
    }
    cerrarModales();
    cargarAtletasAdmin();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

/* ════════════════════════════════════════════════════════
   PANEL GRUPOS (admin) — CRUD COMPLETO
════════════════════════════════════════════════════════ */
async function cargarGruposAdmin() {
  const tbody = document.getElementById('gruposTableBody');
  if (!tbody) return;
  try {
    const grupos = await api('/grupos');
    const discFiltro = document.getElementById('filterGrupoDisciplina')?.value;

    let lista = discFiltro
      ? grupos.filter(g => String(g.id_disciplina) === String(discFiltro))
      : grupos;

    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="table-empty"><span class="es-icon">🗂️</span><p>No hay grupos creados.</p></td></tr>`;
      return;
    }

    // Obtener conteo de atletas por grupo
    let atletas = [];
    try { atletas = await api('/atletas'); } catch(_) {}

    tbody.innerHTML = lista.map(g => {
      const count = atletas.filter(a => String(a.id_grupo) === String(g.id_grupo)).length;
      return `
        <tr>
          <td><div class="td-primary">${g.nombre}</div></td>
          <td>${g.disciplina || '—'}</td>
          <td>${g.entrenador || '<span class="text-muted">Sin asignar</span>'}</td>
          <td><span class="badge normal">${count} atleta${count !== 1 ? 's' : ''}</span></td>
          <td>
            <div class="td-actions">
              <button class="btn-outline-small" onclick="editarGrupo(${g.id_grupo})">✏️ Editar</button>
              <button class="btn-danger-sm" onclick="eliminarGrupo(${g.id_grupo})">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty"><p>Error cargando grupos: ${e.message}</p></td></tr>`;
  }
}

async function abrirModalGrupo() {
  document.getElementById('grupoId').value = '';
  document.getElementById('grupoModalTitle').textContent = '➕ Nuevo Grupo';
  document.getElementById('grupoNombre').value = '';
  /* Poblar entrenadores */
  await cargarEntrenadoresEnSelect('grupoEntrenador');
  abrirModal('grupoModal');
}

window.editarGrupo = async (id) => {
  try {
    const g = await api(`/grupos/${id}`);
    document.getElementById('grupoId').value = g.id_grupo;
    document.getElementById('grupoModalTitle').textContent = '✏️ Editar Grupo';
    document.getElementById('grupoNombre').value = g.nombre;
    document.getElementById('grupoDisciplina').value = g.id_disciplina;
    await cargarEntrenadoresEnSelect('grupoEntrenador');
    setTimeout(() => {
      document.getElementById('grupoEntrenador').value = g.id_entrenador || '';
    }, 50);
    abrirModal('grupoModal');
  } catch(e) { showToast('Error cargando grupo: ' + e.message, 'error'); }
};

async function cargarEntrenadoresEnSelect(selectId) {
  try {
    const usuarios = await api('/usuarios');
    const entrenadores = usuarios.filter(u => u.rol === 'entrenador');
    const sel = document.getElementById(selectId);
    if (sel) {
      sel.innerHTML = `<option value="">Sin asignar</option>` +
        entrenadores.map(e => `<option value="${e.id_usuario}">${e.nombre}</option>`).join('');
    }
  } catch(e) {
    // Si no existe /usuarios, dejar el select con la opción vacía
    console.warn('No se pudo cargar entrenadores:', e);
  }
}

async function guardarGrupo() {
  const id        = document.getElementById('grupoId').value;
  const nombre    = document.getElementById('grupoNombre').value.trim();
  const idDisc    = document.getElementById('grupoDisciplina').value;
  const idEnt     = document.getElementById('grupoEntrenador').value;

  if (!nombre || !idDisc) return showToast('Completa nombre y disciplina', 'error');

  const data = {
    nombre,
    id_disciplina: idDisc,
    id_entrenador: idEnt || null,
  };

  try {
    if (id) {
      await api(`/grupos/${id}`, { method:'PUT', body: JSON.stringify(data) });
      showToast('Grupo actualizado ✅', 'success');
    } else {
      await api('/grupos', { method:'POST', body: JSON.stringify(data) });
      showToast('Grupo creado ✅', 'success');
    }
    cerrarModales();
    // Recargar la lista global de grupos
    gruposList = await api('/grupos');
    cargarGruposAdmin();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

window.eliminarGrupo = async (id) => {
  if (!confirm('¿Eliminar este grupo? Los atletas asignados quedarán sin grupo.')) return;
  try {
    await api(`/grupos/${id}`, { method:'DELETE' });
    showToast('Grupo eliminado', 'success');
    gruposList = await api('/grupos');
    cargarGruposAdmin();
  } catch(e) { showToast('Error eliminando grupo: ' + e.message, 'error'); }
};

/* ════════════════════════════════════════════════════════
   PANEL PAGOS
════════════════════════════════════════════════════════ */
async function cargarPagosPendientes() {
  const container = document.getElementById('pagosContent');
  if (!container) return;
  container.innerHTML = '<div class="spinner"></div>';

  try {
    let pagos = await api('/pagos');

    if (currentUser.rol === 'tutor') {
      const atletas = await api('/atletas');
      const misIds = new Set(atletas.filter(a => a.id_tutor === currentUser.id).map(a => a.id_atleta));
      pagos = pagos.filter(p => misIds.has(p.id_atleta));
    }

    const pendientes = pagos.filter(p => p.estado === 'pendiente');
    if (!pendientes.length) {
      container.innerHTML = `<div class="empty-state"><span class="es-icon">✅</span><h3>Sin pagos pendientes</h3><p>No hay pagos esperando acción.</p></div>`;
      return;
    }

    container.innerHTML = pendientes.map(p => `
      <div class="pago-card ${p.estado}">
        <div class="pago-info">
          <div class="pago-nombre">${p.nombre_atleta ?? ''} ${p.apellido_atleta ?? ''}</div>
          <div class="pago-meta">
            <span>${p.tipo_pago ?? '—'}</span>
            <span>·</span>
            <span>${p.metodo_pago ?? '—'}</span>
            <span>·</span>
            <span>${p.fecha_pago ? new Date(p.fecha_pago).toLocaleDateString('es-DO') : 'Sin fecha'}</span>
            ${p.telefono_tutor ? `<span>· 📞 ${p.telefono_tutor}</span>` : ''}
          </div>
          ${badge(p.estado)}
        </div>
        <div class="pago-monto ${p.estado}">RD$ ${Number(p.monto ?? 0).toLocaleString()}</div>
        <div class="pago-actions">
          ${p.comprobante ? `<a class="comp-link" href="${API_BASE}${p.comprobante}" target="_blank">📎 Ver comprobante</a>` : ''}
          ${currentUser.rol === 'administracion' ? `
            <button class="btn-success-sm" onclick="abrirEstadoPago(${p.id_pago},'aprobado','${p.nombre_atleta} ${p.apellido_atleta}')">✅ Aprobar</button>
            <button class="btn-danger-sm"  onclick="abrirEstadoPago(${p.id_pago},'rechazado','${p.nombre_atleta} ${p.apellido_atleta}')">❌ Rechazar</button>
          ` : ''}
        </div>
      </div>
    `).join('');
  } catch(e) {
    container.innerHTML = `<div class="empty-state"><p>Error cargando pagos: ${e.message}</p></div>`;
  }
}

async function cargarHistorialPagos() {
  const container = document.getElementById('pagosContent');
  if (!container) return;
  container.innerHTML = '<div class="spinner"></div>';

  try {
    let pagos = await api('/pagos');

    if (currentUser.rol === 'tutor') {
      const atletas = await api('/atletas');
      const misIds = new Set(atletas.filter(a => a.id_tutor === currentUser.id).map(a => a.id_atleta));
      pagos = pagos.filter(p => misIds.has(p.id_atleta));
    }

    if (!pagos.length) {
      container.innerHTML = `<div class="empty-state"><span class="es-icon">💰</span><p>No hay pagos registrados.</p></div>`;
      return;
    }

    container.innerHTML = pagos.map(p => `
      <div class="pago-card ${p.estado}">
        <div class="pago-info">
          <div class="pago-nombre">${p.nombre_atleta ?? ''} ${p.apellido_atleta ?? ''}</div>
          <div class="pago-meta">
            <span>${p.tipo_pago ?? '—'}</span> · <span>${p.metodo_pago ?? '—'}</span>
            · <span>${p.fecha_pago ? new Date(p.fecha_pago).toLocaleDateString('es-DO') : '—'}</span>
          </div>
          ${badge(p.estado)}
          ${p.motivo_rechazo ? `<div style="font-size:12px;color:var(--danger);margin-top:4px;">Motivo: ${p.motivo_rechazo}</div>` : ''}
        </div>
        <div class="pago-monto ${p.estado}">RD$ ${Number(p.monto ?? 0).toLocaleString()}</div>
        <div class="pago-actions">
          ${p.comprobante ? `<a class="comp-link" href="${API_BASE}${p.comprobante}" target="_blank">📎 Comprobante</a>` : ''}
        </div>
      </div>
    `).join('');
  } catch(e) {
    container.innerHTML = `<div class="empty-state"><p>Error: ${e.message}</p></div>`;
  }
}

function mostrarSubirComprobante() {
  const container = document.getElementById('pagosContent');
  if (!container) return;
  container.innerHTML = `
    <div class="upload-area" onclick="document.getElementById('compArchivo').click()">
      <span class="upload-icon">📄</span>
      <h4>SUBIR COMPROBANTE DE TRANSFERENCIA</h4>
      <p>JPG, PNG o PDF · Máximo 5 MB · Haz clic para seleccionar</p>
      <div class="upload-form" onclick="event.stopPropagation()">
        <div>
          <label>Atleta</label>
          <select id="compAtleta" class="input-field"></select>
        </div>
        <div>
          <label>Tipo de pago</label>
          <select id="compTipo" class="input-field">
            <option value="mensualidad">Mensualidad</option>
            <option value="reinscripcion">Reinscripción anual</option>
          </select>
        </div>
        <div>
          <label>Monto (RD$)</label>
          <input type="number" id="compMonto" placeholder="Ej: 1500" class="input-field">
        </div>
        <div>
          <label>Archivo del comprobante</label>
          <input type="file" id="compArchivo" accept="image/*,application/pdf" class="input-field">
        </div>
        <button class="btn-primary" onclick="subirComprobante()">📤 Enviar comprobante</button>
      </div>
    </div>
  `;
  cargarAtletasEnSelect('compAtleta');
}

async function subirComprobante() {
  const file = document.getElementById('compArchivo')?.files[0];
  if (!file) return showToast('Selecciona un archivo', 'error');
  const monto = document.getElementById('compMonto')?.value;
  if (!monto) return showToast('Ingresa el monto', 'error');

  const formData = new FormData();
  formData.append('id_atleta',   document.getElementById('compAtleta').value);
  formData.append('tipo_pago',   document.getElementById('compTipo').value);
  formData.append('monto',       monto);
  formData.append('metodo_pago', 'transferencia');
  formData.append('comprobante', file);

  try {
    const res = await fetch(`${API_BASE}/pagos/con-comprobante`, { method:'POST', body: formData });
    if (res.ok) {
      showToast('Comprobante enviado — pendiente de aprobación', 'success');
      cargarPagosPendientes();
    } else showToast('Error al subir', 'error');
  } catch(e) { showToast('Error de conexión', 'error'); }
}

async function registrarPagoEfectivo() {
  const data = {
    id_atleta:  document.getElementById('efectivoAtleta').value,
    tipo_pago:  document.getElementById('efectivoTipo').value,
    monto:      document.getElementById('efectivoMonto').value,
    metodo_pago:'efectivo'
  };
  if (!data.id_atleta || !data.monto) return showToast('Completa todos los campos', 'error');
  try {
    await api('/pagos', { method:'POST', body: JSON.stringify(data) });
    showToast('Pago en efectivo registrado (aprobado automáticamente)', 'success');
    cerrarModales();
    cargarPagosPendientes();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

/* Modal aprobar/rechazar pago */
window.abrirEstadoPago = function(id, accion, nombreAtleta) {
  document.getElementById('estadoPagoId').value     = id;
  document.getElementById('estadoPagoAccion').value = accion;
  document.getElementById('estadoPagoTitle').textContent =
    accion === 'aprobado' ? `✅ Aprobar pago de ${nombreAtleta}` : `❌ Rechazar pago de ${nombreAtleta}`;
  document.getElementById('estadoPagoDesc').textContent =
    accion === 'aprobado'
      ? 'El pago quedará marcado como aprobado. El padre/tutor podrá verlo en su historial.'
      : 'Indica el motivo. El padre/tutor verá esta razón al consultar sus pagos.';
  const motivoWrap = document.getElementById('motivoWrap');
  motivoWrap?.classList.toggle('hidden', accion !== 'rechazado');
  if (document.getElementById('motivoRechazo')) document.getElementById('motivoRechazo').value = '';
  abrirModal('estadoPagoModal');
};

async function confirmarEstadoPago() {
  const id     = document.getElementById('estadoPagoId').value;
  const accion = document.getElementById('estadoPagoAccion').value;
  const motivo = document.getElementById('motivoRechazo')?.value.trim();

  if (accion === 'rechazado' && !motivo) {
    return showToast('Ingresa el motivo del rechazo', 'error');
  }
  try {
    await api(`/pagos/${id}/estado`, {
      method: 'PUT',
      body: JSON.stringify({ estado: accion, motivo_rechazo: motivo || undefined })
    });
    showToast(`Pago ${accion}`, 'success');
    cerrarModales();
    cargarPagosPendientes();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

/* ════════════════════════════════════════════════════════
   PANEL ASISTENCIA (admin) — con filtro por disciplina
════════════════════════════════════════════════════════ */
async function cargarGruposAsistencia() {
  await cargarDisciplinasYGrupos();
}

async function cargarAtletasAsistencia() {
  const grupo = document.getElementById('asistenciaGrupo')?.value;
  if (!grupo) return;
  attEstados = {};
  actualizarResumenAsistencia();

  const infoBox = document.getElementById('asistenciaInfoBox');
  const grupoObj = gruposList.find(g => String(g.id_grupo) === String(grupo));
  if (infoBox && grupoObj) {
    infoBox.style.display = 'flex';
    infoBox.innerHTML = `
      <span class="asistencia-info-disc">📚 ${grupoObj.disciplina || 'Sin disciplina'}</span>
      <span class="asistencia-info-sep">›</span>
      <span class="asistencia-info-grupo">🗂️ ${grupoObj.nombre}</span>
      <span class="asistencia-info-sep">·</span>
      <span class="asistencia-info-fecha">📅 ${document.getElementById('asistenciaFecha')?.value || '—'}</span>
    `;
  }

  try {
    const atletas = await api(`/asistencia/grupo/${grupo}/atletas`);
    const container = document.getElementById('asistenciaLista');
    if (!container) return;

    if (!atletas.length) {
      container.innerHTML = `<div class="empty-state"><span class="es-icon">👥</span><p>Este grupo no tiene atletas.</p></div>`;
      return;
    }

    container.innerHTML = atletas.map(a => `
      <div class="asistencia-fila" data-id="${a.id_atleta}">
        <div class="att-nombre">${a.nombre} ${a.apellido}</div>
        <div class="att-estado-btns">
          <button class="att-btn presente" onclick="marcarAsistencia(${a.id_atleta},'presente',this)">✅ Presente</button>
          <button class="att-btn ausente"  onclick="marcarAsistencia(${a.id_atleta},'ausente',this)">❌ Ausente</button>
          <button class="att-btn tarde"    onclick="marcarAsistencia(${a.id_atleta},'tarde',this)">⏰ Tarde</button>
        </div>
        <input type="text" class="input-field att-obs-input"
               id="obs-${a.id_atleta}" placeholder="Observación…">
      </div>
    `).join('');

    actualizarResumenAsistencia();
  } catch(e) {
    document.getElementById('asistenciaLista').innerHTML = `<div class="empty-state"><p>Error: ${e.message}</p></div>`;
  }
}

window.marcarAsistencia = function(id, estado, btn) {
  const fila = btn.closest('.asistencia-fila');
  fila.querySelectorAll('.att-btn').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  attEstados[id] = estado;
  actualizarResumenAsistencia();
};

function actualizarResumenAsistencia() {
  const vals = Object.values(attEstados);
  const total = document.querySelectorAll('#asistenciaLista .asistencia-fila').length;
  document.getElementById('sum-presentes').textContent = vals.filter(v=>v==='presente').length;
  document.getElementById('sum-ausentes').textContent  = vals.filter(v=>v==='ausente').length;
  document.getElementById('sum-tardanzas').textContent = vals.filter(v=>v==='tarde').length;
  document.getElementById('sum-sin').textContent       = total - vals.length;
}

async function guardarAsistencia() {
  const grupo = document.getElementById('asistenciaGrupo')?.value;
  const fecha = document.getElementById('asistenciaFecha')?.value;
  if (!grupo || !fecha) return showToast('Selecciona grupo y fecha', 'error');

  const registros = Array.from(document.querySelectorAll('#asistenciaLista .asistencia-fila'))
    .map(row => {
      const id = row.dataset.id;
      return {
        id_atleta:   id,
        id_grupo:    grupo,
        fecha,
        estado:      attEstados[id] || 'ausente',
        observacion: document.getElementById(`obs-${id}`)?.value || ''
      };
    });

  if (!registros.length) return showToast('No hay atletas para registrar', 'error');
  try {
    await api('/asistencia', { method:'POST', body: JSON.stringify({ registros }) });
    showToast(`Asistencia de ${registros.length} atletas guardada ✅`, 'success');
  } catch(e) { showToast('Error guardando asistencia: ' + e.message, 'error'); }
}

/* ════════════════════════════════════════════════════════
   PANEL ENTRENADOR — MIS GRUPOS (con info del grupo)
════════════════════════════════════════════════════════ */
async function cargarGruposEntrenador() {
  if (!currentUser || currentUser.rol !== 'entrenador') return;
  try {
    const grupos = await api('/grupos');
    const misGrupos = grupos.filter(g => g.id_entrenador === currentUser.id);
    const sel = document.getElementById('entrenadorGrupo');
    if (!sel) return;

    if (!misGrupos.length) {
      sel.innerHTML = `<option value="">Sin grupos asignados</option>`;
      document.getElementById('entrenadorGrupoInfo')?.classList.add('hidden');
      return;
    }

    sel.innerHTML = misGrupos.map(g => `<option value="${g.id_grupo}" data-nombre="${g.nombre}" data-disc="${g.disciplina || ''}">${g.nombre}${g.disciplina ? ' — ' + g.disciplina : ''}</option>`).join('');
    sel.onchange = () => {
      cargarAtletasEntrenador();
      actualizarInfoGrupoEntrenador();
    };
    actualizarInfoGrupoEntrenador();
    cargarAtletasEntrenador();
  } catch(e) { console.error('cargarGruposEntrenador:', e); }
}

function actualizarInfoGrupoEntrenador() {
  const sel = document.getElementById('entrenadorGrupo');
  const infoCard = document.getElementById('entrenadorGrupoInfo');
  if (!sel || !infoCard) return;
  const opt = sel.options[sel.selectedIndex];
  if (!opt || !opt.value) { infoCard.classList.add('hidden'); return; }
  infoCard.classList.remove('hidden');
  document.getElementById('entrenadorGrupoNombre').textContent = opt.dataset.nombre || opt.text;
  document.getElementById('entrenadorGrupoDisciplina').textContent = opt.dataset.disc || '—';
}

async function cargarAtletasEntrenador() {
  const grupo = document.getElementById('entrenadorGrupo')?.value;
  if (!grupo) return;
  try {
    const atletas = await api(`/asistencia/grupo/${grupo}/atletas`);
    const container = document.getElementById('entrenadorAsistenciaLista');
    if (!container) return;

    const countEl = document.getElementById('entrenadorGrupoCount');
    if (countEl) countEl.textContent = atletas.length + ' atleta' + (atletas.length !== 1 ? 's' : '');

    if (!atletas.length) {
      container.innerHTML = `<div class="empty-state"><span class="es-icon">👥</span><p>Este grupo no tiene atletas.</p></div>`;
      return;
    }

    container.innerHTML = atletas.map(a => `
      <div class="asistencia-fila" data-id="${a.id_atleta}">
        <div class="att-nombre">${a.nombre} ${a.apellido}</div>
        <div class="att-estado-btns">
          <button class="att-btn presente" onclick="marcarEnt(${a.id_atleta},'presente',this)">✅ Presente</button>
          <button class="att-btn ausente"  onclick="marcarEnt(${a.id_atleta},'ausente',this)">❌ Ausente</button>
          <button class="att-btn tarde"    onclick="marcarEnt(${a.id_atleta},'tarde',this)">⏰ Tarde</button>
        </div>
        <input type="text" class="input-field att-obs-input" id="eobs-${a.id_atleta}" placeholder="Observación…">
      </div>
    `).join('');
  } catch(e) { console.error('cargarAtletasEntrenador:', e); }
}

window.marcarEnt = function(id, estado, btn) {
  const fila = btn.closest('.asistencia-fila');
  fila.querySelectorAll('.att-btn').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  attEstadosEnt[id] = estado;
};

async function guardarAsistenciaEntrenador() {
  const grupo = document.getElementById('entrenadorGrupo')?.value;
  if (!grupo) return showToast('Selecciona un grupo', 'error');
  const fecha = new Date().toISOString().slice(0,10);

  const registros = Array.from(document.querySelectorAll('#entrenadorAsistenciaLista .asistencia-fila'))
    .map(row => ({
      id_atleta:   row.dataset.id,
      id_grupo:    grupo,
      fecha,
      estado:      attEstadosEnt[row.dataset.id] || 'ausente',
      observacion: document.getElementById(`eobs-${row.dataset.id}`)?.value || ''
    }));

  if (!registros.length) return showToast('No hay atletas', 'error');
  try {
    await api('/asistencia', { method:'POST', body: JSON.stringify({ registros }) });
    showToast('Asistencia registrada ✅', 'success');
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

/* ════════════════════════════════════════════════════════
   PANEL COMUNICADOS — con opción de borrar (admin)
════════════════════════════════════════════════════════ */
let _todosLosComunicados = [];

async function cargarComunicados() {
  const container = document.getElementById('comunicadosLista');
  if (!container) return;
  container.innerHTML = '<div class="spinner"></div>';
  try {
    _todosLosComunicados = await api('/comunicados');
    renderComunicados(_todosLosComunicados);
  } catch(e) {
    container.innerHTML = `<div class="empty-state"><p>Error cargando comunicados.</p></div>`;
  }
}

function renderComunicados(list) {
  const container = document.getElementById('comunicadosLista');
  if (!container) return;
  if (!list.length) {
    container.innerHTML = `<div class="empty-state"><span class="es-icon">📢</span><h3>Sin comunicados</h3><p>No hay avisos publicados aún.</p></div>`;
    return;
  }
  const esAdmin = currentUser?.rol === 'administracion';
  container.innerHTML = list.map(c => `
    <div class="aviso-card ${c.prioridad || 'normal'}">
      <h4>
        <span>${c.titulo}</span>
        ${badge(c.prioridad || 'normal')}
        ${esAdmin ? `<button class="btn-danger-sm aviso-delete-btn" title="Borrar" onclick="borrarComunicado(${c.id_comunicado})">🗑️</button>` : ''}
      </h4>
      <p>${c.mensaje || ''}</p>
      <small>${new Date(c.fecha_publicacion).toLocaleString('es-DO')} · ${c.destinatario || 'Todo el club'}</small>
    </div>
  `).join('');
}

window.borrarComunicado = async (id) => {
  if (!confirm('¿Eliminar este comunicado? Esta acción no se puede deshacer.')) return;
  try {
    await api(`/comunicados/${id}`, { method: 'DELETE' });
    showToast('Comunicado eliminado ✅', 'success');
    cargarComunicados();
  } catch(e) { showToast('Error eliminando comunicado: ' + e.message, 'error'); }
};

function filtrarComunicados(tipo) {
  if (tipo === 'todos') return renderComunicados(_todosLosComunicados);
  if (tipo === 'urgente') return renderComunicados(_todosLosComunicados.filter(c => c.prioridad === 'urgente'));
}

async function publicarComunicado() {
  const titulo      = document.getElementById('comTitulo')?.value.trim();
  const mensaje     = document.getElementById('comMensaje')?.value.trim();
  const destinatario = document.getElementById('comDestinatario')?.value;
  const prioridad   = document.getElementById('comPrioridad')?.value;

  if (!titulo || !mensaje) return showToast('Completa título y mensaje', 'error');
  try {
    await api('/comunicados', { method:'POST', body: JSON.stringify({ titulo, mensaje, destinatario, prioridad }) });
    showToast('Comunicado publicado ✅', 'success');
    cerrarModales();
    cargarComunicados();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

/* ════════════════════════════════════════════════════════
   PANEL MIS ATLETAS (tutor) — CON INSCRIPCIÓN
════════════════════════════════════════════════════════ */
async function cargarMisAtletas() {
  if (!currentUser || currentUser.rol !== 'tutor') return;
  const tbody = document.getElementById('misAtletasBody');
  if (!tbody) return;
  try {
    const atletas = await api('/atletas');
    const misAtletas = atletas.filter(a => a.id_tutor === currentUser.id);
    if (!misAtletas.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="table-empty"><span class="es-icon">👥</span><p>No tienes atletas registrados. Usa "Inscribir Atleta" para agregar uno.</p></td></tr>`;
      return;
    }
    tbody.innerHTML = misAtletas.map(a => `
      <tr>
        <td><div class="td-primary">${a.nombre} ${a.apellido}</div></td>
        <td>${a.disciplina || '—'}</td>
        <td>${a.grupo || '—'}</td>
        <td>${badge(a.estado)}</td>
        <td>
          <button class="btn-outline-small" onclick="verHistorialAtleta(${a.id_atleta})">📄 Historial</button>
        </td>
      </tr>
    `).join('');
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty"><p>Error cargando atletas.</p></td></tr>`;
  }
}

window.verHistorialAtleta = async (id) => {
  try {
    const pagos = await api(`/pagos/${id}`);
    const resumen = pagos.length
      ? `${pagos.length} registros de pago encontrados.`
      : 'Sin historial de pagos.';
    showToast(resumen, 'info');
  } catch(e) { showToast('Error cargando historial', 'error'); }
};

/* Modal inscribir atleta (tutor) */
function abrirModalInscribir() {
  document.querySelectorAll('#inscribirModal input').forEach(i => i.value = '');
  filtrarGruposPorDisciplina('inscDisciplina', 'inscGrupo');
  abrirModal('inscribirModal');
}

async function guardarInscripcion() {
  const nombre   = document.getElementById('inscNombre').value.trim();
  const apellido = document.getElementById('inscApellido').value.trim();
  const fechaNac = document.getElementById('inscFechaNac').value;
  const idDisc   = document.getElementById('inscDisciplina').value;
  const idGrupo  = document.getElementById('inscGrupo').value;

  if (!nombre || !apellido || !fechaNac || !idDisc) {
    return showToast('Completa todos los campos obligatorios', 'error');
  }

  const data = {
    nombre,
    apellido,
    fecha_nacimiento: fechaNac,
    id_disciplina: idDisc,
    id_grupo: idGrupo || null,
    // Vincular con el tutor actual
    id_tutor: currentUser.id,
    nombre_tutor: currentUser.nombre,
    email_tutor: currentUser.correo || '',
  };

  try {
    await api('/atletas', { method: 'POST', body: JSON.stringify(data) });
    showToast('Atleta inscrito ✅ — pendiente de aprobación por administración', 'success');
    cerrarModales();
    cargarMisAtletas();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

/* ════════════════════════════════════════════════════════
   EXPORTACIONES
════════════════════════════════════════════════════════ */
async function exportarPDF() {
  const btn = document.getElementById('exportPDFBtn');
  if (btn) btn.textContent = '⏳ Generando…';
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const stats   = await api('/estadisticas');
    const atletas = await api('/atletas');
    const pagos   = await api('/pagos');
    const ahora   = new Date().toLocaleString('es-DO');

    doc.setFillColor(0,72,198);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setTextColor(255,255,255);
    doc.setFont('helvetica','bold');
    doc.setFontSize(16);
    doc.text('Club Deportivo y Cultural Halcones', 14, 12);
    doc.setFontSize(10);
    doc.setFont('helvetica','normal');
    doc.text('Reporte Administrativo General', 14, 20);
    doc.text(ahora, 140, 20);

    doc.setTextColor(0,0,0);
    doc.setFontSize(12);
    doc.setFont('helvetica','bold');
    doc.text('Resumen General', 14, 38);
    doc.setFontSize(10);
    doc.setFont('helvetica','normal');
    doc.text(`Atletas activos:     ${stats.activos ?? 0}`, 14, 47);
    doc.text(`Pagos aprobados:     ${stats.pagos_aprobados ?? 0}`, 14, 54);
    doc.text(`Pagos pendientes:    ${stats.pagos_pendientes ?? 0}`, 14, 61);

    doc.autoTable({
      startY: 72,
      head: [['Nombre', 'Apellido', 'Disciplina', 'Estado']],
      body: atletas.map(a => [a.nombre, a.apellido, a.disciplina || '—', a.estado]),
      styles: { fontSize: 9, font: 'helvetica' },
      headStyles: { fillColor: [0,72,198], textColor: 255 },
      alternateRowStyles: { fillColor: [240,246,255] }
    });

    const y2 = doc.lastAutoTable.finalY + 12;
    doc.setFont('helvetica','bold');
    doc.setFontSize(12);
    doc.text('Historial de Pagos', 14, y2);
    doc.autoTable({
      startY: y2 + 6,
      head: [['Atleta', 'Tipo', 'Método', 'Monto RD$', 'Estado']],
      body: pagos.map(p => [
        `${p.nombre_atleta} ${p.apellido_atleta}`,
        p.tipo_pago, p.metodo_pago,
        Number(p.monto).toLocaleString(),
        p.estado
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [0,72,198], textColor: 255 },
    });

    doc.save('reporte_halcones.pdf');
    showToast('PDF generado ✅', 'success');
  } catch(e) {
    showToast('Error generando PDF: ' + e.message, 'error');
  } finally {
    if (btn) btn.textContent = '📄 Exportar PDF';
  }
}

async function exportarExcel() {
  const btn = document.getElementById('exportExcelBtn');
  if (btn) btn.textContent = '⏳ Generando…';
  try {
    const atletas = await api('/atletas');
    const pagos   = await api('/pagos');

    const wsAtletas = XLSX.utils.json_to_sheet(atletas.map(a => ({
      Nombre:     a.nombre,
      Apellido:   a.apellido,
      Disciplina: a.disciplina || '—',
      Grupo:      a.grupo || '—',
      Estado:     a.estado,
      Tutor:      a.tutor || '—',
      Telefono:   a.telefono_tutor || '—'
    })));

    const wsPagos = XLSX.utils.json_to_sheet(pagos.map(p => ({
      Atleta:     `${p.nombre_atleta} ${p.apellido_atleta}`,
      Tipo:       p.tipo_pago,
      Metodo:     p.metodo_pago,
      Monto_RD:   p.monto,
      Estado:     p.estado,
      Fecha:      p.fecha_pago ? new Date(p.fecha_pago).toLocaleDateString('es-DO') : '—',
      Motivo:     p.motivo_rechazo || ''
    })));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsAtletas, 'Atletas');
    XLSX.utils.book_append_sheet(wb, wsPagos,   'Pagos');
    XLSX.writeFile(wb, 'reporte_halcones.xlsx');
    showToast('Excel generado ✅', 'success');
  } catch(e) {
    showToast('Error generando Excel: ' + e.message, 'error');
  } finally {
    if (btn) btn.textContent = '📊 Exportar Excel';
  }
}

/* ════════════════════════════════════════════════════════
   INICIALIZACIÓN GLOBAL
════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initRoleSelector();

  const saved = sessionStorage.getItem('halcones_user');
  if (saved) {
    currentUser = JSON.parse(saved);
    document.getElementById('loginModal').classList.remove('open');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('userNameDisplay').textContent = currentUser.nombre;
    document.getElementById('userAvatar').textContent     = initials(currentUser.nombre);
    inicializarPestanas();
    cargarDatosIniciales();
  } else {
    document.getElementById('loginModal').classList.add('open');
  }
});