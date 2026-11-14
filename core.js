const DEFAULT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbysbbhvPSA3iPtB_CPt7bFZSHiJW_CsjOks9wskHLwaae1mHc-lJMNA_4HOKJHJ8-BPvA/exec";

// Escudo vectorial institucional E.E.S.T. N°2 de San Fernando (Si subís logo.png en la carpeta, usa logo.png)
const ESCUDO_EEST2_SVG = "data:image/svg+xml;utf8," + encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 340">
    <path d="M40 25 L280 25 L292 50 C282 140 282 225 160 288 C38 225 38 140 28 50 Z" fill="#ffffff" stroke="#000000" stroke-width="11" stroke-linejoin="round"/>
    <g transform="translate(135,125)" fill="#cbd5e1" stroke="#000000" stroke-width="3">
      <circle r="54"/>
      <circle r="34" fill="#ffffff"/>
      <line x1="-34" y1="0" x2="34" y2="0" stroke-width="8"/>
      <line x1="0" y1="-34" x2="0" y2="34" stroke-width="8"/>
      <circle r="64" fill="none" stroke="#000000" stroke-width="12" stroke-dasharray="14 11"/>
    </g>
    <g stroke="#000000" stroke-width="10" fill="none" stroke-linecap="round">
      <line x1="168" y1="62" x2="95" y2="205"/>
      <line x1="142" y1="74" x2="182" y2="96"/>
      <path d="M62 155 C60 205 95 228 135 212" stroke-width="11"/>
      <polygon points="56,145 45,172 74,167" fill="#000000" stroke="none"/>
      <polygon points="145,212 118,202 126,229" fill="#000000" stroke="none"/>
    </g>
    <g transform="translate(235,135)">
      <path d="M0 95 Q5 20 -8 -65" stroke="#b45309" stroke-width="4" fill="none"/>
      <ellipse cx="-4" cy="-40" rx="6" ry="13" transform="rotate(-20 -4 -40)" fill="#f59e0b" stroke="#92400e" stroke-width="1.5"/>
      <ellipse cx="6" cy="-25" rx="6" ry="13" transform="rotate(20 6 -25)" fill="#f59e0b" stroke="#92400e" stroke-width="1.5"/>
      <ellipse cx="-2" cy="-10" rx="6" ry="13" transform="rotate(-20 -2 -10)" fill="#f59e0b" stroke="#92400e" stroke-width="1.5"/>
      <ellipse cx="7" cy="5" rx="6" ry="13" transform="rotate(20 7 5)" fill="#f59e0b" stroke="#92400e" stroke-width="1.5"/>
      <ellipse cx="-1" cy="20" rx="6" ry="13" transform="rotate(-20 -1 20)" fill="#f59e0b" stroke="#92400e" stroke-width="1.5"/>
      <ellipse cx="7" cy="35" rx="6" ry="13" transform="rotate(20 7 35)" fill="#f59e0b" stroke="#92400e" stroke-width="1.5"/>
    </g>
    <g transform="translate(135,180) rotate(-14)">
      <path d="M0 0 L48 -10 L48 45 L0 55 Z" fill="#f8fafc" stroke="#1e293b" stroke-width="3"/>
      <path d="M48 -10 L96 0 L96 55 L48 45 Z" fill="#f1f5f9" stroke="#1e293b" stroke-width="3"/>
    </g>
    <text x="160" y="314" font-family="Arial, sans-serif" font-size="18" font-weight="bold" text-anchor="middle" fill="#000">E.E.S.T. N°2 de San Fernando</text>
    <text x="160" y="335" font-family="Arial, sans-serif" font-size="15.5" font-weight="bold" text-anchor="middle" fill="#000">"Pbro. Dr. Manuel de San Ginés"</text>
  </svg>
