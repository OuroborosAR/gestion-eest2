const DEFAULT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbysbbhvPSA3iPtB_CPt7bFZSHiJW_CsjOks9wskHLwaae1mHc-lJMNA_4HOKJHJ8-BPvA/exec";

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

// Limpiar cualquier contraseña guardada de versiones anteriores
localStorage.removeItem("eest2_auth_pass");

function escHtml(str) {
  return String(str === undefined || str === null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let sesionAuth = {
  usuario: localStorage.getItem("eest2_auth_user") || sessionStorage.getItem("eest2_auth_user") || "",
  token: sessionStorage.getItem("eest2_auth_token") || localStorage.getItem("eest2_auth_token") || ""
};

let preferenciaAppWA = localStorage.getItem("eest2_tipo_app_wa") || "W4B";
let cicloSeleccionado = localStorage.getItem("eest2_ultimo_ciclo") || "";

const nativeFetch = window.fetch.bind(window);
window.fetch = async function(input, init) {
  const url = typeof input === "string" ? input : input.url;
  if (url && url.indexOf("script.google.com") !== -1) {
    if (init && init.method && init.method.toUpperCase() === "POST" && init.body) {
      try {
        const parsed = JSON.parse(init.body);
        if (parsed.accion !== "login") {
          parsed.authToken = sesionAuth.token;
        }
        if (!parsed.ciclo && cicloSeleccionado) parsed.ciclo = cicloSeleccionado;
        init.body = JSON.stringify(parsed);
      } catch (e) {}
    }
  }
  return nativeFetch(input, init);
};

let estado = {
  cicloActual: "",
  estadoCicloActual: "ACTIVO",
  ciclosLectivos: [],
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
  pendientesCurso: [],
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
  { key: "int1", label: "Intensif. 1°C", shortLabel: "Int1", offset: 4, tipo: "cal" },
  { key: "intDic", label: "Intensif. Dic.", shortLabel: "Dic", offset: 5, tipo: "cal" },
  { key: "intFeb", label: "Intensif. Feb.", shortLabel: "Feb", offset: 6, tipo: "cal" },
  { key: "final", label: "Calif. Final", shortLabel: "Fin", offset: 7, tipo: "cal" }
];

window.addEventListener("DOMContentLoaded", () => {
  cargarLogosEscudoEEST2();
  if (typeof inicializarFechaHoy === "function") inicializarFechaHoy();

  const precGuardado = localStorage.getItem("eest2_preceptor") || "Venancio Marcelo";
  const inpPrec = document.getElementById("asistPreceptor");
  if (inpPrec) inpPrec.value = precGuardado;

  sincronizarSelectoresAppWA();

  const ultimoCurso = localStorage.getItem("eest2_ultimo_curso") || "";
  if (sesionAuth.token) {
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
  const btnGuardar = document.getElementById("btnSoloGuardarAsistencia");
  if (btnGuardar && !btnGuardar.disabled) btnGuardar.textContent = "💾 Guardar Asistencia";

  const btnSoloAbrir = document.getElementById("btnSoloAbrirWA");
  if (btnSoloAbrir) btnSoloAbrir.textContent = `💬 Enviar texto por ${nombreApp}`;

  const btnEnvAlu = document.getElementById("btnEnviarWAAlumno");
  if (btnEnvAlu) btnEnvAlu.textContent = `💬 Enviar texto por ${nombreApp}`;
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
  btn.textContent = "Verificando...";

  try {
    const ultimoCurso = localStorage.getItem("eest2_ultimo_curso") || "";
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "login",
        authUsuario: u,
        authClave: c,
        curso: ultimoCurso,
        ciclo: cicloSeleccionado || ""
      })
    });
    const json = await resp.json();
    if (!json.ok || !json.token) {
      throw new Error(json.error || "Usuario o contraseña incorrectos.");
    }

    sesionAuth.usuario = u;
    sesionAuth.token = json.token;
    sessionStorage.setItem("eest2_auth_user", u);
    sessionStorage.setItem("eest2_auth_token", json.token);

    if (recordar) {
      localStorage.setItem("eest2_auth_user", u);
      localStorage.setItem("eest2_auth_token", json.token);
    } else {
      localStorage.removeItem("eest2_auth_user");
      localStorage.removeItem("eest2_auth_token");
    }

    document.getElementById("authInputPass").value = "";
    document.getElementById("loginOverlayScreen").classList.remove("open");

    aplicarDatosRecibidos(json.data, false);
    actualizarSubtituloHeader();

    if (json.debeCambiarClave) {
      abrirModalCambioClaveObligatorio();
    } else if (!esRolFamiliaActual() && primeraCargaApp) {
      primeraCargaApp = false;
      abrirModalSelectorCurso(false);
    }
  } catch (err) {
    mostrarPantallaLogin(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Ingresar";
  }
}

async function cerrarSesionActual() {
  if (!confirm("¿Querés cerrar tu sesión actual?")) return;
  const tokenSalir = sesionAuth.token;
  sesionAuth = { usuario: "", token: "" };
  localStorage.removeItem("eest2_auth_user");
  localStorage.removeItem("eest2_auth_token");
  localStorage.removeItem("eest2_auth_pass");
  sessionStorage.removeItem("eest2_auth_user");
  sessionStorage.removeItem("eest2_auth_token");
  document.getElementById("authInputPass").value = "";

  if (tokenSalir) {
    try {
      await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ accion: "logout", authToken: tokenSalir })
      });
    } catch (e) {}
  }
  mostrarPantallaLogin("");
}