`);

function cargarLogosEscudoEEST2() {
  document.querySelectorAll(".school-logo-eest2").forEach(img => {
    img.src = "logo.png";
    img.onerror = function() {
      this.onerror = null;
      this.src = ESCUDO_EEST2_SVG;
    };
  });
}

let scriptUrl = localStorage.getItem("eest2_script_url") || DEFAULT_SCRIPT_URL;
let primeraCargaApp = true;
let deferredPrompt = null;

let sesionAuth = {
  usuario: localStorage.getItem("eest2_auth_user") || "",
  clave: localStorage.getItem("eest2_auth_pass") || ""
};

let preferenciaAppWA = localStorage.getItem("eest2_tipo_app_wa") || "W4B";

const nativeFetch = window.fetch.bind(window);
window.fetch = async function(input, init) {
  let url = typeof input === "string" ? input : input.url;
  if (url && url.indexOf("script.google.com") !== -1) {
    if (!init || !init.method || init.method.toUpperCase() === "GET") {
      const sep = url.indexOf("?") !== -1 ? "&" : "?";
      url = `${url}${sep}usuario=${encodeURIComponent(sesionAuth.usuario)}&clave=${encodeURIComponent(sesionAuth.clave)}`;
      input = url;
    } else if (init && init.method && init.method.toUpperCase() === "POST" && init.body) {
      try {
        const parsed = JSON.parse(init.body);
        parsed.authUsuario = sesionAuth.usuario;
        parsed.authClave = sesionAuth.clave;
        init.body = JSON.stringify(parsed);
      } catch (e) {}
    }
  }
  return nativeFetch(input, init);
};

let estado = {
  cursoActual: "",
  cursos: [],
  cursosTotales: [],
  usuarioActual: null,
  usuariosSistema: [],
  materias: [],
  estudiantes: [],
  columnasInasistencias: null,
  historialAsistencias: [],
  horarioParte: null,
  notificacionesCurso: [],
  actasCurso: [],
  esCicloBasico: false
};

let asistenciaActual = {};
let materiasSinProfesorActual = [];
let filasEditorHorarioTemp = [];

let configInformeAlumno = {
  ambito: "TODO",
  filtroMaterias: "TODAS",
  soloCamposCargadosWA: true,
  telefonoPadre: "",
  fechasExtraTeo: "",
  fechasExtraTal: "",
  notaAdicional: ""
};

const MESES_LISTA = [
  "Marzo", "Abril", "Mayo", "Junio", "Julio",
  "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const DIAS_SEMANA_ORDEN = ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES"];

const SUB_CAMPOS = [
  { key: "val1", label: "1° Val. Prel.", shortLabel: "1°V", offset: 0, tipo: "val" },
  { key: "cal1", label: "Calif. 1°C", shortLabel: "1°C", offset: 1, tipo: "cal" },
  { key: "val2", label: "2° Val. Prel.", shortLabel: "2°V", offset: 2, tipo: "val" },
  { key: "cal2", label: "Calif. 2°C", shortLabel: "2°C", offset: 3, tipo: "cal" },
  { key: "int1", label: "Intensif.", shortLabel: "Int", offset: 4, tipo: "cal" },
  { key: "final", label: "Calif. Final", shortLabel: "Fin", offset: 5, tipo: "cal" }
];

window.addEventListener("DOMContentLoaded", () => {
  cargarLogosEscudoEEST2();
  if (typeof inicializarFechaHoy === "function") inicializarFechaHoy();

  const precGuardado = localStorage.getItem("eest2_preceptor") || "Venancio Marcelo";
  const inpPrec = document.getElementById("asistPreceptor");
  if (inpPrec) inpPrec.value = precGuardado;

  sincronizarSelectoresAppWA();

  const ultimoCurso = localStorage.getItem("eest2_ultimo_curso") || "";
  if (sesionAuth.usuario && sesionAuth.clave) {
    cargarDatosDesdeSheet(ultimoCurso, true);
  } else {
    setTimeout(() => {
      ocultarPantallaCargaInicial();
      mostrarPantallaLogin("");
    }, 650);
  }
});

function cambiarPreferenciaAppWA(nuevoTipo) {
  preferenciaAppWA = (nuevoTipo === "PERSONAL") ? "PERSONAL" : "W4B";
  localStorage.setItem("eest2_tipo_app_wa", preferenciaAppWA);
  sincronizarSelectoresAppWA();
}

function obtenerEtiquetaAppWA() {
  return preferenciaAppWA === "PERSONAL" ? "WhatsApp Personal" : "WhatsApp Business";
}

function sincronizarSelectoresAppWA() {
  const selAsist = document.getElementById("asistTipoAppWA");
  if (selAsist) selAsist.value = preferenciaAppWA;

  const selInf = document.getElementById("infTipoAppWA");
  if (selInf) selInf.value = preferenciaAppWA;

  const nombreApp = obtenerEtiquetaAppWA();
  const btnGuardar = document.getElementById("btnGuardarYEnviar");
  if (btnGuardar) btnGuardar.textContent = `💾 Guardar Asistencia y Abrir ${nombreApp}`;

  const btnSoloAbrir = document.getElementById("btnSoloAbrirWA");
  if (btnSoloAbrir) btnSoloAbrir.textContent = `📲 Solo Abrir ${nombreApp} (Sin volver a guardar)`;

  const btnEnvAlu = document.getElementById("btnEnviarWAAlumno");
  if (btnEnvAlu) btnEnvAlu.textContent = `📲 Enviar por ${nombreApp}`;
}

function ocultarPantallaCargaInicial() {
  const loader = document.getElementById("initialLoaderOverlay");
  if (loader) loader.classList.add("hidden-loader");
}

function mostrarPantallaLogin(msgError) {
  const banner = document.getElementById("loginErrorBanner");
  if (msgError) {
    banner.textContent = msgError;
    banner.style.display = "block";
  } else {
    banner.style.display = "none";
  }
  document.getElementById("authInputUser").value = sesionAuth.usuario || "";
  document.getElementById("loginOverlayScreen").classList.add("open");
}

async function iniciarSesionSistema() {
  const u = document.getElementById("authInputUser").value.trim();
  const c = document.getElementById("authInputPass").value.trim();
  const recordar = document.getElementById("authChkRemember").checked;

  if (!u || !c) {
    mostrarPantallaLogin("Ingresá tu usuario (o DNI del estudiante) y tu contraseña.");
    return;
  }

  const btn = document.getElementById("btnSubmitLogin");
  btn.disabled = true;
  btn.textContent = "⏳ Verificando credenciales...";

  sesionAuth.usuario = u;
  sesionAuth.clave = c;

  const ultimoCurso = localStorage.getItem("eest2_ultimo_curso") || "";
  const ok = await cargarDatosDesdeSheet(ultimoCurso, true);

  btn.disabled = false;
  btn.textContent = "🔐 Ingresar al Sistema";

  if (ok) {
    if (recordar) {
      localStorage.setItem("eest2_auth_user", u);
      localStorage.setItem("eest2_auth_pass", c);
    } else {
      localStorage.removeItem("eest2_auth_user");
      localStorage.removeItem("eest2_auth_pass");
    }
    document.getElementById("loginOverlayScreen").classList.remove("open");
  }
}

function cerrarSesionActual() {
  if (!confirm("¿Querés cerrar tu sesión actual?")) return;
  sesionAuth = { usuario: "", clave: "" };
  localStorage.removeItem("eest2_auth_user");
  localStorage.removeItem("eest2_auth_pass");
  document.getElementById("authInputPass").value = "";
  mostrarPantallaLogin("");
}

function esAdminODirectivoActual() {
  if (!estado.usuarioActual) return false;
  const r = String(estado.usuarioActual.rol || "").toUpperCase();
  return r === "ADMIN" || r === "DIRECTIVO";
}

function esRolFamiliaActual() {
  if (!estado.usuarioActual) return false;
  return String(estado.usuarioActual.rol || "").toUpperCase() === "FAMILIA";
}

function abrirModalGestionUsuarios() {
  limpiarFormularioGestionUsuario();
  renderizarTablaUsuariosSistema();
  document.getElementById("modalGestionUsuarios").classList.add("open");
}

function cerrarModalGestionUsuarios() {
  document.getElementById("modalGestionUsuarios").classList.remove("open");
}

function actualizarVisibilidadCursosPreceptor() {
  const rol = document.getElementById("usrFormRol").value;
  document.getElementById("usrFormCursosBox").style.display = (rol === "PRECEPTOR") ? "flex" : "none";
}

function renderizarCheckboxesCursosPreceptor(seleccionados) {
  const wrap = document.getElementById("usrFormCheckboxesCursos");
  if (!wrap) return;
  const selUpper = (seleccionados || []).map(x => String(x).trim().toUpperCase());
  const todos = (estado.cursosTotales && estado.cursosTotales.length > 0) ? estado.cursosTotales : (estado.cursos || []);

  let html = `
    <label style="display:inline-flex; align-items:center; gap:4px; font-weight:800; color:#1e3a8a; cursor:pointer;">
      <input type="checkbox" class="chk-usr-curso-item" value="TODOS" ${selUpper.includes("TODOS") ? "checked" : ""}> TODOS LOS CURSOS
    </label>
  `;
  todos.forEach(c => {
    html += `
      <label style="display:inline-flex; align-items:center; gap:4px; font-weight:700; cursor:pointer;">
        <input type="checkbox" class="chk-usr-curso-item" value="${c}" ${selUpper.includes(c.toUpperCase()) ? "checked" : ""}> ${c.replace(/_/g, " ")}
      </label>
    `;
  });
  wrap.innerHTML = html;
}

function limpiarFormularioGestionUsuario() {
  document.getElementById("usrFormLogin").value = "";
  document.getElementById("usrFormClave").value = "";
  document.getElementById("usrFormNombre").value = "";
  document.getElementById("usrFormRol").value = "PRECEPTOR";
  actualizarVisibilidadCursosPreceptor();
  renderizarCheckboxesCursosPreceptor(["TODOS"]);
}

function editarUsuarioEnFormulario(u) {
  document.getElementById("usrFormLogin").value = u.usuario;
  document.getElementById("usrFormClave").value = u.clave;
  document.getElementById("usrFormNombre").value = u.nombre;
  document.getElementById("usrFormRol").value = u.rol;
  actualizarVisibilidadCursosPreceptor();
  const listaCursos = String(u.cursosPermitidos || "TODOS").split(",").map(s => s.trim());
  renderizarCheckboxesCursosPreceptor(listaCursos);
}

function renderizarTablaUsuariosSistema() {
  const cont = document.getElementById("contenedorTablaUsuariosSistema");
  if (!cont) return;
  const lista = estado.usuariosSistema || [];
  if (lista.length === 0) {
    cont.innerHTML = `<p style="padding:10px; color:#64748b;">No hay usuarios cargados.</p>`;
    return;
  }

  let html = `<table class="app-table"><thead><tr><th>Usuario / DNI</th><th>Clave</th><th>Nombre</th><th>Rol</th><th>Cursos / Vínculo</th><th>Acciones</th></tr></thead><tbody>`;
  lista.forEach(u => {
    html += `
      <tr>
        <td><strong>${u.usuario}</strong></td>
        <td><code>${u.clave}</code></td>
        <td class="td-left">${u.nombre}</td>
        <td><span class="badge badge-grp">${u.rol}</span></td>
        <td>${u.cursosPermitidos}</td>
        <td>
          <button type="button" class="btn-outline" style="padding:3px 7px; font-size:11px;" onclick='editarUsuarioEnFormulario(${JSON.stringify(u)})'>✏️ Editar</button>
          <button type="button" class="btn-danger-outline" style="padding:3px 7px; font-size:11px;" onclick="eliminarUsuarioDesdePanel('${u.usuario}')">🗑️</button>
        </td>
      </tr>
    `;
  });
  html += `</tbody></table>`;
  cont.innerHTML = html;
}

async function guardarUsuarioDesdePanel() {
  const usuario = document.getElementById("usrFormLogin").value.trim();
  const clave = document.getElementById("usrFormClave").value.trim();
  const nombre = document.getElementById("usrFormNombre").value.trim();
  const rol = document.getElementById("usrFormRol").value;

  if (!usuario || !clave) {
    mostrarToast("⚠️ Completá el usuario y la clave");
    return;
  }

  const checks = Array.from(document.querySelectorAll(".chk-usr-curso-item:checked")).map(c => c.value);
  const cursosPermitidos = (rol !== "PRECEPTOR" || checks.includes("TODOS") || checks.length === 0)
    ? ["TODOS"]
    : checks;

  try {
    mostrarToast("⏳ Guardando usuario...");
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "guardarUsuario",
        datosUsuario: { usuario, clave, nombre, rol, cursosPermitidos, activo: true }
      })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);

    estado.usuariosSistema = json.usuarios || [];
    if (json.cursosTotales) estado.cursosTotales = json.cursosTotales;
    limpiarFormularioGestionUsuario();
    renderizarTablaUsuariosSistema();
    mostrarToast("✅ Usuario guardado");
  } catch (err) {
    mostrarToast("⚠️ Error: " + err.message, 4000);
  }
}

async function eliminarUsuarioDesdePanel(usuarioBorrar) {
  if (!confirm(`¿Seguro que querés eliminar el usuario "${usuarioBorrar}"?`)) return;
  try {
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "eliminarUsuario",
        usuarioEliminar: usuarioBorrar
      })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);

    estado.usuariosSistema = json.usuarios || [];
    renderizarTablaUsuariosSistema();
    mostrarToast("🗑️ Usuario eliminado");
  } catch (err) {
    mostrarToast("⚠️ Error: " + err.message, 4000);
  }
}

async function cambiarMiPropiaClavePrompt() {
  const nueva = prompt("Ingresá tu nueva contraseña o PIN (mínimo 3 caracteres):");
  if (!nueva || nueva.trim().length < 3) return;
  try {
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "cambiarMiClave",
        nuevaClave: nueva.trim()
      })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);

    sesionAuth.clave = nueva.trim();
    if (localStorage.getItem("eest2_auth_user")) {
      localStorage.setItem("eest2_auth_pass", nueva.trim());
    }
    mostrarToast("🔑 Contraseña actualizada con éxito");
  } catch (err) {
    mostrarToast("⚠️ Error: " + err.message, 4000);
  }
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById("btnInstalarPWA");
  if (btn) btn.style.display = "inline-flex";
});

function instalarPWA() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === "accepted") {
        document.getElementById("btnInstalarPWA").style.display = "none";
      }
      deferredPrompt = null;
    });
  } else {
    alert("Para instalar en iPhone/iPad: Tocá el botón de Compartir en Safari y seleccioná 'Agregar a la pantalla de inicio'. En Android, elegí 'Instalar aplicación' en el menú de Chrome.");
  }
}

function abrirModalSelectorCurso(directoACrear = false) {
  if (esRolFamiliaActual()) return;
  renderTarjetasCursosEnModal();
  mostrarFormularioNuevoCurso(directoACrear);
  document.getElementById("modalSelectorCurso").classList.add("open");
}

function cerrarModalSelectorCurso() {
  document.getElementById("modalSelectorCurso").classList.remove("open");
}

function mostrarFormularioNuevoCurso(mostrar) {
  document.getElementById("seccionSeleccionarCursoExistente").classList.toggle("hidden", mostrar);
  document.getElementById("seccionFormularioNuevoCurso").classList.toggle("hidden", !mostrar);
}

function renderTarjetasCursosEnModal() {
  const grid = document.getElementById("gridCursosDisponibles");
  if (!grid) return;
  const lista = estado.cursos || [];
  if (lista.length === 0) {
    grid.innerHTML = `<p style="color:#64748b; font-size:12px;">Aún no hay cursos cargados.</p>`;
    return;
  }

  const puedeBorrar = esAdminODirectivoActual();
  let html = "";
  lista.forEach(c => {
    const esActual = c === estado.cursoActual;
    const limpio = c.replace(/_/g, " ");
    html += `
      <div class="course-card-item ${esActual ? 'active-course' : ''}">
        <button type="button" class="course-card-btn" onclick="seleccionarCursoDesdeModal('${c}')">
          <strong>🏫 ${limpio}</strong>
          <small>${esActual ? 'Curso activo' : 'Tocar para abrir'}</small>
        </button>
        ${puedeBorrar ? `
        <button type="button" class="course-delete-btn" title="Eliminar curso ${limpio}" onclick="confirmarEliminarCurso('${c}')">
          🗑️
        </button>` : ''}
      </div>
    `;
  });
  grid.innerHTML = html;
}

async function seleccionarCursoDesdeModal(nombreCurso) {
  cerrarModalSelectorCurso();
  localStorage.setItem("eest2_ultimo_curso", nombreCurso);
  if (nombreCurso !== estado.cursoActual) {
    await cargarDatosDesdeSheet(nombreCurso, false);
  }
}

async function confirmarEliminarCurso(nombreCurso) {
  if ((estado.cursos || []).length <= 1) {
    mostrarToast("⚠️ No podés borrar el único curso existente.");
    return;
  }
  const limpio = nombreCurso.replace(/_/g, " ");
  const ok = confirm(`⚠️ ¿Seguro que querés ELIMINAR por completo el curso "${limpio}" de Google Sheets?\n\nSe borrará su hoja de calificaciones y su configuración de horarios.`);
  if (!ok) return;

  try {
    mostrarToast(`⏳ Eliminando curso ${limpio}...`);
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "eliminarCurso",
        nombreCurso: nombreCurso
      })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);

    localStorage.setItem("eest2_ultimo_curso", json.data.cursoActual);
    aplicarDatosRecibidos(json.data, false);
    mostrarToast(`🗑️ Curso "${limpio}" eliminado`);
  } catch (err) {
    mostrarToast("⚠️ Error al eliminar curso: " + err.message, 4000);
  }
}

async function ejecutarCreacionNuevoCurso() {
  const nombreRaw = document.getElementById("ncNombreCurso").value.trim();
  if (!nombreRaw) {
    mostrarToast("⚠️ Ingresá el nombre del curso (Ej: 1ro_8va)");
    return;
  }

  const preceptores = {
    tm: document.getElementById("ncPrecTM").value.trim() || "___________",
    tt: document.getElementById("ncPrecTT").value.trim() || "___________",
    tv: document.getElementById("ncPrecTV").value.trim() || "___________"
  };

  const matTexto = document.getElementById("ncListaMaterias").value.trim();
  const materias = matTexto ? matTexto.split(",").map(s => s.trim()).filter(Boolean) : [];

  const estTexto = document.getElementById("ncListaEstudiantes").value.trim();
  const mapaUnicos = new Map();
  if (estTexto) {
    estTexto.split(/\r?\n/).forEach(linea => {
      const limp = linea.trim();
      if (!limp) return;
      const partes = limp.split("|");
      const nombreAlu = (partes[0] || "").replace(/^\d+[\.\-\)]\s*/, "").trim().toUpperCase();
      const grupoAlu = (partes[1] || "Grupo 1").trim();
      if (nombreAlu) {
        const clave = typeof normalizarClaveNombreAlumno === "function"
          ? normalizarClaveNombreAlumno(nombreAlu)
          : nombreAlu;
        mapaUnicos.set(clave, {
          nombre: nombreAlu,
          grupo: grupoAlu,
          estado: "Activo"
        });
      }
    });
  }
  const estudiantesIniciales = Array.from(mapaUnicos.values()).map((item, idx) => ({
    orden: idx + 1,
    nombre: item.nombre,
    grupo: item.grupo,
    estado: item.estado
  }));

  const btn = document.getElementById("btnConfirmarCrearCurso");
  try {
    btn.disabled = true;
    btn.textContent = "⏳ Creando curso en Google Sheets...";

    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "crearCurso",
        nombreCurso: nombreRaw,
        materias: materias,
        preceptores: preceptores,
        estudiantesIniciales: estudiantesIniciales
      })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);

    localStorage.setItem("eest2_ultimo_curso", json.data.cursoActual);
    aplicarDatosRecibidos(json.data, false);
    cerrarModalSelectorCurso();
    mostrarToast(`✅ Curso ${json.data.cursoActual} creado con éxito`);
    abrirModalConfigHorario();
  } catch (err) {
    mostrarToast("⚠️ Error al crear curso: " + err.message, 4000);
  } finally {
    btn.disabled = false;
    btn.textContent = "🚀 Crear Curso y Pasar a Configurar Horario del Parte";
  }
}

function abrirModalConfigHorarioDesdeSelector() {
  cerrarModalSelectorCurso();
  abrirModalConfigHorario();
}

function abrirModalCargaMasivaAlumnos() {
  document.getElementById("lblCursoLoteAlumnos").textContent = (estado.cursoActual || "").replace(/_/g, " ");
  document.getElementById("loteTextoEstudiantes").value = "";
  document.getElementById("modalCargaMasivaAlumnos").classList.add("open");
}

function cerrarModalCargaMasivaAlumnos() {
  document.getElementById("modalCargaMasivaAlumnos").classList.remove("open");
}

async function ejecutarCargaMasivaAlumnos() {
  const texto = document.getElementById("loteTextoEstudiantes").value.trim();
  const grpDef = document.getElementById("loteGrupoDefault").value.trim() || "Grupo 1";
  if (!texto) {
    mostrarToast("⚠️ Pegá al menos un estudiante");
    return;
  }

  const normalizar = (typeof normalizarClaveNombreAlumno === "function")
    ? normalizarClaveNombreAlumno
    : (s => String(s || "").trim().toUpperCase());

  const lotePorClave = new Map();
  texto.split(/\r?\n/).forEach(linea => {
    const l = linea.trim();
    if (!l) return;
    const partes = l.split("|");
    const rawPrimero = (partes[0] || "").trim();
    const matchOrdenExplicito = rawPrimero.match(/^(\d+)[\.\-\)]\s*(.+)$/);
    const ordenExplicito = matchOrdenExplicito ? parseInt(matchOrdenExplicito[1], 10) : null;
    const nom = (matchOrdenExplicito ? matchOrdenExplicito[2] : rawPrimero)
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
    const grp = (partes[1] || grpDef).trim();

    if (nom) {
      const clave = normalizar(nom);
      if (clave) {
        lotePorClave.set(clave, {
          orden: ordenExplicito,
          nombre: nom,
          grupo: grp,
          estado: "Activo"
        });
      }
    }
  });

  if (lotePorClave.size === 0) {
    mostrarToast("⚠️ No se detectaron nombres válidos");
    return;
  }

  const mapaExistentes = new Map();
  (estado.estudiantes || []).forEach(est => {
    const c = normalizar(est.nombre);
    if (c && !mapaExistentes.has(c)) {
      mapaExistentes.set(c, est);
    }
  });

  const existentesAActualizar = [];
  const nuevosAAgregar = [];
  let siguienteOrden = (typeof obtenerSiguienteNumeroOrden === "function")
    ? obtenerSiguienteNumeroOrden()
    : ((estado.estudiantes || []).length + 1);

  lotePorClave.forEach((item, clave) => {
    const estExistente = mapaExistentes.get(clave);
    if (estExistente) {
      existentesAActualizar.push({
        estRef: estExistente,
        filaHoja: estExistente.filaHoja,
        orden: item.orden || estExistente.orden,
        nombre: item.nombre,
        grupo: item.grupo,
        estado: "Activo"
      });
    } else {
      nuevosAAgregar.push({
        orden: item.orden || siguienteOrden++,
        nombre: item.nombre,
        grupo: item.grupo,
        estado: "Activo"
      });
    }
  });

  try {
    mostrarToast("⏳ Procesando lote sin duplicar...");

    for (const itemUpd of existentesAActualizar) {
      if (String(itemUpd.estRef.orden) !== String(itemUpd.orden)) {
        await fetch(scriptUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            accion: "actualizarCelda",
            curso: estado.cursoActual,
            filaHoja: itemUpd.filaHoja,
            columnaHoja: 1,
            valor: itemUpd.orden
          })
        });
      }
      await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          accion: "actualizarCelda",
          curso: estado.cursoActual,
          filaHoja: itemUpd.filaHoja,
          columnaHoja: 2,
          valor: itemUpd.nombre
        })
      });
      await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          accion: "actualizarCelda",
          curso: estado.cursoActual,
          filaHoja: itemUpd.filaHoja,
          columnaHoja: 3,
          valor: itemUpd.grupo
        })
      });
      if (esEstudianteTachado(itemUpd.estRef)) {
        await fetch(scriptUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            accion: "actualizarCelda",
            curso: estado.cursoActual,
            filaHoja: itemUpd.filaHoja,
            columnaHoja: 4,
            valor: "Activo"
          })
        });
      }
      itemUpd.estRef.orden = itemUpd.orden;
      itemUpd.estRef.nombre = itemUpd.nombre;
      itemUpd.estRef.grupo = itemUpd.grupo;
      itemUpd.estRef.estado = "Activo";
    }

    if (nuevosAAgregar.length > 0) {
      const resp = await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          accion: "agregarEstudiantesLote",
          curso: estado.cursoActual,
          estudiantes: nuevosAAgregar
        })
      });
      const json = await resp.json();
      if (!json.ok) throw new Error(json.error);
      aplicarDatosRecibidos(json.data, false);
    } else {
      if (typeof ordenarEstudiantesPorNumero === "function") {
        ordenarEstudiantesPorNumero(estado.estudiantes);
      }
      aplicarDatosRecibidos(estado, true);
    }

    cerrarModalCargaMasivaAlumnos();
    mostrarToast(
      `✅ ${nuevosAAgregar.length} nuevos agregados | ${existentesAActualizar.length} existentes reescritos (sin duplicar)`,
      4000
    );
  } catch (err) {
    mostrarToast("⚠️ Error: " + err.message, 4000);
  }
}

function abrirModalConfigHorario() {
  const cursoLimpio = (estado.cursoActual || "Curso").replace(/_/g, " ");
  document.getElementById("lblCursoConfigHorario").textContent = cursoLimpio;

  const hp = estado.horarioParte || {};
  const prec = hp.preceptores || { tm: "___________", tt: "VENANCIO MARCELO", tv: "___________" };

  document.getElementById("cfgPrecTM").value = prec.tm || "___________";
  document.getElementById("cfgPrecTT").value = prec.tt || "___________";
  document.getElementById("cfgPrecTV").value = prec.tv || "___________";

  const bloquesActuales = (hp.bloques && hp.bloques.length > 0) ? hp.bloques : [];
  filasEditorHorarioTemp = bloquesActuales.map(b => ({
    dia: b.dia || "LUNES",
    horario: b.horario || "07:30 A 09:30",
    turno: b.turno || "TM - Teoría",
    grupo: b.grupo || "Teo",
    materia: b.materia || "",
    profesor: b.profesor || "",
    modalidad: b.modalidad || "TEORIA"
  }));

  renderFilasEditorHorario();
  document.getElementById("modalConfigHorario").classList.add("open");
}

function cerrarModalConfigHorario() {
  document.getElementById("modalConfigHorario").classList.remove("open");
}

function sincronizarInputsEditorHorario() {
  const filasDOM = document.querySelectorAll(".schedule-editor-row");
  filasDOM.forEach((rowEl, idx) => {
    if (!filasEditorHorarioTemp[idx]) return;
    filasEditorHorarioTemp[idx].dia = rowEl.querySelector(".ed-dia").value;
    filasEditorHorarioTemp[idx].horario = rowEl.querySelector(".ed-horario").value;
    filasEditorHorarioTemp[idx].turno = rowEl.querySelector(".ed-turno").value;
    filasEditorHorarioTemp[idx].grupo = rowEl.querySelector(".ed-grupo").value;
    filasEditorHorarioTemp[idx].materia = rowEl.querySelector(".ed-materia").value;
    filasEditorHorarioTemp[idx].profesor = rowEl.querySelector(".ed-profesor").value;
    filasEditorHorarioTemp[idx].modalidad = rowEl.querySelector(".ed-modalidad").value;
  });
}

function renderFilasEditorHorario() {
  const cont = document.getElementById("contenedorFilasEditorHorario");
  if (!cont) return;

  let html = "";
  filasEditorHorarioTemp.forEach((item, idx) => {
    html += `
      <div class="schedule-editor-row">
        <select class="ed-dia">
          ${DIAS_SEMANA_ORDEN.map(d => `<option value="${d}" ${item.dia === d ? 'selected' : ''}>${d}</option>`).join("")}
        </select>
        <input type="text" class="ed-horario" value="${item.horario || ''}">
        <select class="ed-turno">
          ${["TM - Teoría", "TT - Teoría", "TV - Teoría", "TM - Taller", "TT - Taller", "TT/TV - Taller", "TV - Taller", "Educación Física"]
            .map(t => `<option value="${t}" ${item.turno === t ? 'selected' : ''}>${t}</option>`).join("")}
        </select>
        <input type="text" class="ed-grupo" value="${item.grupo || ''}">
        <input type="text" class="ed-materia" value="${item.materia || ''}">
        <input type="text" class="ed-profesor" value="${item.profesor || ''}">
        <select class="ed-modalidad">
          <option value="TEORIA" ${item.modalidad !== "TALLER" ? "selected" : ""}>📘 Teoría</option>
          <option value="TALLER" ${item.modalidad === "TALLER" ? "selected" : ""}>🔧 Taller</option>
        </select>
        <button type="button" class="btn-danger-outline" style="padding:5px;" onclick="eliminarFilaEditorHorario(${idx})">🗑️</button>
      </div>
    `;
  });
  cont.innerHTML = html;
}

function agregarFilaEditorHorario(diaPorDefecto = "LUNES") {
  sincronizarInputsEditorHorario();
  filasEditorHorarioTemp.push({
    dia: diaPorDefecto,
    horario: "07:30 A 09:30",
    turno: "TM - Teoría",
    grupo: "Teo",
    materia: "",
    profesor: "",
    modalidad: "TEORIA"
  });
  renderFilasEditorHorario();
}

function eliminarFilaEditorHorario(idx) {
  sincronizarInputsEditorHorario();
  filasEditorHorarioTemp.splice(idx, 1);
  renderFilasEditorHorario();
}

async function guardarHorarioEnGoogleSheet() {
  sincronizarInputsEditorHorario();
  const bloquesLimpios = filasEditorHorarioTemp.filter(b => b.materia.trim() !== "" || b.horario.trim() !== "");
  const preceptores = {
    tm: document.getElementById("cfgPrecTM").value.trim() || "___________",
    tt: document.getElementById("cfgPrecTT").value.trim() || "___________",
    tv: document.getElementById("cfgPrecTV").value.trim() || "___________"
  };
  const sincronizarMat = document.getElementById("chkSincronizarMateriasPlanilla").checked;

  try {
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "guardarHorarioParte",
        curso: estado.cursoActual,
        preceptores: preceptores,
        bloques: bloquesLimpios,
        sincronizarMateriasPlanilla: sincronizarMat
      })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);

    aplicarDatosRecibidos(json.data, true);
    cerrarModalConfigHorario();
    mostrarVista("parte");
    mostrarToast("✅ Horario guardado en Google Sheets");
  } catch (err) {
    mostrarToast("⚠️ Error: " + err.message, 4000);
  }
}

function mostrarToast(msg, duracion = 2800) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.style.display = "block";
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.display = "none"; }, duracion);
}

function mostrarVista(nombre) {
  if (esRolFamiliaActual()) {
    nombre = "alumno";
  }
  ["asistencia", "parte", "materia", "alumno", "actas", "planilla"].forEach(v => {
    const sec = document.getElementById(`vista-${v}`);
    const btn = document.getElementById(`tabBtn-${v}`);
    if (sec) sec.classList.toggle("hidden", v !== nombre);
    if (btn) btn.classList.toggle("active", v === nombre);
  });
  if (nombre === "parte" && typeof pdRenderCurrentSelection === "function") {
    pdRenderCurrentSelection();
  }
  if (nombre === "actas" && typeof renderVistaActas === "function") {
    renderVistaActas();
  }
}

async function cargarDatosDesdeSheet(nombreCurso, mostrarSelectorInicial = false) {
  try {
    document.getElementById("statusSubtitle").textContent = "Sincronizando con Google Sheets...";
    const url = nombreCurso
      ? `${scriptUrl}?curso=${encodeURIComponent(nombreCurso)}&t=${Date.now()}`
      : `${scriptUrl}?t=${Date.now()}`;

    const resp = await fetch(url);
    const json = await resp.json();
    ocultarPantallaCargaInicial();

    if (!json.ok) {
      if (json.requiereLogin) {
        document.getElementById("statusSubtitle").textContent = "🔒 Sesión requerida";
        mostrarPantallaLogin(json.error || "Iniciá sesión para continuar.");
        return false;
      }
      throw new Error(json.error || "Error al leer datos");
    }

    aplicarDatosRecibidos(json.data, false);
    const esFam = esRolFamiliaActual();
    if (esFam) {
      const aluNombre = (estado.estudiantes && estado.estudiantes[0]) ? estado.estudiantes[0].nombre : "";
      document.getElementById("statusSubtitle").textContent = `Portal de Familias — Curso: ${estado.cursoActual.replace(/_/g, " ")} ${aluNombre ? '• ' + aluNombre : ''}`;
      primeraCargaApp = false;
    } else {
      const cantActivos = (estado.estudiantes || []).filter(e => !esEstudianteTachado(e)).length;
      document.getElementById("statusSubtitle").textContent = `Curso: ${estado.cursoActual.replace(/_/g, " ")} (${cantActivos} activos)`;
      if (mostrarSelectorInicial && primeraCargaApp) {
        primeraCargaApp = false;
        abrirModalSelectorCurso(false);
      }
    }
    return true;
  } catch (err) {
    ocultarPantallaCargaInicial();
    document.getElementById("statusSubtitle").textContent = "Error de conexión";
    mostrarToast("⚠️ Error: " + err.message, 4000);
    return false;
  }
}

function aplicarDatosRecibidos(data, preservarSeleccionPantalla = false) {
  const copiaAsistenciaPrevia = { ...asistenciaActual };
  const copiaSinProfPrevia = [...materiasSinProfesorActual];
  const alumnoSelPrevio = document.getElementById("alumnoSelect")?.value || "";
  const materiaSelPrevia = document.getElementById("materiaSelect")?.value || "";

  if (data && Array.isArray(data.estudiantes) && typeof ordenarEstudiantesPorNumero === "function") {
    ordenarEstudiantesPorNumero(data.estudiantes);
  }

  estado = data;

  if (estado.usuarioActual) {
    const pill = document.getElementById("userSessionPill");
    if (pill) {
      pill.style.display = "inline-flex";
      document.getElementById("lblActiveUserName").textContent = estado.usuarioActual.nombre;
      document.getElementById("lblActiveUserRole").textContent = estado.usuarioActual.rol;
    }
    if (estado.usuarioActual.nombre && !esRolFamiliaActual()) {
      document.getElementById("asistPreceptor").value = estado.usuarioActual.nombre;
    }
  }

  const esJefe = esAdminODirectivoActual();
  const esFam = esRolFamiliaActual();

  // Visibilidad de controles según rol (Personal vs Familia)
  document.querySelectorAll(".staff-only-ctrl").forEach(el => {
    el.style.display = esFam ? "none" : "";
  });
  const barStaff = document.getElementById("headerStaffControlsBar");
  if (barStaff) barStaff.style.display = esFam ? "none" : "flex";
  const navTabs = document.getElementById("mainNavTabs");
  if (navTabs) navTabs.style.display = esFam ? "none" : "grid";
  const boxSelAlu = document.getElementById("boxSelectorAlumnoStaff");
  if (boxSelAlu) boxSelAlu.style.display = esFam ? "none" : "flex";
  const lblTitAlu = document.getElementById("lblTituloVistaAlumno");
  if (lblTitAlu) {
    lblTitAlu.textContent = esFam
      ? "👨‍👩‍👧 Portal de Familias — Comunicados Oficiales, Asistencia (75% por Materia) y Calificaciones"
      : "👤 Ficha Académica, Gráficos de Asistencia (75% por Materia) y Notificaciones a Familias";
  }

  const btnUsrs = document.getElementById("btnAdminUsuarios");
  if (btnUsrs) btnUsrs.style.display = (!esFam && esJefe) ? "inline-flex" : "none";
  const btnNC1 = document.getElementById("btnHeaderNuevoCurso");
  if (btnNC1) btnNC1.style.display = (!esFam && esJefe) ? "inline-flex" : "none";
  const btnNC2 = document.getElementById("btnAbrirFormCrearCurso");
  if (btnNC2) btnNC2.style.display = (!esFam && esJefe) ? "inline-flex" : "none";

  const lblCursoPD = document.getElementById("pdCursoLabel");
  if (lblCursoPD) lblCursoPD.textContent = (data.cursoActual || "").replace(/_/g, " ");

  const selCurso = document.getElementById("cursoSelect");
  if (selCurso) {
    selCurso.innerHTML = "";
    (data.cursos || []).forEach(c => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c.replace(/_/g, " ");
      if (c === data.cursoActual) opt.selected = true;
      selCurso.appendChild(opt);
    });
  }

  if (typeof actualizarOpcionesTurnoGrupo === "function") actualizarOpcionesTurnoGrupo();

  if (preservarSeleccionPantalla && Object.keys(copiaAsistenciaPrevia).length > 0) {
    asistenciaActual = copiaAsistenciaPrevia;
    materiasSinProfesorActual = copiaSinProfPrevia;
  } else if (typeof cargarParteGuardadoSiExiste === "function") {
    cargarParteGuardadoSiExiste();
  }

  if (typeof poblarSelectorMateriasOrdenado === "function") poblarSelectorMateriasOrdenado(materiaSelPrevia);

  const selAlu = document.getElementById("alumnoSelect");
  if (selAlu) {
    selAlu.innerHTML = "";
    (data.estudiantes || []).forEach(e => {
      const opt = document.createElement("option");
      opt.value = e.filaHoja;
      const marcaTachado = esEstudianteTachado(e) ? " [🚫 TACHADO]" : "";
      opt.textContent = `${e.orden}. ${e.nombre} (${e.grupo})${marcaTachado}`;
      selAlu.appendChild(opt);
    });
    if ([...selAlu.options].some(o => o.value === String(alumnoSelPrevio))) {
      selAlu.value = alumnoSelPrevio;
    } else if (selAlu.options.length > 0) {
      selAlu.selectedIndex = 0;
    }
  }

  if (esFam) {
    mostrarVista("alumno");
    if (typeof renderVistaAlumno === "function") renderVistaAlumno();
    return;
  }

  if (typeof renderListaAsistencia === "function") renderListaAsistencia();
  if (typeof renderTablaAcumuladoInasistencias === "function") renderTablaAcumuladoInasistencias();
  if (typeof renderHistorialAsistencias === "function") renderHistorialAsistencias();
  if (typeof renderVistaMateria === "function") renderVistaMateria();
  if (typeof renderVistaAlumno === "function") renderVistaAlumno();
  if (typeof renderVistaActas === "function") renderVistaActas();
  if (typeof renderTablaCompleta === "function") renderTablaCompleta();
  if (typeof pdRenderCurrentSelection === "function") pdRenderCurrentSelection();
  renderTarjetasCursosEnModal();
  sincronizarSelectoresAppWA();
}

function cambiarCurso(nuevoCurso) {
  if (esRolFamiliaActual()) return;
  if (nuevoCurso) {
    localStorage.setItem("eest2_ultimo_curso", nuevoCurso);
    cargarDatosDesdeSheet(nuevoCurso, false);
  }
}

function recargarCursoActual() {
  cargarDatosDesdeSheet(estado.cursoActual, false);
}

function configurarUrlManual() {
  if (esRolFamiliaActual()) return;
  const nueva = prompt("URL del WebApp (/exec):", scriptUrl);
  if (nueva && nueva.trim()) {
    scriptUrl = nueva.trim();
    localStorage.setItem("eest2_script_url", scriptUrl);
    cargarDatosDesdeSheet("", false);
  }
}