function abrirModalCambioClaveObligatorio() {
  const modal = document.getElementById("modalCambioClaveObligatorio");
  if (!modal) return;
  document.getElementById("inpClaveOblig1").value = "";
  document.getElementById("inpClaveOblig2").value = "";
  const errBox = document.getElementById("errClaveOblig");
  if (errBox) errBox.style.display = "none";
  modal.classList.add("open");
}

async function confirmarCambioClaveObligatorio() {
  const c1 = document.getElementById("inpClaveOblig1").value.trim();
  const c2 = document.getElementById("inpClaveOblig2").value.trim();
  const errBox = document.getElementById("errClaveOblig");

  const mostrarErr = (msg) => {
    if (errBox) { errBox.textContent = msg; errBox.style.display = "block"; }
  };

  if (c1.length < 6) return mostrarErr("La nueva contraseña debe tener al menos 6 caracteres.");
  if (c1 !== c2) return mostrarErr("Las contraseñas no coinciden.");

  const btn = document.getElementById("btnGuardarClaveOblig");
  try {
    if (btn) { btn.disabled = true; btn.textContent = "Guardando..."; }
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ accion: "cambiarMiClave", nuevaClave: c1 })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);

    document.getElementById("modalCambioClaveObligatorio").classList.remove("open");
    mostrarToast("Contraseña actualizada");
  } catch (err) {
    mostrarErr(err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Guardar nueva contraseña"; }
  }
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
  cargarAuditoriaSeguridadUI();
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
  document.getElementById("usrFormClave").value = "";
  document.getElementById("usrFormClave").placeholder = "Dejar vacío para mantener clave actual";
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

  let html = `<table class="app-table"><thead><tr><th>Usuario / DNI</th><th>Seguridad</th><th>Nombre</th><th>Rol</th><th>Cursos / Vínculo</th><th>Acciones</th></tr></thead><tbody>`;
  lista.forEach(u => {
    const estadoClave = u.claveEncriptada
      ? `<span class="badge badge-ok">Encriptada</span>`
      : `<span class="badge badge-warn">Pendiente</span>`;
    html += `
      <tr>
        <td><strong>${escHtml(u.usuario)}</strong></td>
        <td>${estadoClave}</td>
        <td class="td-left">${escHtml(u.nombre)}</td>
        <td><span class="badge badge-grp">${escHtml(u.rol)}</span></td>
        <td>${escHtml(u.cursosPermitidos)}</td>
        <td>
          <button type="button" class="btn-outline" style="padding:3px 7px; font-size:11px;" onclick='editarUsuarioEnFormulario(${JSON.stringify(u)})'>Editar</button>
          <button type="button" class="btn-danger-outline" style="padding:3px 7px; font-size:11px;" onclick="eliminarUsuarioDesdePanel('${escHtml(u.usuario)}')">🗑️</button>
        </td>
      </tr>
    `;
  });
  html += `</tbody></table>`;
  cont.innerHTML = html;
}

async function migrarClavesPendientesUI() {
  try {
    mostrarToast("Encriptando claves pendientes...");
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ accion: "migrarClavesHash" })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);
    estado.usuariosSistema = json.usuarios || [];
    renderizarTablaUsuariosSistema();
    cargarAuditoriaSeguridadUI();
    mostrarToast(`Listo: ${json.encriptadas} clave(s) encriptadas con SHA-256`);
  } catch (err) {
    mostrarToast("Error: " + err.message, 4000);
  }
}

async function cargarAuditoriaSeguridadUI() {
  const cont = document.getElementById("contenedorTablaAuditoria");
  if (!cont) return;
  cont.innerHTML = `<p style="padding:8px; color:#64748b; font-size:12px;">Cargando registro...</p>`;
  try {
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ accion: "obtenerAuditoria" })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);
    const lista = json.auditoria || [];
    if (lista.length === 0) {
      cont.innerHTML = `<p style="padding:8px; color:#64748b; font-size:12px;">Sin eventos registrados aún.</p>`;
      return;
    }
    let html = `<table class="app-table"><thead><tr><th>Fecha / Hora</th><th>Usuario</th><th>Rol</th><th>Acción</th><th>Curso</th><th>Detalle</th></tr></thead><tbody>`;
    lista.forEach(item => {
      const clAcc = item.accion.indexOf("FALLIDO") !== -1 || item.accion.indexOf("BLOQUEADO") !== -1
        ? "badge-danger"
        : (item.accion.indexOf("LOGIN") !== -1 ? "badge-ok" : "badge-grp");
      html += `
        <tr>
          <td style="white-space:nowrap; font-size:11px;">${escHtml(item.fechaHora)}</td>
          <td><strong>${escHtml(item.usuario)}</strong></td>
          <td>${escHtml(item.rol)}</td>
          <td><span class="badge ${clAcc}">${escHtml(item.accion)}</span></td>
          <td>${escHtml(item.curso || "-")}</td>
          <td class="td-left" style="font-size:11px;">${escHtml(item.detalle)}</td>
        </tr>
      `;
    });
    html += `</tbody></table>`;
    cont.innerHTML = html;
  } catch (err) {
    cont.innerHTML = `<p style="padding:8px; color:#b91c1c; font-size:12px;">Error: ${escHtml(err.message)}</p>`;
  }
}

async function guardarUsuarioDesdePanel() {
  const usuario = document.getElementById("usrFormLogin").value.trim();
  const clave = document.getElementById("usrFormClave").value.trim();
  const nombre = document.getElementById("usrFormNombre").value.trim();
  const rol = document.getElementById("usrFormRol").value;

  const existeYa = (estado.usuariosSistema || []).some(u => u.usuario.toLowerCase() === usuario.toLowerCase());
  if (!usuario) {
    mostrarToast("Completá el nombre de usuario");
    return;
  }
  if (!existeYa && !clave) {
    mostrarToast("Asigná una contraseña inicial al nuevo usuario");
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
  const nueva = prompt("Ingresá tu nueva contraseña (mínimo 6 caracteres):");
  if (!nueva) return;
  if (nueva.trim().length < 6) {
    mostrarToast("La contraseña debe tener al menos 6 caracteres");
    return;
  }
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

    mostrarToast("Contraseña actualizada");
  } catch (err) {
    mostrarToast("Error: " + err.message, 4000);
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
    btn.textContent = "Crear curso y configurar horario";
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
        <select class="ed-turno" onchange="alCambiarTurnoEditorHorario(${idx}, this.value)">
          ${["TM - Teoría", "TT - Teoría", "TV - Teoría", "TM - Taller", "TT - Taller", "TT/TV - Taller", "TV - Taller", "Educación Física"]
            .map(t => `<option value="${t}" ${item.turno === t ? 'selected' : ''}>${t}</option>`).join("")}
        </select>
        <input type="text" class="ed-grupo" value="${item.grupo || ''}">
        <input type="text" class="ed-materia" value="${item.materia || ''}">
        <input type="text" class="ed-profesor" value="${item.profesor || ''}">
        <select class="ed-modalidad">
          <option value="TEORIA" ${(item.modalidad !== "TALLER" && item.modalidad !== "ED_FISICA") ? "selected" : ""}>📘 Teoría</option>
          <option value="TALLER" ${item.modalidad === "TALLER" ? "selected" : ""}>🔧 Taller</option>
          <option value="ED_FISICA" ${item.modalidad === "ED_FISICA" ? "selected" : ""}>🏃 Ed. Física (No imprime)</option>
        </select>
        <button type="button" class="btn-danger-outline" style="padding:5px;" onclick="eliminarFilaEditorHorario(${idx})">🗑️</button>
      </div>
    `;
  });
  cont.innerHTML = html;
}

function alCambiarTurnoEditorHorario(idx, nuevoTurno) {
  sincronizarInputsEditorHorario();
  const item = filasEditorHorarioTemp[idx];
  if (!item) return;
  item.turno = nuevoTurno;
  const up = String(nuevoTurno || "").toUpperCase();
  if (up.indexOf("FÍSICA") !== -1 || up.indexOf("FISICA") !== -1) {
    item.modalidad = "ED_FISICA";
    if (!item.materia) item.materia = "EDUCACIÓN FÍSICA";
    if (!item.grupo || item.grupo === "Teo") item.grupo = "Curso";
  } else if (up.indexOf("TALLER") !== -1) {
    item.modalidad = "TALLER";
  } else {
    item.modalidad = "TEORIA";
  }
  renderFilasEditorHorario();
}

function agregarFilaEditorHorario(diaPorDefecto = "LUNES", tipoRapido = "TEORIA") {
  sincronizarInputsEditorHorario();
  if (tipoRapido === "ED_FISICA") {
    filasEditorHorarioTemp.push({
      dia: diaPorDefecto,
      horario: "08:00 A 09:00",
      turno: "Educación Física",
      grupo: "Curso",
      materia: "EDUCACIÓN FÍSICA",
      profesor: "",
      modalidad: "ED_FISICA"
    });
  } else {
    filasEditorHorarioTemp.push({
      dia: diaPorDefecto,
      horario: "07:30 A 09:30",
      turno: "TM - Teoría",
      grupo: "Teo",
      materia: "",
      profesor: "",
      modalidad: "TEORIA"
    });
  }
  renderFilasEditorHorario();
}

function abrirModalGrillaHorario() {
  const modal = document.getElementById("modalGrillaHorario");
  if (!modal) return;
  const cursoLimpio = (estado.cursoActual || "Curso").replace(/_/g, " ");
  const lbl = document.getElementById("lblCursoGrillaHorario");
  if (lbl) lbl.textContent = cursoLimpio;
  renderGrillaHorarioVisual();
  modal.classList.add("open");
}

function cerrarModalGrillaHorario() {
  const modal = document.getElementById("modalGrillaHorario");
  if (modal) modal.classList.remove("open");
}

function obtenerHoraOrdenMinutos(horarioStr) {
  const m = String(horarioStr || "").match(/(\d{1,2})[:.](\d{2})/);
  if (!m) return 9999;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function renderGrillaHorarioVisual() {
  const cont = document.getElementById("contenedorGrillaHorarioVisual");
  if (!cont) return;
  const bloques = (estado.horarioParte && estado.horarioParte.bloques) || [];
  if (bloques.length === 0) {
    cont.innerHTML = `<p style="padding:14px; color:#64748b; text-align:center;">Aún no hay horarios cargados para este curso. Tocá "Editar Horarios" para agregar materias.</p>`;
    return;
  }

  let html = `<div class="schedule-grid-board">`;
  DIAS_SEMANA_ORDEN.forEach(dia => {
    const delDia = bloques
      .filter(b => String(b.dia || "").trim().toUpperCase() === dia)
      .sort((a, b) => obtenerHoraOrdenMinutos(a.horario) - obtenerHoraOrdenMinutos(b.horario));

    html += `
      <div class="sg-day-col">
        <div class="sg-day-hdr">${dia}</div>
        <div class="sg-day-body">
    `;

    if (delDia.length === 0) {
      html += `<div class="sg-empty">Sin clases</div>`;
    } else {
      delDia.forEach(b => {
        const mod = String(b.modalidad || "").toUpperCase();
        const turUp = String(b.turno || "").toUpperCase();
        const esEF = mod === "ED_FISICA" || turUp.indexOf("FÍSICA") !== -1 || turUp.indexOf("FISICA") !== -1;
        const esTal = !esEF && (mod === "TALLER" || Boolean(b.esTaller));
        const clCard = esEF ? "sg-card-ef" : (esTal ? "sg-card-taller" : "sg-card-teoria");
        const tagTipo = esEF ? "🏃 Ed. Física" : (esTal ? "🔧 Taller" : "📘 Teoría");

        html += `
          <div class="sg-card ${clCard}">
            <div class="sg-card-top">
              <span class="sg-time">${escHtml(b.horario || "—")}</span>
              <span class="sg-grp">${escHtml(b.grupo || (esTal ? "Taller" : "Curso"))}</span>
            </div>
            <div class="sg-mat">${escHtml(b.materia || "Sin materia")}</div>
            <div class="sg-prof">${escHtml(b.profesor || "Sin docente")}</div>
            <div class="sg-foot">${tagTipo} • ${escHtml(b.turno || "")}</div>
          </div>
        `;
      });
    }

    html += `</div></div>`;
  });
  html += `</div>`;
  cont.innerHTML = html;
}

async function exportarGrillaHorarioImagen() {
  const bloques = (estado.horarioParte && estado.horarioParte.bloques) || [];
  if (bloques.length === 0) return mostrarToast("No hay horarios cargados para exportar");
  const cursoLimpio = (estado.cursoActual || "Curso").replace(/_/g, " ");

  try {
    mostrarToast("⏳ Generando imagen del horario...", 3000);
    const W = 1120;
    const PAD = 18;
    const CW = W - PAD * 2;
    const GAP = 10;
    const COL_W = (CW - GAP * 4) / 5;
    const CARD_H = 74;
    const CARD_GAP = 8;
    const SCALE = 2;

    const porDia = DIAS_SEMANA_ORDEN.map(dia =>
      bloques
        .filter(b => String(b.dia || "").trim().toUpperCase() === dia)
        .sort((a, b) => obtenerHoraOrdenMinutos(a.horario) - obtenerHoraOrdenMinutos(b.horario))
    );
    const maxFilas = Math.max(1, ...porDia.map(arr => arr.length));
    const H = PAD + 52 + 12 + 30 + maxFilas * (CARD_H + CARD_GAP) + 28 + PAD;

    const canvas = document.createElement("canvas");
    canvas.width = W * SCALE;
    canvas.height = H * SCALE;
    const ctx = canvas.getContext("2d");
    ctx.scale(SCALE, SCALE);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // Header
    ctx.fillStyle = "#1e3a8a";
    ctx.fillRect(PAD, PAD, CW, 48);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px Arial, sans-serif";
    ctx.fillText(`HORARIO SEMANAL — CURSO: ${cursoLimpio.toUpperCase()}`, PAD + 14, PAD + 22);
    ctx.fillStyle = "#bfdbfe";
    ctx.font = "bold 11.5px Arial, sans-serif";
    ctx.fillText('E.E.S.T. N° 2 "Pbro. Dr. Manuel de San Ginés" — San Fernando', PAD + 14, PAD + 39);

    ctx.textAlign = "right";
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 11px Arial, sans-serif";
    ctx.fillText("📘 Teoría   |   🔧 Taller   |   🏃 Ed. Física", PAD + CW - 14, PAD + 30);
    ctx.textAlign = "left";

    const topGrid = PAD + 60;

    DIAS_SEMANA_ORDEN.forEach((dia, dIdx) => {
      const x = PAD + dIdx * (COL_W + GAP);
      // Day header
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(x, topGrid, COL_W, 26);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 12px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(dia, x + COL_W / 2, topGrid + 17);
      ctx.textAlign = "left";

      const items = porDia[dIdx];
      if (items.length === 0) {
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(x, topGrid + 32, COL_W, 44);
        ctx.strokeStyle = "#cbd5e1";
        ctx.strokeRect(x, topGrid + 32, COL_W, 44);
        ctx.fillStyle = "#94a3b8";
        ctx.font = "italic 11px Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Sin clases", x + COL_W / 2, topGrid + 58);
        ctx.textAlign = "left";
      } else {
        items.forEach((b, bIdx) => {
          const cy = topGrid + 32 + bIdx * (CARD_H + CARD_GAP);
          const mod = String(b.modalidad || "").toUpperCase();
          const turUp = String(b.turno || "").toUpperCase();
          const esEF = mod === "ED_FISICA" || turUp.indexOf("FÍSICA") !== -1 || turUp.indexOf("FISICA") !== -1;
          const esTal = !esEF && (mod === "TALLER" || Boolean(b.esTaller));

          const bg = esEF ? "#ecfdf5" : (esTal ? "#eff6ff" : "#f8fafc");
          const brd = esEF ? "#34d399" : (esTal ? "#60a5fa" : "#cbd5e1");
          const acc = esEF ? "#065f46" : (esTal ? "#1d4ed8" : "#0f172a");

          ctx.fillStyle = bg;
          ctx.fillRect(x, cy, COL_W, CARD_H);
          ctx.strokeStyle = brd;
          ctx.lineWidth = 1.4;
          ctx.strokeRect(x, cy, COL_W, CARD_H);

          // Left accent bar
          ctx.fillStyle = acc;
          ctx.fillRect(x, cy, 4, CARD_H);

          ctx.fillStyle = acc;
          ctx.font = "bold 10.5px Arial, sans-serif";
          ctx.fillText(truncarTextoCanvas(ctx, b.horario || "—", COL_W - 70), x + 9, cy + 16);

          ctx.textAlign = "right";
          ctx.fillStyle = "#475569";
          ctx.font = "bold 10px Arial, sans-serif";
          ctx.fillText(truncarTextoCanvas(ctx, b.grupo || "", 58), x + COL_W - 7, cy + 16);
          ctx.textAlign = "left";

          ctx.fillStyle = "#0f172a";
          ctx.font = "bold 12px Arial, sans-serif";
          ctx.fillText(truncarTextoCanvas(ctx, b.materia || "", COL_W - 16), x + 9, cy + 35);

          ctx.fillStyle = "#334155";
          ctx.font = "11px Arial, sans-serif";
          ctx.fillText(truncarTextoCanvas(ctx, b.profesor || "Sin docente", COL_W - 16), x + 9, cy + 51);

          ctx.fillStyle = "#64748b";
          ctx.font = "bold 9.5px Arial, sans-serif";
          ctx.fillText(truncarTextoCanvas(ctx, b.turno || "", COL_W - 16), x + 9, cy + 66);
        });
      }
    });

    const blob = await canvasABlobPNG(canvas);
    const slug = (estado.cursoActual || "curso").replace(/\s+/g, "_");
    await compartirODescargarImagenPNG(blob, `Horario_${slug}.png`, `Horario ${cursoLimpio}`, `Horario Semanal — ${cursoLimpio}`);
  } catch (err) {
    mostrarToast("⚠️ Error al exportar horario: " + err.message, 4000);
  }
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

function actualizarSubtituloHeader() {
  const esFam = esRolFamiliaActual();
  if (esFam) {
    const aluNombre = (estado.estudiantes && estado.estudiantes[0]) ? estado.estudiantes[0].nombre : "";
    document.getElementById("statusSubtitle").textContent = `Portal de Familias — Curso: ${estado.cursoActual.replace(/_/g, " ")} ${aluNombre ? "• " + aluNombre : ""}`;
    primeraCargaApp = false;
  } else {
    const cantActivos = (estado.estudiantes || []).filter(e => !esEstudianteTachado(e)).length;
    const tagCiclo = estado.cicloActual ? `Ciclo ${estado.cicloActual} • ` : "";
    document.getElementById("statusSubtitle").textContent = `${tagCiclo}Curso: ${estado.cursoActual.replace(/_/g, " ")} (${cantActivos} activos)`;
  }
}

async function cargarDatosDesdeSheet(nombreCurso, mostrarSelectorInicial = false) {
  try {
    document.getElementById("statusSubtitle").textContent = "Sincronizando con Google Sheets...";
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "obtenerDatos",
        curso: nombreCurso || "",
        ciclo: cicloSeleccionado || ""
      })
    });
    const json = await resp.json();
    ocultarPantallaCargaInicial();

    if (!json.ok) {
      if (json.debeCambiarClave) {
        abrirModalCambioClaveObligatorio();
        return false;
      }
      if (json.requiereLogin) {
        sesionAuth.token = "";
        localStorage.removeItem("eest2_auth_token");
        sessionStorage.removeItem("eest2_auth_token");
        document.getElementById("statusSubtitle").textContent = "Sesión requerida";
        mostrarPantallaLogin(json.error || "Iniciá sesión para continuar.");
        return false;
      }
      throw new Error(json.error || "Error al leer datos");
    }

    aplicarDatosRecibidos(json.data, false);
    actualizarSubtituloHeader();
    if (!esRolFamiliaActual() && mostrarSelectorInicial && primeraCargaApp) {
      primeraCargaApp = false;
      abrirModalSelectorCurso(false);
    }
    return true;
  } catch (err) {
    ocultarPantallaCargaInicial();
    document.getElementById("statusSubtitle").textContent = "Error de conexión";
    mostrarToast("Error: " + err.message, 4000);
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
      ? "Portal de Familias"
      : "Legajo del Estudiante";
  }

  if (data.cicloActual) {
    cicloSeleccionado = String(data.cicloActual);
    localStorage.setItem("eest2_ultimo_ciclo", cicloSeleccionado);
  }

  const selCiclo = document.getElementById("cicloSelect");
  if (selCiclo) {
    selCiclo.innerHTML = "";
    (data.ciclosLectivos || []).forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.ciclo;
      const tagEst = c.estado === "CERRADO" ? " [Cerrado]" : (c.estado === "PREPARACION" ? " [En preparación]" : "");
      opt.textContent = `${c.etiqueta}${tagEst}`;
      if (String(c.ciclo) === String(data.cicloActual)) opt.selected = true;
      selCiclo.appendChild(opt);
    });
  }

  const btnUsrs = document.getElementById("btnAdminUsuarios");
  if (btnUsrs) btnUsrs.style.display = (!esFam && esJefe) ? "inline-flex" : "none";
  const btnCiclos = document.getElementById("btnAdminCiclos");
  if (btnCiclos) btnCiclos.style.display = (!esFam && esJefe) ? "inline-flex" : "none";
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

let previaPaseActual = null;

function cambiarCicloLectivo(nuevoCiclo) {
  if (esRolFamiliaActual() || !nuevoCiclo) return;
  cicloSeleccionado = String(nuevoCiclo);
  localStorage.setItem("eest2_ultimo_ciclo", cicloSeleccionado);
  cargarDatosDesdeSheet("", false);
}

function abrirModalCiclosLectivos() {
  if (!esAdminODirectivoActual()) return;
  previaPaseActual = null;
  renderTablaCiclosModal();
  poblarSelectoresPaseModal();
  const contPrev = document.getElementById("contenedorPreviaPaseDeAnio");
  if (contPrev) contPrev.innerHTML = "";
  const btnEjec = document.getElementById("btnConfirmarPaseDeAnio");
  if (btnEjec) btnEjec.style.display = "none";

  const ciclos = estado.ciclosLectivos || [];
  const maxAnio = ciclos.reduce((m, c) => Math.max(m, parseInt(c.ciclo, 10) || 0), new Date().getFullYear());
  const inpAnio = document.getElementById("inpNuevoCicloAnio");
  if (inpAnio) inpAnio.value = String(maxAnio + 1);

  document.getElementById("modalCiclosLectivos").classList.add("open");
}

function cerrarModalCiclosLectivos() {
  document.getElementById("modalCiclosLectivos").classList.remove("open");
}

function renderTablaCiclosModal() {
  const cont = document.getElementById("contenedorListaCiclos");
  if (!cont) return;
  const ciclos = estado.ciclosLectivos || [];
  if (ciclos.length === 0) {
    cont.innerHTML = `<p style="padding:10px; color:#64748b;">Sin ciclos registrados.</p>`;
    return;
  }

  let html = `<table class="app-table"><thead><tr><th>Ciclo</th><th>Período</th><th>Estado</th><th>Creado</th><th>Acciones</th></tr></thead><tbody>`;
  ciclos.forEach(c => {
    const esAct = c.estado === "ACTIVO";
    const clBadge = esAct ? "badge-ok" : (c.estado === "CERRADO" ? "badge-grp" : "badge-warn");
    html += `
      <tr>
        <td><strong>${c.ciclo}</strong></td>
        <td class="td-left">${c.etiqueta}</td>
        <td><span class="badge ${clBadge}">${c.estado}</span></td>
        <td>${c.fechaCreacion || "-"}</td>
        <td>
          <div style="display:flex; gap:5px; justify-content:center; flex-wrap:wrap;">
            <button type="button" class="btn-outline" style="padding:3px 7px; font-size:11px;" onclick="cerrarModalCiclosLectivos(); cambiarCicloLectivo('${c.ciclo}');">Abrir</button>
            ${!esAct ? `<button type="button" class="btn-success-outline" style="padding:3px 7px; font-size:11px;" onclick="cambiarEstadoCicloUI('${c.ciclo}', 'ACTIVO')">Activar</button>` : ""}
            ${c.estado !== "CERRADO" ? `<button type="button" class="btn-danger-outline" style="padding:3px 7px; font-size:11px;" onclick="cambiarEstadoCicloUI('${c.ciclo}', 'CERRADO')">Cerrar</button>` : ""}
          </div>
        </td>
      </tr>
    `;
  });
  html += `</tbody></table>`;
  cont.innerHTML = html;
}

function poblarSelectoresPaseModal() {
  const ciclos = estado.ciclosLectivos || [];
  const selBase = document.getElementById("selCicloBaseNuevo");
  const selOrig = document.getElementById("selPaseCicloOrigen");
  const selDest = document.getElementById("selPaseCicloDestino");

  [selBase, selOrig, selDest].forEach(sel => {
    if (!sel) return;
    sel.innerHTML = "";
    ciclos.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.ciclo;
      opt.textContent = `${c.etiqueta} (${c.estado})`;
      sel.appendChild(opt);
    });
  });

  if (selBase && estado.cicloActual) selBase.value = String(estado.cicloActual);
  if (selOrig && ciclos.length > 0) selOrig.value = ciclos[0].ciclo;
  if (selDest && ciclos.length > 1) selDest.value = ciclos[ciclos.length - 1].ciclo;
}

async function crearNuevoCicloLectivoUI() {
  const anio = document.getElementById("inpNuevoCicloAnio")?.value.trim() || "";
  const cicloBase = document.getElementById("selCicloBaseNuevo")?.value || estado.cicloActual;
  const activarNuevo = document.getElementById("chkActivarNuevoCiclo")?.checked || false;
  if (!anio) return mostrarToast("Ingresá el año del nuevo ciclo lectivo");

  const ok = confirm(`¿Crear la planilla del Ciclo ${anio} (Mar ${anio} - Feb ${Number(anio) + 1}) en la carpeta "Intranet de la Escuela"?

Se copiará la estructura de cursos y horarios desde ${cicloBase}, sin estudiantes.`);
  if (!ok) return;

  const btn = document.getElementById("btnCrearNuevoCiclo");
  try {
    if (btn) { btn.disabled = true; btn.textContent = "Creando planilla en Drive..."; }
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "crearCicloLectivo",
        anioNuevo: anio,
        cicloBase: cicloBase,
        activarNuevo: activarNuevo
      })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);

    aplicarDatosRecibidos(json.data, false);
    renderTablaCiclosModal();
    poblarSelectoresPaseModal();
    mostrarToast(`Ciclo ${anio} creado en "Intranet de la Escuela" (${json.resultado.cursosCopiados} cursos copiados)`, 4500);
  } catch (err) {
    mostrarToast("Error: " + err.message, 4500);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Crear Ciclo Lectivo"; }
  }
}

async function cambiarEstadoCicloUI(cicloObjetivo, nuevoEstado) {
  if (!confirm(`¿Cambiar el ciclo ${cicloObjetivo} a estado ${nuevoEstado}?`)) return;
  try {
    mostrarToast("Actualizando estado del ciclo...");
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "cambiarEstadoCiclo",
        cicloObjetivo: cicloObjetivo,
        nuevoEstado: nuevoEstado
      })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);
    aplicarDatosRecibidos(json.data, false);
    renderTablaCiclosModal();
    poblarSelectoresPaseModal();
    mostrarToast(`Ciclo ${cicloObjetivo}: ${nuevoEstado}`);
  } catch (err) {
    mostrarToast("Error: " + err.message, 4000);
  }
}

async function cargarPreviaPaseDeAnioUI() {
  const orig = document.getElementById("selPaseCicloOrigen")?.value || "";
  const dest = document.getElementById("selPaseCicloDestino")?.value || "";
  if (!orig || !dest || orig === dest) {
    return mostrarToast("Elegí dos ciclos distintos (origen y destino)");
  }

  const cont = document.getElementById("contenedorPreviaPaseDeAnio");
  const btnEjec = document.getElementById("btnConfirmarPaseDeAnio");
  if (cont) cont.innerHTML = `<p style="padding:10px; color:#475569;">Analizando calificaciones y materias pendientes de ${orig}...</p>`;

  try {
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "obtenerPreviaPaseDeAnio",
        cicloOrigen: orig,
        cicloDestino: dest
      })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);

    previaPaseActual = json.previa;
    renderPreviaPaseDeAnio();
    if (btnEjec) btnEjec.style.display = "inline-flex";
  } catch (err) {
    if (cont) cont.innerHTML = `<p style="padding:10px; color:#b91c1c;">Error: ${err.message}</p>`;
  }
}

function aplicarDestinoMasivoCursoPase(idxCurso, nuevoDestino) {
  if (!previaPaseActual || !previaPaseActual.cursos[idxCurso]) return;
  previaPaseActual.cursos[idxCurso].cursoDestinoSugerido = nuevoDestino;
  previaPaseActual.cursos[idxCurso].estudiantes.forEach(est => {
    est.cursoDestinoSugerido = nuevoDestino;
  });
  renderPreviaPaseDeAnio();
}

function cambiarDestinoAlumnoPase(idxCurso, idxEst, nuevoDestino) {
  if (!previaPaseActual || !previaPaseActual.cursos[idxCurso]) return;
  const est = previaPaseActual.cursos[idxCurso].estudiantes[idxEst];
  if (est) est.cursoDestinoSugerido = nuevoDestino;
}

function renderPreviaPaseDeAnio() {
  const cont = document.getElementById("contenedorPreviaPaseDeAnio");
  if (!cont || !previaPaseActual) return;

  const opcionesDestBase = [...(previaPaseActual.cursosDestinoDisponibles || [])];
  if (!opcionesDestBase.includes("EGRESADO")) opcionesDestBase.push("EGRESADO");
  if (!opcionesDestBase.includes("OMITIR")) opcionesDestBase.push("OMITIR");

  let html = "";
  (previaPaseActual.cursos || []).forEach((cursoObj, idxC) => {
    const opcionesCurso = [...opcionesDestBase];
    if (cursoObj.cursoDestinoSugerido && !opcionesCurso.includes(cursoObj.cursoDestinoSugerido)) {
      opcionesCurso.unshift(cursoObj.cursoDestinoSugerido);
    }

    html += `
      <div style="border:1px solid #cbd5e1; border-radius:8px; padding:10px; margin-bottom:10px; background:#fff;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
          <strong>${cursoObj.cursoOrigen.replace(/_/g, " ")} (${cursoObj.estudiantes.length} activos)</strong>
          <div style="display:flex; align-items:center; gap:6px; font-size:12px;">
            <label style="font-weight:700; color:#475569;">Destino del curso:</label>
            <select style="padding:4px 8px; border:1px solid #cbd5e1; border-radius:4px; font-weight:700;" onchange="aplicarDestinoMasivoCursoPase(${idxC}, this.value)">
              ${opcionesCurso.map(op => `<option value="${op}" ${op === cursoObj.cursoDestinoSugerido ? "selected" : ""}>${op.replace(/_/g, " ")}</option>`).join("")}
            </select>
          </div>
        </div>
    `;

    if (cursoObj.estudiantes.length === 0) {
      html += `<p style="font-size:12px; color:#64748b;">Sin estudiantes activos.</p>`;
    } else {
      html += `<div class="table-wrap"><table class="app-table"><thead><tr><th>Estudiante</th><th>Desap. ${previaPaseActual.cicloOrigen}</th><th>Previas Ant.</th><th>Total</th><th>Situación</th><th>Curso Destino (${previaPaseActual.cicloDestino})</th></tr></thead><tbody>`;
      cursoObj.estudiantes.forEach((est, idxE) => {
        const clEst = est.estadoSugerido === "PROMUEVE"
          ? "badge-ok"
          : (est.estadoSugerido === "PROMUEVE_CON_PENDIENTES" ? "badge-warn" : "badge-danger");
        const txtEst = est.estadoSugerido === "PROMUEVE"
          ? "Promueve"
          : (est.estadoSugerido === "PROMUEVE_CON_PENDIENTES" ? "Con pendientes" : "Revisión EDTE (>5)");

        const opsAlu = [...opcionesCurso];
        if (!opsAlu.includes(cursoObj.cursoOrigen)) opsAlu.push(cursoObj.cursoOrigen);
        if (est.cursoDestinoSugerido && !opsAlu.includes(est.cursoDestinoSugerido)) opsAlu.unshift(est.cursoDestinoSugerido);

        html += `
          <tr>
            <td class="td-left">${est.nombre}</td>
            <td>${est.desaprobadasCiclo.length}</td>
            <td>${est.cantPreviasAnteriores}</td>
            <td><strong>${est.totalPendientes}</strong></td>
            <td><span class="badge ${clEst}">${txtEst}</span></td>
            <td>
              <select style="padding:3px 6px; font-size:11.5px; border:1px solid #cbd5e1; border-radius:4px;" onchange="cambiarDestinoAlumnoPase(${idxC}, ${idxE}, this.value)">
                ${opsAlu.map(op => `<option value="${op}" ${op === est.cursoDestinoSugerido ? "selected" : ""}>${op.replace(/_/g, " ")}</option>`).join("")}
              </select>
            </td>
          </tr>
        `;
      });
      html += `</tbody></table></div>`;
    }
    html += `</div>`;
  });

  cont.innerHTML = html || `<p style="padding:10px; color:#64748b;">No se encontraron cursos en el ciclo origen.</p>`;
}

async function ejecutarPaseDeAnioUI() {
  if (!previaPaseActual) return;
  const orig = previaPaseActual.cicloOrigen;
  const dest = previaPaseActual.cicloDestino;
  const cerrarOrig = document.getElementById("chkPaseCerrarOrigen")?.checked ?? true;
  const activarDest = document.getElementById("chkPaseActivarDestino")?.checked ?? true;

  const decisiones = [];
  (previaPaseActual.cursos || []).forEach(c => {
    (c.estudiantes || []).forEach(est => {
      decisiones.push({
        nombre: est.nombre,
        dni: est.dni,
        grupo: est.grupo,
        cursoOrigen: c.cursoOrigen,
        cursoDestino: est.cursoDestinoSugerido,
        desaprobadasCiclo: est.desaprobadasCiclo,
        totalPendientes: est.totalPendientes
      });
    });
  });

  if (!confirm(`¿Confirmar el pase de año de ${decisiones.length} estudiante(s) desde ${orig} hacia ${dest}?

Se cargarán las nóminas ordenadas alfabéticamente y se registrarán las materias pendientes de acreditación.`)) {
    return;
  }

  const btn = document.getElementById("btnConfirmarPaseDeAnio");
  try {
    if (btn) { btn.disabled = true; btn.textContent = "Procesando pase de año..."; }
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "ejecutarPaseDeAnio",
        cicloOrigen: orig,
        cicloDestino: dest,
        cerrarCicloOrigen: cerrarOrig,
        activarCicloDestino: activarDest,
        decisiones: decisiones
      })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);

    aplicarDatosRecibidos(json.data, false);
    cerrarModalCiclosLectivos();
    mostrarToast(`Pase completado: ${json.resultado.alumnosMovidos} promovidos, ${json.resultado.alumnosEgresados} egresados, ${json.resultado.nuevasPendientesCreadas} pendientes registradas`, 5500);
  } catch (err) {
    mostrarToast("Error en pase de año: " + err.message, 4500);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Confirmar Pase de Año"; }
  }
}
