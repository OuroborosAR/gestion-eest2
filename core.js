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

const LETRAS_GRUPOS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function esGrupoSinAsignar(grp) {
  const s = String(grp || "").trim().toUpperCase();
  return !s || s === "SIN ASIGNAR" || s === "SIN GRUPO" || s === "-";
}

function normalizarGrupoLetra(grpRaw) {
  const s = String(grpRaw || "").replace(/\s+/g, " ").trim().toUpperCase();
  if (!s || s === "SIN ASIGNAR" || s === "SIN GRUPO" || s === "-") return "SIN ASIGNAR";
  if (/^[A-Z]$/.test(s)) return "GRUPO " + s;
  const m = s.match(/^(?:GRUPO|GR\.?)\s*([A-Z0-9]+)$/);
  if (m && m[1]) return "GRUPO " + m[1];
  return s;
}

function generarOpcionesGruposHTML(valorActual) {
  const normVal = normalizarGrupoLetra(valorActual);
  let html = `<option value="SIN ASIGNAR" ${normVal === "SIN ASIGNAR" ? "selected" : ""}>SIN ASIGNAR</option>`;
  let encontrado = (normVal === "SIN ASIGNAR");
  LETRAS_GRUPOS.forEach(l => {
    const val = "GRUPO " + l;
    if (normVal === val) encontrado = true;
    html += `<option value="${val}" ${normVal === val ? "selected" : ""}>${val}</option>`;
  });
  if (!encontrado && normVal) {
    html += `<option value="${escHtml(normVal)}" selected>${escHtml(normVal)}</option>`;
  }
  return html;
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
  const esAppsScript = Boolean(url && url.indexOf("script.google.com") !== -1);

  if (esAppsScript && init && init.method && init.method.toUpperCase() === "POST" && init.body) {
    try {
      const parsed = JSON.parse(init.body);
      if (!["login", "solicitarRegistroPersonal", "confirmarRegistroPersonal", "solicitarRecuperacionClave", "confirmarRecuperacionClave"].includes(parsed.accion)) {
        parsed.authToken = sesionAuth.token;
      }
      if (!parsed.ciclo && cicloSeleccionado) parsed.ciclo = cicloSeleccionado;
      init.body = JSON.stringify(parsed);
    } catch (e) {}
  }

  if (!esAppsScript) {
    return nativeFetch(input, init);
  }

  // Reintento automático silencioso si el servidor está ocupado por concurrencia (30+ usuarios)
  const MAX_REINTENTOS = 2;
  for (let intento = 0; intento <= MAX_REINTENTOS; intento++) {
    try {
      const resp = await nativeFetch(input, init);
      if ((resp.status === 429 || resp.status === 503) && intento < MAX_REINTENTOS) {
        await new Promise(r => setTimeout(r, 900 * (intento + 1) + Math.floor(Math.random() * 400)));
        continue;
      }
      if (intento < MAX_REINTENTOS) {
        try {
          const clon = resp.clone();
          const data = await clon.json();
          if (data && data.ocupado) {
            await new Promise(r => setTimeout(r, 1000 * (intento + 1) + Math.floor(Math.random() * 500)));
            continue;
          }
        } catch (e) {}
      }
      return resp;
    } catch (err) {
      if (intento < MAX_REINTENTOS) {
        await new Promise(r => setTimeout(r, 900 * (intento + 1)));
        continue;
      }
      throw err;
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
  metadatosCursos: {},
  usuarioActual: null,
  usuariosSistema: [],
  codigosAcceso: [],
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

let modoLoginSeleccionado = ""; // "" (bienvenida) | "FAMILIA" | "PERSONAL"

function seleccionarModoLogin(modo) {
  modoLoginSeleccionado = (modo === "FAMILIA") ? "FAMILIA" : "PERSONAL";
  const stepWelcome = document.getElementById("loginStepWelcome");
  const stepForm = document.getElementById("loginStepForm");
  const badge = document.getElementById("loginModeBadge");
  const hint = document.getElementById("loginHintBox");
  const lblUser = document.getElementById("lblAuthInputUser");
  const lblPass = document.getElementById("lblAuthInputPass");
  const inpUser = document.getElementById("authInputUser");
  const inpPass = document.getElementById("authInputPass");
  const btnSubmit = document.getElementById("btnSubmitLogin");
  const errBanner = document.getElementById("loginErrorBanner");

  if (errBanner) errBanner.style.display = "none";
  if (stepWelcome) stepWelcome.style.display = "none";
  if (stepForm) stepForm.style.display = "block";

  if (modoLoginSeleccionado === "FAMILIA") {
    if (badge) {
      badge.textContent = "👨‍👩‍👧 Portal de Familias";
      badge.className = "login-mode-pill mode-familia";
    }
    if (hint) {
      hint.innerHTML = "Ingresá el <b>DNI del estudiante</b> (sin puntos). En tu primer ingreso, la contraseña es el mismo DNI.";
      hint.style.display = "block";
    }
    if (lblUser) lblUser.textContent = "DNI del Estudiante (sin puntos)";
    if (lblPass) lblPass.textContent = "Contraseña o PIN";
    if (inpUser) {
      inpUser.placeholder = "Ej: 48123456";
      inpUser.setAttribute("inputmode", "numeric");
    }
    if (inpPass) inpPass.placeholder = "DNI del estudiante o tu clave";
    if (btnSubmit) {
      btnSubmit.className = "btn-main btn-w4b";
      btnSubmit.textContent = "Ingresar al Portal de Familias";
    }
  } else {
    if (badge) {
      badge.textContent = "🏫 Personal Escolar";
      badge.className = "login-mode-pill mode-personal";
    }
    if (hint) {
      hint.style.display = "none";
    }
    if (lblUser) lblUser.textContent = "Usuario";
    if (lblPass) lblPass.textContent = "Contraseña";
    if (inpUser) {
      inpUser.placeholder = "Tu usuario institucional";
      inpUser.setAttribute("inputmode", "text");
    }
    if (inpPass) inpPass.placeholder = "Tu contraseña";
    if (btnSubmit) {
      btnSubmit.className = "btn-main btn-print-blue";
      btnSubmit.textContent = "Ingresar al Sistema";
    }
  }

  const boxReg = document.getElementById("boxLinkRegistroPersonal");
  if (boxReg) boxReg.style.display = (modoLoginSeleccionado === "PERSONAL") ? "block" : "none";
  const stepReg = document.getElementById("loginStepRegister");
  if (stepReg) stepReg.style.display = "none";
  const stepRec = document.getElementById("loginStepRecover");
  if (stepRec) stepRec.style.display = "none";

  if (inpUser) {
    inpUser.value = sesionAuth.usuario || "";
    setTimeout(() => inpUser.focus(), 60);
  }
}

function volverABienvenidaLogin() {
  modoLoginSeleccionado = "";
  const stepWelcome = document.getElementById("loginStepWelcome");
  const stepForm = document.getElementById("loginStepForm");
  const stepReg = document.getElementById("loginStepRegister");
  const errBanner = document.getElementById("loginErrorBanner");
  if (errBanner) errBanner.style.display = "none";
  if (stepForm) stepForm.style.display = "none";
  if (stepReg) stepReg.style.display = "none";
  if (stepWelcome) stepWelcome.style.display = "block";
}

function abrirRegistroPersonalLogin() {
  document.getElementById("loginStepWelcome").style.display = "none";
  document.getElementById("loginStepForm").style.display = "none";
  const stepRec = document.getElementById("loginStepRecover");
  if (stepRec) stepRec.style.display = "none";
  document.getElementById("loginStepRegister").style.display = "block";
  document.getElementById("regSubStep1").style.display = "block";
  document.getElementById("regSubStep2").style.display = "none";
  const err = document.getElementById("regErrorBanner");
  if (err) err.style.display = "none";
}

function volverALoginPersonalDesdeRegistro() {
  seleccionarModoLogin("PERSONAL");
}

function mostrarErrorRegistro(msg) {
  const err = document.getElementById("regErrorBanner");
  if (!err) return;
  if (msg) {
    err.textContent = msg;
    err.style.display = "block";
  } else {
    err.style.display = "none";
  }
}

async function solicitarPinRegistroPersonal() {
  mostrarErrorRegistro("");
  const dni = document.getElementById("regInputDni")?.value.trim() || "";
  const nombre = document.getElementById("regInputNombre")?.value.trim() || "";
  const emailAbc = document.getElementById("regInputEmail")?.value.trim() || "";
  const clave = document.getElementById("regInputPass")?.value.trim() || "";
  const codigoSector1 = document.getElementById("regInputCod1")?.value.trim() || "";
  const codigoSector2 = document.getElementById("regInputCod2")?.value.trim() || "";

  if (!dni || !nombre || !emailAbc || !clave || !codigoSector1) {
    return mostrarErrorRegistro("Completá DNI, Apellido y Nombre, correo @abc.gob.ar, contraseña y Código de Sector.");
  }

  const btn = document.getElementById("btnRegSolicitarPin");
  try {
    if (btn) { btn.disabled = true; btn.textContent = "⏳ Enviando código..."; }
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "solicitarRegistroPersonal",
        dni, nombre, emailAbc, clave, codigoSector1, codigoSector2
      })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);

    document.getElementById("regLblEmailEnviado").textContent = json.resultado.emailAbc;
    document.getElementById("regSubStep1").style.display = "none";
    document.getElementById("regSubStep2").style.display = "block";
    document.getElementById("regInputPin").value = "";
    setTimeout(() => document.getElementById("regInputPin").focus(), 60);
  } catch (err) {
    mostrarErrorRegistro(err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "📧 Enviar código de verificación a mi @abc.gob.ar"; }
  }
}

async function confirmarPinRegistroPersonal() {
  mostrarErrorRegistro("");
  const dni = document.getElementById("regInputDni")?.value.trim() || "";
  const pin = document.getElementById("regInputPin")?.value.trim() || "";
  if (!pin || pin.length < 6) return mostrarErrorRegistro("Ingresá el código de 6 dígitos que llegó a tu @abc.gob.ar.");

  const btn = document.getElementById("btnRegConfirmarPin");
  try {
    if (btn) { btn.disabled = true; btn.textContent = "⏳ Activando cuenta..."; }
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "confirmarRegistroPersonal",
        dni, pin
      })
    });
    const json = await resp.json();
    if (!json.ok || !json.token) throw new Error(json.error || "No se pudo confirmar el registro.");

    sesionAuth.usuario = dni;
    sesionAuth.token = json.token;
    sessionStorage.setItem("eest2_auth_user", dni);
    sessionStorage.setItem("eest2_auth_token", json.token);
    localStorage.setItem("eest2_auth_user", dni);
    localStorage.setItem("eest2_auth_token", json.token);

    document.getElementById("loginOverlayScreen").classList.remove("open");
    aplicarDatosRecibidos(json.data, false);
    actualizarSubtituloHeader();

    const rAuto = json.resumenAutoAsignacion || {};
    mostrarToast(`✅ Cuenta activada (${rAuto.cursosPreceptor || 0} cursos PR, ${rAuto.materiasDocente || 0} materias Doc detectadas)`, 4500);

    if ((json.data.cursos || []).length === 0) {
      abrirModalMisAsignaciones();
    }
  } catch (err) {
    mostrarErrorRegistro(err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "✅ Confirmar y Activar mi Cuenta"; }
  }
}

function mostrarPantallaLogin(msgError) {
  const banner = document.getElementById("loginErrorBanner");
  if (msgError) {
    if (!modoLoginSeleccionado) {
      seleccionarModoLogin("PERSONAL");
    }
    if (banner) {
      banner.textContent = msgError;
      banner.style.display = "block";
    }
  } else {
    volverABienvenidaLogin();
  }
  document.getElementById("loginOverlayScreen").classList.add("open");
}

async function iniciarSesionSistema() {
  const u = document.getElementById("authInputUser").value.trim();
  const c = document.getElementById("authInputPass").value.trim();
  const recordar = document.getElementById("authChkRemember").checked;

  if (!u || !c) {
    mostrarPantallaLogin(
      modoLoginSeleccionado === "FAMILIA"
        ? "Ingresá el DNI del estudiante y la contraseña."
        : "Ingresá tu usuario y tu contraseña."
    );
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
    btn.textContent = (modoLoginSeleccionado === "FAMILIA")
      ? "Ingresar al Portal de Familias"
      : "Ingresar al Sistema";
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

function obtenerRolesActuales() {
  if (!estado.usuarioActual) return [];
  if (Array.isArray(estado.usuarioActual.roles) && estado.usuarioActual.roles.length > 0) {
    return estado.usuarioActual.roles;
  }
  const arr = [];
  const r1 = String(estado.usuarioActual.rol || "").toUpperCase();
  const r2 = String(estado.usuarioActual.rolSecundario || "").toUpperCase();
  if (r1) arr.push(r1);
  if (r2 && r2 !== r1) arr.push(r2);
  return arr;
}

function tieneRolActual(rol) {
  return obtenerRolesActuales().includes(String(rol || "").toUpperCase());
}

function tieneAlgunRolActual(lista) {
  const rs = obtenerRolesActuales();
  return (lista || []).some(r => rs.includes(r));
}

function esAdminODirectivoActual() {
  return tieneAlgunRolActual(["ADMIN", "DIRECTIVO"]);
}

function esRolFamiliaActual() {
  if (!estado.usuarioActual) return false;
  return String(estado.usuarioActual.rol || "").toUpperCase() === "FAMILIA";
}

function esPreceptorEnCursoActual() {
  if (tieneAlgunRolActual(["ADMIN", "DIRECTIVO", "JEFE_PR"])) return true;
  if (!tieneRolActual("PRECEPTOR")) return false;
  const perm = (estado.usuarioActual?.cursosPermitidos || []).map(c => String(c).toLowerCase());
  const cur = String(estado.cursoActual || "").toLowerCase();
  return perm.includes("todos") || (cur && perm.includes(cur));
}

function obtenerMateriasDocenteEnCursoActual() {
  if (!tieneRolActual("DOCENTE")) return [];
  const cur = String(estado.cursoActual || "").toLowerCase();
  return (estado.usuarioActual?.materiasDocente || [])
    .filter(m => String(m.curso || "").toLowerCase() === cur)
    .map(m => String(m.materia || "").trim());
}

function esModoDocenteEnCursoActual() {
  if (esRolFamiliaActual()) return false;
  if (esPreceptorEnCursoActual()) return false;
  if (tieneAlgunRolActual(["EOE", "SECRETARIA"])) return false;
  return tieneRolActual("DOCENTE");
}

function puedeEditarNotasMateriaActual(matObj) {
  if (esRolFamiliaActual()) return false;
  if (esPreceptorEnCursoActual()) return true;
  if (tieneRolActual("DOCENTE")) {
    const permitidas = obtenerMateriasDocenteEnCursoActual();
    if (permitidas.length === 0) return false;
    if (!matObj) return true;
    const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
    const kMat = norm(matObj.nombre);
    return permitidas.some(p => {
      const kp = norm(p);
      return kp === kMat || (kp.length >= 5 && kMat.indexOf(kp) !== -1) || (kMat.length >= 5 && kp.indexOf(kMat) !== -1);
    });
  }
  return false;
}

function obtenerPestanasPermitidasActual() {
  if (esRolFamiliaActual()) return ["alumno"];
  if (esPreceptorEnCursoActual()) return ["asistencia", "parte", "materia", "alumno", "actas", "planilla"];

  const tabs = new Set();
  if (tieneRolActual("EOE")) {
    tabs.add("alumno");
    tabs.add("actas");
    tabs.add("planilla");
  }
  if (tieneRolActual("SECRETARIA")) {
    tabs.add("alumno");
    tabs.add("planilla");
    tabs.add("materia");
  }
  if (tieneRolActual("DOCENTE")) {
    tabs.add("materia");
  }
  if (tabs.size === 0) tabs.add("materia");
  return ["asistencia", "parte", "materia", "alumno", "actas", "planilla"].filter(t => tabs.has(t));
}

function abrirModalGestionUsuarios() {
  limpiarFormularioGestionUsuario();
  renderizarTablaUsuariosSistema();
  renderizarCodigosAccesoAdmin();
  cargarAuditoriaSeguridadUI();
  document.getElementById("modalGestionUsuarios").classList.add("open");
}

function renderizarCodigosAccesoAdmin() {
  const cont = document.getElementById("contenedorCodigosAccesoAdmin");
  if (!cont) return;
  const lista = estado.codigosAcceso || [];
  if (lista.length === 0) {
    cont.innerHTML = `<p style="font-size:12px; color:#64748b;">Los códigos se cargan al abrir con cuenta Directivo/Admin.</p>`;
    return;
  }
  let html = `<div class="codigos-acceso-grid">`;
  lista.forEach((item, idx) => {
    html += `
      <div class="cod-acc-row">
        <div class="cod-acc-rol">
          <strong>${escHtml(item.rol)}</strong>
          <small>${escHtml(item.descripcion || "")}</small>
        </div>
        <input type="text" class="cod-acc-inp" data-idx="${idx}" data-rol="${escHtml(item.rol)}" data-desc="${escHtml(item.descripcion || "")}" value="${escHtml(item.codigo)}">
      </div>
    `;
  });
  html += `</div>`;
  cont.innerHTML = html;
}

async function guardarCodigosAccesoUI() {
  const inputs = Array.from(document.querySelectorAll(".cod-acc-inp"));
  const codigos = inputs.map(inp => ({
    rol: inp.dataset.rol,
    codigo: inp.value.trim().toUpperCase(),
    descripcion: inp.dataset.desc || ""
  })).filter(x => x.rol && x.codigo);

  const btn = document.getElementById("btnGuardarCodigosAcceso");
  try {
    if (btn) { btn.disabled = true; btn.textContent = "Guardando..."; }
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ accion: "guardarCodigosAcceso", codigos })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);
    estado.codigosAcceso = json.codigosAcceso || codigos;
    renderizarCodigosAccesoAdmin();
    mostrarToast("✅ Códigos de acceso actualizados");
  } catch (err) {
    mostrarToast("⚠️ Error: " + err.message, 4000);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "💾 Guardar Códigos"; }
  }
}

function cerrarModalGestionUsuarios() {
  document.getElementById("modalGestionUsuarios").classList.remove("open");
}

function actualizarVisibilidadCursosPreceptor() {
  const rol1 = document.getElementById("usrFormRol")?.value || "";
  const rol2 = document.getElementById("usrFormRolSec")?.value || "";
  const esPR = (rol1 === "PRECEPTOR" || rol2 === "PRECEPTOR") && !["ADMIN", "DIRECTIVO", "JEFE_PR", "SECRETARIA", "EOE"].includes(rol1);
  document.getElementById("usrFormCursosBox").style.display = esPR ? "flex" : "none";
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
  const r2 = document.getElementById("usrFormRolSec");
  if (r2) r2.value = "";
  const em = document.getElementById("usrFormEmailAbc");
  if (em) em.value = "";
  actualizarVisibilidadCursosPreceptor();
  renderizarCheckboxesCursosPreceptor(["TODOS"]);
}

function editarUsuarioEnFormulario(u) {
  document.getElementById("usrFormLogin").value = u.usuario;
  document.getElementById("usrFormClave").value = "";
  document.getElementById("usrFormClave").placeholder = "Dejar vacío para mantener clave actual";
  document.getElementById("usrFormNombre").value = u.nombre;
  document.getElementById("usrFormRol").value = u.rol;
  const r2 = document.getElementById("usrFormRolSec");
  if (r2) r2.value = u.rolSecundario || "";
  const em = document.getElementById("usrFormEmailAbc");
  if (em) em.value = u.emailAbc || "";
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
        <td><span class="badge badge-grp">${escHtml(u.rol)}${u.rolSecundario ? ' + ' + escHtml(u.rolSecundario) : ''}</span></td>
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
  const rolSecundario = document.getElementById("usrFormRolSec")?.value || "";
  const emailAbc = document.getElementById("usrFormEmailAbc")?.value.trim() || "";

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
        datosUsuario: { usuario, clave, nombre, rol, rolSecundario, emailAbc, cursosPermitidos, activo: true }
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

const MODALIDADES_CURSO_INFO = {
  CICLO_BASICO: { label: "Ciclo Básico", short: "📘 Ciclo Básico", cls: "cmod-cb", orden: 1 },
  ELECTROMECANICA: { label: "Electromecánica", short: "⚡ Electromecánica", cls: "cmod-em", orden: 2 },
  ALIMENTOS: { label: "Alimentos", short: "🧪 Alimentos", cls: "cmod-al", orden: 3 },
  NAVAL: { label: "Constructor Naval", short: "⚓ Naval", cls: "cmod-nv", orden: 4 },
  SIN_CLASIFICAR: { label: "Sin clasificar", short: "📁 Sin clasificar", cls: "cmod-sc", orden: 5 }
};

let filtroCursoModal = { modalidad: "TODOS", anio: "TODOS", texto: "" };
let cursoEnClasificacion = "";

function obtenerMetaCurso(nombreCurso) {
  const nom = String(nombreCurso || "").trim();
  const desdeSheet = estado.metadatosCursos && estado.metadatosCursos[nom];
  if (desdeSheet && desdeSheet.modalidad) {
    return desdeSheet;
  }
  const anio = typeof detectarAnioDesdeNombreCurso === "function" ? detectarAnioDesdeNombreCurso(nom) : 0;
  if (anio >= 1 && anio <= 3) {
    return { curso: nom, ciclo: "CICLO_BASICO", anio: anio, modalidad: "CICLO_BASICO", grupoTaller1: "", grupoTaller2: "" };
  }
  const mapaLoc = typeof obtenerMapaEspecialidadesCursos === "function" ? obtenerMapaEspecialidadesCursos() : {};
  const modLoc = mapaLoc[nom] || "SIN_CLASIFICAR";
  return {
    curso: nom,
    ciclo: anio >= 4 ? "CICLO_SUPERIOR" : "SIN_CLASIFICAR",
    anio: anio,
    modalidad: modLoc,
    grupoTaller1: "",
    grupoTaller2: ""
  };
}

function compararCursosOrdenNatural(a, b) {
  const ma = obtenerMetaCurso(a);
  const mb = obtenerMetaCurso(b);
  const aa = ma.anio || 99;
  const ab = mb.anio || 99;
  if (aa !== ab) return aa - ab;
  const na = (String(a).match(/\d+/g) || []).map(Number);
  const nb = (String(b).match(/\d+/g) || []).map(Number);
  for (let i = 0; i < Math.max(na.length, nb.length); i++) {
    const va = na[i] ?? 0;
    const vb = nb[i] ?? 0;
    if (va !== vb) return va - vb;
  }
  return String(a).localeCompare(String(b), "es");
}

function poblarSelectorCursosAgrupado(cursosLista, cursoActual) {
  const selCurso = document.getElementById("cursoSelect");
  if (!selCurso) return;
  selCurso.innerHTML = "";

  const ordenados = [...(cursosLista || [])].sort(compararCursosOrdenNatural);
  if (ordenados.length <= 5) {
    ordenados.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c;
      const meta = obtenerMetaCurso(c);
      const info = MODALIDADES_CURSO_INFO[meta.modalidad] || MODALIDADES_CURSO_INFO.SIN_CLASIFICAR;
      opt.textContent = `${c.replace(/_/g, " ")} (${info.label})`;
      if (c === cursoActual) opt.selected = true;
      selCurso.appendChild(opt);
    });
    return;
  }

  const grupos = {};
  ordenados.forEach(c => {
    const mod = obtenerMetaCurso(c).modalidad || "SIN_CLASIFICAR";
    if (!grupos[mod]) grupos[mod] = [];
    grupos[mod].push(c);
  });

  Object.keys(MODALIDADES_CURSO_INFO).forEach(modKey => {
    const listaMod = grupos[modKey];
    if (!listaMod || listaMod.length === 0) return;
    const og = document.createElement("optgroup");
    og.label = MODALIDADES_CURSO_INFO[modKey].short;
    listaMod.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c.replace(/_/g, " ");
      if (c === cursoActual) opt.selected = true;
      og.appendChild(opt);
    });
    selCurso.appendChild(og);
  });
}

function abrirModalSelectorCurso(directoACrear = false) {
  if (esRolFamiliaActual()) return;
  cerrarClasificadorCursoModal();
  const selG1 = document.getElementById("ncGrupoTaller1");
  const selG2 = document.getElementById("ncGrupoTaller2");
  if (selG1 && !selG1.options.length) {
    selG1.innerHTML = LETRAS_GRUPOS.map(l => `<option value="GRUPO ${l}" ${l === "A" ? "selected" : ""}>GRUPO ${l}</option>`).join("");
  }
  if (selG2 && !selG2.options.length) {
    selG2.innerHTML = LETRAS_GRUPOS.map(l => `<option value="GRUPO ${l}" ${l === "B" ? "selected" : ""}>GRUPO ${l}</option>`).join("");
  }
  renderTarjetasCursosEnModal();
  mostrarFormularioNuevoCurso(directoACrear);
  document.getElementById("modalSelectorCurso").classList.add("open");
}

function cerrarModalSelectorCurso() {
  cerrarClasificadorCursoModal();
  document.getElementById("modalSelectorCurso").classList.remove("open");
}

function mostrarFormularioNuevoCurso(mostrar) {
  document.getElementById("seccionSeleccionarCursoExistente").classList.toggle("hidden", mostrar);
  document.getElementById("seccionFormularioNuevoCurso").classList.toggle("hidden", !mostrar);
}

function alEscribirNombreNuevoCurso(valor) {
  const anio = typeof detectarAnioDesdeNombreCurso === "function" ? detectarAnioDesdeNombreCurso(valor) : 0;
  const selAnio = document.getElementById("ncAnioPlan");
  const selEsp = document.getElementById("ncEspecialidad");
  if (!anio || !selAnio || !selEsp) return;
  selAnio.value = String(anio);
  if (anio >= 1 && anio <= 3) {
    if (selEsp.value !== "CICLO_BASICO") {
      selEsp.value = "CICLO_BASICO";
      aplicarPlanCurricularANuevoCurso();
    } else {
      aplicarPlanCurricularANuevoCurso();
    }
  } else if (selEsp.value === "CICLO_BASICO") {
    selEsp.value = "";
  }
}

function alCambiarBusquedaCursos(txt) {
  filtroCursoModal.texto = String(txt || "").trim().toLowerCase();
  renderTarjetasCursosEnModal();
}

function seleccionarFiltroModalidadCursos(modKey) {
  filtroCursoModal.modalidad = modKey;
  if (modKey === "CICLO_BASICO" && !["TODOS", "1", "2", "3"].includes(filtroCursoModal.anio)) {
    filtroCursoModal.anio = "TODOS";
  } else if (["ELECTROMECANICA", "ALIMENTOS", "NAVAL"].includes(modKey) && !["TODOS", "4", "5", "6", "7"].includes(filtroCursoModal.anio)) {
    filtroCursoModal.anio = "TODOS";
  }
  renderTarjetasCursosEnModal();
}

function seleccionarFiltroAnioCursos(anioVal) {
  filtroCursoModal.anio = String(anioVal);
  renderTarjetasCursosEnModal();
}

function renderFiltrosNavegadorCursos(listaTotal) {
  const contMod = document.getElementById("cursoNavModalidadChips");
  const contAnio = document.getElementById("cursoNavAnioChips");
  if (!contMod || !contAnio) return;

  const conteosMod = { TODOS: listaTotal.length, CICLO_BASICO: 0, ELECTROMECANICA: 0, ALIMENTOS: 0, NAVAL: 0, SIN_CLASIFICAR: 0 };
  listaTotal.forEach(c => {
    const m = obtenerMetaCurso(c).modalidad || "SIN_CLASIFICAR";
    if (conteosMod[m] !== undefined) conteosMod[m]++;
  });

  const botonesMod = [
    { key: "TODOS", lbl: `Todos (${conteosMod.TODOS})` },
    { key: "CICLO_BASICO", lbl: `📘 Ciclo Básico (${conteosMod.CICLO_BASICO})` },
    { key: "ELECTROMECANICA", lbl: `⚡ Electromecánica (${conteosMod.ELECTROMECANICA})` },
    { key: "ALIMENTOS", lbl: `🧪 Alimentos (${conteosMod.ALIMENTOS})` },
    { key: "NAVAL", lbl: `⚓ Naval (${conteosMod.NAVAL})` }
  ];
  if (conteosMod.SIN_CLASIFICAR > 0) {
    botonesMod.push({ key: "SIN_CLASIFICAR", lbl: `📁 Sin clasificar (${conteosMod.SIN_CLASIFICAR})` });
  }

  contMod.innerHTML = botonesMod.map(b =>
    `<button type="button" class="cnav-chip ${filtroCursoModal.modalidad === b.key ? 'active' : ''}" onclick="seleccionarFiltroModalidadCursos('${b.key}')">${b.lbl}</button>`
  ).join("");

  let aniosVisibles = ["1", "2", "3", "4", "5", "6", "7"];
  if (filtroCursoModal.modalidad === "CICLO_BASICO") aniosVisibles = ["1", "2", "3"];
  else if (["ELECTROMECANICA", "ALIMENTOS", "NAVAL"].includes(filtroCursoModal.modalidad)) aniosVisibles = ["4", "5", "6", "7"];

  let htmlAnios = `<button type="button" class="cnav-chip cnav-chip-anio ${filtroCursoModal.anio === 'TODOS' ? 'active' : ''}" onclick="seleccionarFiltroAnioCursos('TODOS')">Todos los años</button>`;
  aniosVisibles.forEach(a => {
    htmlAnios += `<button type="button" class="cnav-chip cnav-chip-anio ${filtroCursoModal.anio === a ? 'active' : ''}" onclick="seleccionarFiltroAnioCursos('${a}')">${a}°</button>`;
  });
  contAnio.innerHTML = htmlAnios;
}

function renderTarjetasCursosEnModal() {
  const grid = document.getElementById("gridCursosDisponibles");
  if (!grid) return;
  const listaTotal = [...(estado.cursos || [])].sort(compararCursosOrdenNatural);
  renderFiltrosNavegadorCursos(listaTotal);

  const filtrados = listaTotal.filter(c => {
    const meta = obtenerMetaCurso(c);
    if (filtroCursoModal.modalidad !== "TODOS" && meta.modalidad !== filtroCursoModal.modalidad) return false;
    if (filtroCursoModal.anio !== "TODOS" && String(meta.anio || "") !== String(filtroCursoModal.anio)) return false;
    if (filtroCursoModal.texto) {
      const info = MODALIDADES_CURSO_INFO[meta.modalidad] || MODALIDADES_CURSO_INFO.SIN_CLASIFICAR;
      const buscable = `${c.replace(/_/g, " ")} ${info.label} ${meta.anio || ""} ${meta.grupoTaller1 || ""} ${meta.grupoTaller2 || ""}`.toLowerCase();
      const tokens = filtroCursoModal.texto.split(/\s+/).filter(Boolean);
      if (!tokens.every(tk => buscable.indexOf(tk) !== -1)) return false;
    }
    return true;
  });

  const lblCnt = document.getElementById("cursoNavCount");
  if (lblCnt) lblCnt.textContent = `${filtrados.length} de ${listaTotal.length} curso${listaTotal.length === 1 ? "" : "s"}`;

  if (filtrados.length === 0) {
    grid.innerHTML = `<p style="color:#64748b; font-size:12.5px; padding:10px 4px;">No se encontraron cursos con ese filtro.</p>`;
    return;
  }

  const puedeBorrar = esAdminODirectivoActual();
  const puedeClasificar = !esRolFamiliaActual();
  let html = "";
  filtrados.forEach(c => {
    const esActual = c === estado.cursoActual;
    const limpio = c.replace(/_/g, " ");
    const meta = obtenerMetaCurso(c);
    const info = MODALIDADES_CURSO_INFO[meta.modalidad] || MODALIDADES_CURSO_INFO.SIN_CLASIFICAR;
    const txtGrupos = (meta.grupoTaller1 || meta.grupoTaller2)
      ? ` • ${[meta.grupoTaller1, meta.grupoTaller2].filter(Boolean).map(g => g.replace("GRUPO ", "Gr.")).join("/")}`
      : "";

    html += `
      <div class="course-card-item ${esActual ? 'active-course' : ''}">
        <button type="button" class="course-card-btn" onclick="seleccionarCursoDesdeModal('${c}')">
          <strong>🏫 ${limpio}</strong>
          <span class="course-mod-badge ${info.cls}">${info.short}${meta.anio ? ` • ${meta.anio}°` : ""}</span>
          <small style="display:block; margin-top:3px;">${esActual ? 'Curso activo' : 'Tocar para abrir'}${txtGrupos}</small>
        </button>
        ${(puedeClasificar || puedeBorrar) ? `
        <div class="course-card-actions">
          ${puedeClasificar ? `<button type="button" class="course-edit-btn" title="Clasificar modalidad y grupos de ${limpio}" onclick="abrirClasificadorCursoModal('${c}')">🏷️</button>` : ""}
          ${puedeBorrar ? `<button type="button" class="course-delete-btn" title="Eliminar curso ${limpio}" onclick="confirmarEliminarCurso('${c}')">🗑️</button>` : ""}
        </div>` : ''}
      </div>
    `;
  });
  grid.innerHTML = html;
}

function abrirClasificadorCursoModal(nombreCurso) {
  cursoEnClasificacion = nombreCurso;
  const meta = obtenerMetaCurso(nombreCurso);
  const panel = document.getElementById("panelClasificarCursoModal");
  if (!panel) return;
  document.getElementById("clsCursoNombreLbl").textContent = nombreCurso.replace(/_/g, " ");

  const selMod = document.getElementById("clsCursoModalidad");
  const selAnio = document.getElementById("clsCursoAnio");
  const selG1 = document.getElementById("clsCursoGrupo1");
  const selG2 = document.getElementById("clsCursoGrupo2");

  const modVal = (meta.modalidad && meta.modalidad !== "SIN_CLASIFICAR")
    ? meta.modalidad
    : (meta.anio >= 1 && meta.anio <= 3 ? "CICLO_BASICO" : "ELECTROMECANICA");
  if (selMod) selMod.value = modVal;
  if (selAnio) selAnio.value = String(meta.anio || (modVal === "CICLO_BASICO" ? 1 : 4));

  const g1Val = normalizarGrupoLetra(meta.grupoTaller1 || "GRUPO A");
  const g2Val = normalizarGrupoLetra(meta.grupoTaller2 || "GRUPO B");
  if (selG1) selG1.innerHTML = LETRAS_GRUPOS.map(l => `<option value="GRUPO ${l}" ${("GRUPO " + l) === g1Val ? "selected" : ""}>GRUPO ${l}</option>`).join("");
  if (selG2) selG2.innerHTML = LETRAS_GRUPOS.map(l => `<option value="GRUPO ${l}" ${("GRUPO " + l) === g2Val ? "selected" : ""}>GRUPO ${l}</option>`).join("");

  panel.classList.remove("hidden");
  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function alCambiarModalidadClasificador() {
  const mod = document.getElementById("clsCursoModalidad")?.value || "CICLO_BASICO";
  const selAnio = document.getElementById("clsCursoAnio");
  if (!selAnio) return;
  const a = parseInt(selAnio.value, 10) || 0;
  if (mod === "CICLO_BASICO" && a > 3) selAnio.value = "1";
  if (mod !== "CICLO_BASICO" && a < 4) selAnio.value = "4";
}

function cerrarClasificadorCursoModal() {
  cursoEnClasificacion = "";
  const panel = document.getElementById("panelClasificarCursoModal");
  if (panel) panel.classList.add("hidden");
}

async function guardarClasificacionCursoModal() {
  if (!cursoEnClasificacion) return;
  const modalidad = document.getElementById("clsCursoModalidad")?.value || "CICLO_BASICO";
  const anio = parseInt(document.getElementById("clsCursoAnio")?.value || "0", 10);
  const grupoTaller1 = document.getElementById("clsCursoGrupo1")?.value || "GRUPO A";
  const grupoTaller2 = document.getElementById("clsCursoGrupo2")?.value || "GRUPO B";

  const btn = document.getElementById("btnGuardarClasificacionCurso");
  try {
    if (btn) { btn.disabled = true; btn.textContent = "Guardando..."; }
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "guardarMetadatosCurso",
        nombreCurso: cursoEnClasificacion,
        metadatosCurso: { modalidad, anio, grupoTaller1, grupoTaller2 }
      })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);

    estado.metadatosCursos = json.metadatosCursos || estado.metadatosCursos;
    if (typeof guardarEspecialidadCursoLocal === "function") guardarEspecialidadCursoLocal(cursoEnClasificacion, modalidad);
    if (typeof guardarGruposTallerCursoLocal === "function") guardarGruposTallerCursoLocal(cursoEnClasificacion, grupoTaller1, grupoTaller2);

    poblarSelectorCursosAgrupado(estado.cursos, estado.cursoActual);
    cerrarClasificadorCursoModal();
    renderTarjetasCursosEnModal();
    mostrarToast("✅ Clasificación guardada en Google Sheets");
  } catch (err) {
    mostrarToast("⚠️ Error: " + err.message, 4000);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "💾 Guardar Clasificación"; }
  }
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

    const espNC = document.getElementById("ncEspecialidad")?.value || "";
    if (espNC && typeof guardarEspecialidadCursoLocal === "function") {
      guardarEspecialidadCursoLocal(json.data.cursoActual, espNC);
    }
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
      const grupoAlu = normalizarGrupoLetra(partes[1] || "SIN ASIGNAR");
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
        estudiantesIniciales: estudiantesIniciales,
        metadatosCurso: {
          modalidad: document.getElementById("ncEspecialidad")?.value || "",
          anio: parseInt(document.getElementById("ncAnioPlan")?.value || "0", 10) || 0,
          grupoTaller1: document.getElementById("ncGrupoTaller1")?.value || "GRUPO A",
          grupoTaller2: document.getElementById("ncGrupoTaller2")?.value || "GRUPO B"
        }
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
  const selGrp = document.getElementById("loteGrupoDefault");
  if (selGrp) selGrp.innerHTML = generarOpcionesGruposHTML("SIN ASIGNAR");
  document.getElementById("loteTextoEstudiantes").value = "";
  document.getElementById("modalCargaMasivaAlumnos").classList.add("open");
}

function cerrarModalCargaMasivaAlumnos() {
  document.getElementById("modalCargaMasivaAlumnos").classList.remove("open");
}

async function ejecutarCargaMasivaAlumnos() {
  const texto = document.getElementById("loteTextoEstudiantes").value.trim();
  const grpDef = normalizarGrupoLetra(document.getElementById("loteGrupoDefault")?.value || "SIN ASIGNAR");
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
    const grp = normalizarGrupoLetra(partes[1] || grpDef);

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

function aplicarPlanCurricularANuevoCurso() {
  const selEsp = document.getElementById("ncEspecialidad");
  const selAnio = document.getElementById("ncAnioPlan");
  const txtMat = document.getElementById("ncListaMaterias");
  if (!selEsp || !selAnio || !txtMat || typeof obtenerMateriasCatalogo !== "function") return;

  let esp = selEsp.value;
  let anio = parseInt(selAnio.value, 10) || 0;
  if (!esp) return;

  if (esp === "CICLO_BASICO" && (anio < 1 || anio > 3)) {
    anio = 1;
    selAnio.value = "1";
  } else if (esp !== "CICLO_BASICO" && (anio < 4 || anio > 7)) {
    anio = 4;
    selAnio.value = "4";
  }

  const lista = obtenerMateriasCatalogo(esp, anio);
  if (esp === "CICLO_BASICO") {
    // En Ciclo Básico, enviamos las materias de Teoría + Ed. Física + "Taller" (el backend autogenera los 3 módulos + TALLER General)
    const filtradas = lista.filter(m => m.modalidad !== "TALLER").map(m => m.nombre);
    filtradas.push("Taller");
    txtMat.value = filtradas.join(", ");
  } else {
    txtMat.value = lista.map(m => m.nombre).join(", ");
  }
}

function inferirModalidadDesdeTurno(turnoStr) {
  const up = String(turnoStr || "").toUpperCase();
  if (up.indexOf("FÍSICA") !== -1 || up.indexOf("FISICA") !== -1) return "ED_FISICA";
  if (up.indexOf("TALLER") !== -1) return "TALLER";
  return "TEORIA";
}

function detectarGruposTallerDelCurso() {
  const curso = estado.cursoActual || "";
  if (typeof obtenerMapaGruposTallerCursos === "function") {
    const mapa = obtenerMapaGruposTallerCursos();
    if (curso && Array.isArray(mapa[curso]) && mapa[curso].length >= 2) {
      return [normalizarGrupoLetra(mapa[curso][0]), normalizarGrupoLetra(mapa[curso][1])];
    }
  }

  const encontrados = [];
  const agregar = (gRaw) => {
    const g = normalizarGrupoLetra(gRaw);
    if (!esGrupoSinAsignar(g) && g !== "TEORÍA" && g !== "TEORIA" && g !== "TEO" && g !== "CURSO" && g !== "AMBOS" && !encontrados.includes(g)) {
      encontrados.push(g);
    }
  };

  // 1. Desde estudiantes cargados
  (estado.estudiantes || []).forEach(e => { if (e.grupo) agregar(e.grupo); });

  // 2. Desde bloques de taller ya guardados en el horario
  const bloques = (estado.horarioParte && estado.horarioParte.bloques) || [];
  bloques.forEach(b => {
    if (String(b.modalidad || "").toUpperCase() === "TALLER" || b.esTaller) {
      agregar(b.grupo);
    }
  });

  if (encontrados.length >= 2) return [encontrados[0], encontrados[1]];
  if (encontrados.length === 1) {
    const letra1 = encontrados[0].replace(/^GRUPO\s*/i, "").trim();
    const idxL = LETRAS_GRUPOS.indexOf(letra1);
    const sigLetra = (idxL >= 0 && idxL < LETRAS_GRUPOS.length - 1) ? LETRAS_GRUPOS[idxL + 1] : "B";
    return [encontrados[0], "GRUPO " + sigLetra];
  }
  return ["GRUPO A", "GRUPO B"];
}

function obtenerGruposTallerActivosEditor() {
  const g1 = normalizarGrupoLetra(document.getElementById("cfgGrupoTaller1")?.value || "GRUPO A");
  const g2 = normalizarGrupoLetra(document.getElementById("cfgGrupoTaller2")?.value || "GRUPO B");
  return g1 === g2 ? [g1] : [g1, g2];
}

function alCambiarGruposTallerEditor() {
  sincronizarInputsEditorHorario();
  const g1 = normalizarGrupoLetra(document.getElementById("cfgGrupoTaller1")?.value || "GRUPO A");
  const g2 = normalizarGrupoLetra(document.getElementById("cfgGrupoTaller2")?.value || "GRUPO B");
  if (typeof guardarGruposTallerCursoLocal === "function") {
    guardarGruposTallerCursoLocal(estado.cursoActual, g1, g2);
  }
  renderFilasEditorHorario();
}

function abrirModalConfigHorario() {
  const cursoLimpio = (estado.cursoActual || "Curso").replace(/_/g, " ");
  document.getElementById("lblCursoConfigHorario").textContent = cursoLimpio;

  const hp = estado.horarioParte || {};
  const prec = hp.preceptores || { tm: "___________", tt: "VENANCIO MARCELO", tv: "___________" };

  document.getElementById("cfgPrecTM").value = prec.tm || "___________";
  document.getElementById("cfgPrecTT").value = prec.tt || "___________";
  document.getElementById("cfgPrecTV").value = prec.tv || "___________";

  const metaAct = obtenerMetaCurso(estado.cursoActual);
  const selEsp = document.getElementById("cfgEspecialidadHorario");
  const selAnio = document.getElementById("cfgAnioHorario");
  if (selEsp) {
    const espVal = (metaAct.modalidad && metaAct.modalidad !== "SIN_CLASIFICAR")
      ? metaAct.modalidad
      : (typeof detectarEspecialidadCurso === "function" ? detectarEspecialidadCurso(estado.cursoActual, estado.materias) : "ELECTROMECANICA");
    selEsp.value = espVal;
  }
  if (selAnio) {
    const aDet = metaAct.anio || (typeof detectarAnioDesdeNombreCurso === "function" ? detectarAnioDesdeNombreCurso(estado.cursoActual) : 0);
    selAnio.value = aDet ? String(aDet) : (selEsp && selEsp.value === "CICLO_BASICO" ? "1" : "4");
  }

  const [detG1, detG2] = detectarGruposTallerDelCurso();
  const defG1 = metaAct.grupoTaller1 ? normalizarGrupoLetra(metaAct.grupoTaller1) : detG1;
  const defG2 = metaAct.grupoTaller2 ? normalizarGrupoLetra(metaAct.grupoTaller2) : detG2;
  const selG1 = document.getElementById("cfgGrupoTaller1");
  const selG2 = document.getElementById("cfgGrupoTaller2");
  if (selG1) selG1.innerHTML = LETRAS_GRUPOS.map(l => `<option value="GRUPO ${l}" ${("GRUPO " + l) === defG1 ? "selected" : ""}>GRUPO ${l}</option>`).join("");
  if (selG2) selG2.innerHTML = LETRAS_GRUPOS.map(l => `<option value="GRUPO ${l}" ${("GRUPO " + l) === defG2 ? "selected" : ""}>GRUPO ${l}</option>`).join("");

  const bloquesActuales = (hp.bloques && hp.bloques.length > 0) ? hp.bloques : [];
  filasEditorHorarioTemp = bloquesActuales.map(b => {
    const turno = b.turno || (b.esTaller ? "TT - Taller" : "TT - Teoría");
    const mod = inferirModalidadDesdeTurno(turno);
    const horNorm = typeof normalizarHorario24hs === "function" ? normalizarHorario24hs(b.horario || "07:30 A 09:30") : (b.horario || "07:30 A 09:30");
    const tObj = typeof parsearHorarioTextoATime === "function" ? parsearHorarioTextoATime(horNorm) : { inicio: "07:30", fin: "09:30" };
    const esPreset = typeof esHorarioPredefinido === "function" ? esHorarioPredefinido(horNorm, turno) : true;

    let grp = "TEORÍA";
    if (mod === "ED_FISICA") grp = "CURSO";
    else if (mod === "TALLER") {
      const gNorm = normalizarGrupoLetra(b.grupo);
      grp = esGrupoSinAsignar(gNorm) || gNorm === "TEORÍA" || gNorm === "TEO" ? defG1 : gNorm;
    }

    return {
      dia: b.dia || "LUNES",
      horaInicio: tObj.inicio || "07:30",
      horaFin: tObj.fin || "09:30",
      horario: horNorm,
      esHorarioCustom: !esPreset,
      turno: turno,
      grupo: grp,
      materia: b.materia || "",
      profesor: b.profesor || "",
      modalidad: mod
    };
  });

  renderFilasEditorHorario();
  document.getElementById("modalConfigHorario").classList.add("open");
}

function cerrarModalConfigHorario() {
  document.getElementById("modalConfigHorario").classList.remove("open");
}

function alCambiarPlanEditorHorario() {
  sincronizarInputsEditorHorario();
  const selEsp = document.getElementById("cfgEspecialidadHorario");
  const selAnio = document.getElementById("cfgAnioHorario");
  if (selEsp && typeof guardarEspecialidadCursoLocal === "function") {
    guardarEspecialidadCursoLocal(estado.cursoActual, selEsp.value);
    const aVal = parseInt(selAnio?.value || "0", 10);
    if (selEsp.value === "CICLO_BASICO" && aVal > 3 && selAnio) selAnio.value = "1";
    if (selEsp.value !== "CICLO_BASICO" && aVal > 0 && aVal < 4 && selAnio) selAnio.value = "4";
  }
  renderFilasEditorHorario();
}

function sincronizarInputsEditorHorario() {
  const filasDOM = document.querySelectorAll(".schedule-editor-row");
  filasDOM.forEach((rowEl, idx) => {
    const item = filasEditorHorarioTemp[idx];
    if (!item) return;
    item.dia = rowEl.querySelector(".ed-dia")?.value || item.dia;
    item.turno = rowEl.querySelector(".ed-turno")?.value || item.turno;
    item.modalidad = inferirModalidadDesdeTurno(item.turno);

    const selPreset = rowEl.querySelector(".ed-horario-preset");
    if (selPreset && selPreset.value !== "__CUSTOM__") {
      item.esHorarioCustom = false;
      item.horario = selPreset.value;
      const tObj = parsearHorarioTextoATime(selPreset.value);
      item.horaInicio = tObj.inicio;
      item.horaFin = tObj.fin;
    } else {
      item.esHorarioCustom = true;
      const hIni = rowEl.querySelector(".ed-hora-ini-24")?.value || item.horaInicio || "07:30";
      const hFin = rowEl.querySelector(".ed-hora-fin-24")?.value || item.horaFin || "09:30";
      item.horaInicio = hIni;
      item.horaFin = hFin;
      item.horario = formatearHorarioDesdeTime(hIni, hFin);
    }

    if (item.modalidad === "TEORIA") {
      item.grupo = "TEORÍA";
    } else if (item.modalidad === "ED_FISICA") {
      item.grupo = "CURSO";
    } else {
      const selGrp = rowEl.querySelector(".ed-grupo-sel");
      if (selGrp) item.grupo = normalizarGrupoLetra(selGrp.value);
    }

    const selMat = rowEl.querySelector(".ed-materia");
    if (selMat && selMat.value !== "__MANUAL__") {
      item.materia = selMat.value;
    }
    item.profesor = (rowEl.querySelector(".ed-profesor")?.value || "").toUpperCase();
  });
}

function construirOpcionesHorario24HTML(item) {
  const presets = typeof obtenerPresetsParaTurno === "function"
    ? obtenerPresetsParaTurno(item.turno)
    : [];
  const horNorm = normalizarHorario24hs(item.horario);
  let matched = false;
  let html = "";

  presets.forEach(p => {
    const isSel = !item.esHorarioCustom && (p.val === horNorm);
    if (isSel) matched = true;
    html += `<option value="${p.val}" ${isSel ? "selected" : ""}>${p.lbl}</option>`;
  });

  const esCustom = item.esHorarioCustom || presets.length === 0 || !matched;
  html += `<option value="__CUSTOM__" ${esCustom ? "selected" : ""}>🕒 Personalizado (24hs)</option>`;
  return html;
}

function construirSelectHoras24HTML(valorSeleccionado) {
  const valNorm = String(valorSeleccionado || "07:30").trim();
  let encontrado = false;
  let html = "";
  (HORAS_24HS_LISTA || []).forEach(h => {
    if (h === valNorm) encontrado = true;
    html += `<option value="${h}" ${h === valNorm ? "selected" : ""}>${h}</option>`;
  });
  if (!encontrado && valNorm) {
    html = `<option value="${escHtml(valNorm)}" selected>${escHtml(valNorm)}</option>` + html;
  }
  return html;
}

function construirOpcionesMateriaEditorHTML(valorActual, modalidadFiltro) {
  const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
  const valTrim = String(valorActual || "").trim();
  const valNorm = norm(valTrim);
  const modBuscada = String(modalidadFiltro || "TEORIA").toUpperCase();

  const selEsp = document.getElementById("cfgEspecialidadHorario")?.value || "ELECTROMECANICA";
  const selAnio = document.getElementById("cfgAnioHorario")?.value || "";

  const yaIncluidas = new Set();
  let matched = false;
  let html = `<option value="">-- Elegir materia (${modBuscada === "TALLER" ? "Taller" : (modBuscada === "ED_FISICA" ? "Ed. Física" : "Teoría")}) --</option>`;

  if (modBuscada === "ED_FISICA") {
    const isSel = !valNorm || valNorm.indexOf("FISICA") !== -1;
    if (isSel) matched = true;
    html += `<option value="Educación Física" ${isSel ? "selected" : ""}>🏃 Educación Física</option>`;
    if (valTrim && !matched) {
      html += `<option value="${escHtml(valTrim)}" selected>${escHtml(valTrim)}</option>`;
    }
    html += `<option value="__MANUAL__">✏️ Otra materia (manual)...</option>`;
    return html;
  }

  const coincideModalidadPlanilla = (matObj) => {
    const nomUp = norm(matObj.nombre);
    if (nomUp.indexOf("EDUCACION FISICA") !== -1) return false;
    const esTal = typeof esMateriaDeTaller === "function" ? esMateriaDeTaller(matObj) : false;
    return modBuscada === "TALLER" ? esTal : !esTal;
  };

  // 1. Materias de la planilla de este curso filtradas por Teoría o Taller
  const matsPlanilla = (estado.materias || []).filter(m => !m.esResumenTallerCB && coincideModalidadPlanilla(m));
  if (matsPlanilla.length > 0) {
    html += `<optgroup label="📋 Planilla del curso (${modBuscada === "TALLER" ? "Taller" : "Teoría"})">`;
    matsPlanilla.forEach(m => {
      const nom = String(m.nombre || "").trim();
      const k = norm(nom);
      if (!k || yaIncluidas.has(k)) return;
      yaIncluidas.add(k);
      const isSel = (k === valNorm);
      if (isSel) matched = true;
      html += `<option value="${escHtml(nom)}" ${isSel ? "selected" : ""}>${escHtml(nom)}</option>`;
    });
    html += `</optgroup>`;
  }

  // 2. Diseño Curricular filtrado por Teoría o Taller
  if (typeof obtenerMateriasCatalogo === "function") {
    const cat = obtenerMateriasCatalogo(selEsp, selAnio)
      .filter(c => c.modalidad === modBuscada && !yaIncluidas.has(norm(c.nombre)));
    if (cat.length > 0) {
      const espLbl = (CATALOGO_CURRICULAR_EEST2[selEsp]?.label || selEsp) + (selAnio ? ` — ${selAnio}°` : "");
      html += `<optgroup label="📚 Diseño Curricular (${escHtml(espLbl)})">`;
      cat.forEach(c => {
        const k = norm(c.nombre);
        yaIncluidas.add(k);
        const isSel = (!matched && k === valNorm);
        if (isSel) matched = true;
        html += `<option value="${escHtml(c.nombre)}" ${isSel ? "selected" : ""}>${escHtml(c.nombre)}</option>`;
      });
      html += `</optgroup>`;
    }
  }

  if (valTrim && !matched) {
    html += `<optgroup label="📝 Nombre actual">`;
    html += `<option value="${escHtml(valTrim)}" selected>${escHtml(valTrim)}</option>`;
    html += `</optgroup>`;
  }

  html += `<option value="__MANUAL__">✏️ Otra materia (escribir manual)...</option>`;
  return html;
}

function alCambiarHorarioPresetEditor(idx, nuevoVal) {
  sincronizarInputsEditorHorario();
  const item = filasEditorHorarioTemp[idx];
  if (!item) return;
  if (nuevoVal === "__CUSTOM__") {
    item.esHorarioCustom = true;
  } else {
    item.esHorarioCustom = false;
    item.horario = nuevoVal;
    const tObj = parsearHorarioTextoATime(nuevoVal);
    item.horaInicio = tObj.inicio;
    item.horaFin = tObj.fin;
  }
  renderFilasEditorHorario();
}

function alCambiarMateriaEditorHorario(idx, nuevoVal) {
  sincronizarInputsEditorHorario();
  const item = filasEditorHorarioTemp[idx];
  if (!item) return;

  if (nuevoVal === "__MANUAL__") {
    const manual = prompt("Escribí el nombre exacto de la materia:", item.materia || "");
    if (manual && manual.trim()) {
      item.materia = manual.trim();
    }
  } else {
    item.materia = nuevoVal;
  }
  renderFilasEditorHorario();
}

function alCambiarTurnoEditorHorario(idx, nuevoTurno) {
  sincronizarInputsEditorHorario();
  const item = filasEditorHorarioTemp[idx];
  if (!item) return;
  const modAnterior = item.modalidad;
  const nuevaMod = inferirModalidadDesdeTurno(nuevoTurno);
  item.turno = nuevoTurno;
  item.modalidad = nuevaMod;

  if (nuevaMod === "ED_FISICA") {
    item.materia = "Educación Física";
    item.grupo = "CURSO";
  } else if (nuevaMod === "TEORIA") {
    item.grupo = "TEORÍA";
    if (modAnterior !== "TEORIA") item.materia = "";
  } else {
    const gruposCurso = obtenerGruposTallerActivosEditor();
    if (!gruposCurso.includes(normalizarGrupoLetra(item.grupo))) {
      item.grupo = gruposCurso[0] || "GRUPO A";
    }
    if (modAnterior !== "TALLER") item.materia = "";
  }

  const presetsNuevo = typeof obtenerPresetsParaTurno === "function" ? obtenerPresetsParaTurno(nuevoTurno) : [];
  if (presetsNuevo.length === 0) {
    item.esHorarioCustom = true;
    const defHor = obtenerHorarioDefectoParaTurno(nuevoTurno);
    const tObj = parsearHorarioTextoATime(defHor);
    item.horario = defHor;
    item.horaInicio = tObj.inicio;
    item.horaFin = tObj.fin;
  } else if (!esHorarioPredefinido(item.horario, nuevoTurno)) {
    item.esHorarioCustom = false;
    const defHor = presetsNuevo[0].val;
    const tObj = parsearHorarioTextoATime(defHor);
    item.horario = defHor;
    item.horaInicio = tObj.inicio;
    item.horaFin = tObj.fin;
  }

  renderFilasEditorHorario();
}

function renderFilasEditorHorario() {
  const cont = document.getElementById("contenedorFilasEditorHorario");
  if (!cont) return;

  const gruposTaller = obtenerGruposTallerActivosEditor();
  let html = "";

  filasEditorHorarioTemp.forEach((item, idx) => {
    const mod = inferirModalidadDesdeTurno(item.turno);
    item.modalidad = mod;
    const esCustom = item.esHorarioCustom || (typeof esHorarioPredefinido === "function" && !esHorarioPredefinido(item.horario, item.turno));

    let campoGrupoHTML = "";
    if (mod === "TEORIA") {
      campoGrupoHTML = `<div class="ed-grupo-fixed ed-grp-teo" title="Materia de Teoría (curso completo)">📘 TEORÍA</div>`;
    } else if (mod === "ED_FISICA") {
      campoGrupoHTML = `<div class="ed-grupo-fixed ed-grp-ef" title="Educación Física (curso completo)">🏃 CURSO</div>`;
    } else {
      const grpActual = normalizarGrupoLetra(item.grupo);
      const ops = [...gruposTaller];
      if (grpActual && !esGrupoSinAsignar(grpActual) && grpActual !== "TEORÍA" && grpActual !== "TEO" && !ops.includes(grpActual)) {
        ops.push(grpActual);
      }
      if (!ops.includes("AMBOS")) ops.push("AMBOS");
      campoGrupoHTML = `
        <select class="ed-grupo-sel" title="Grupo de Taller">
          ${ops.map(g => `<option value="${escHtml(g)}" ${g === grpActual ? "selected" : ""}>🔧 ${escHtml(g)}</option>`).join("")}
        </select>
      `;
    }

    html += `
      <div class="schedule-editor-row ${mod === "TALLER" ? "ser-taller" : (mod === "ED_FISICA" ? "ser-ef" : "ser-teoria")}">
        <select class="ed-dia" title="Día">
          ${DIAS_SEMANA_ORDEN.map(d => `<option value="${d}" ${item.dia === d ? 'selected' : ''}>${d}</option>`).join("")}
        </select>
        <div class="ed-horario-box">
          <select class="ed-horario-preset" title="Horario (24hs)" onchange="alCambiarHorarioPresetEditor(${idx}, this.value)">
            ${construirOpcionesHorario24HTML(item)}
          </select>
          ${esCustom ? `
          <div class="ed-time-range-24">
            <select class="ed-hora-ini-24" title="Hora inicio (24hs)">${construirSelectHoras24HTML(item.horaInicio)}</select>
            <span>a</span>
            <select class="ed-hora-fin-24" title="Hora fin (24hs)">${construirSelectHoras24HTML(item.horaFin)}</select>
          </div>` : ""}
        </div>
        <select class="ed-turno" title="Turno y Modalidad" onchange="alCambiarTurnoEditorHorario(${idx}, this.value)">
          ${["TM - Teoría", "TT - Teoría", "TV - Teoría", "TM - Taller", "TT - Taller", "TT/TV - Taller", "TV - Taller", "Educación Física"]
            .map(t => `<option value="${t}" ${item.turno === t ? 'selected' : ''}>${t}</option>`).join("")}
        </select>
        ${campoGrupoHTML}
        <select class="ed-materia" title="Materia" onchange="alCambiarMateriaEditorHorario(${idx}, this.value)">
          ${construirOpcionesMateriaEditorHTML(item.materia, mod)}
        </select>
        <input type="text" class="ed-profesor" placeholder="APELLIDO DOCENTE" value="${escHtml(item.profesor || '')}">
        <button type="button" class="btn-danger-outline" style="padding:5px;" title="Eliminar bloque" onclick="eliminarFilaEditorHorario(${idx})">🗑️</button>
      </div>
    `;
  });
  cont.innerHTML = html || `<p style="padding:10px; color:#64748b; font-size:12px;">Sin bloques cargados. Tocá "+ Bloque Teoría/Taller" o "+ Ed. Física".</p>`;
}

function agregarFilaEditorHorario(diaPorDefecto = "LUNES", tipoRapido = "TEORIA") {
  sincronizarInputsEditorHorario();
  const ultimo = filasEditorHorarioTemp[filasEditorHorarioTemp.length - 1];
  const diaUso = ultimo ? ultimo.dia : diaPorDefecto;

  if (tipoRapido === "ED_FISICA") {
    filasEditorHorarioTemp.push({
      dia: diaUso,
      horaInicio: "08:00",
      horaFin: "09:00",
      horario: "08:00 A 09:00",
      esHorarioCustom: true,
      turno: "Educación Física",
      grupo: "CURSO",
      materia: "Educación Física",
      profesor: "",
      modalidad: "ED_FISICA"
    });
  } else {
    const turnoUso = ultimo && ultimo.modalidad !== "ED_FISICA" ? ultimo.turno : "TM - Teoría";
    const modUso = inferirModalidadDesdeTurno(turnoUso);
    const horUso = typeof obtenerHorarioDefectoParaTurno === "function" ? obtenerHorarioDefectoParaTurno(turnoUso) : "07:30 A 09:30";
    const tObj = parsearHorarioTextoATime(horUso);
    const gruposTaller = obtenerGruposTallerActivosEditor();

    filasEditorHorarioTemp.push({
      dia: diaUso,
      horaInicio: tObj.inicio,
      horaFin: tObj.fin,
      horario: horUso,
      esHorarioCustom: (typeof obtenerPresetsParaTurno === "function" && obtenerPresetsParaTurno(turnoUso).length === 0),
      turno: turnoUso,
      grupo: modUso === "TALLER" ? (gruposTaller[0] || "GRUPO A") : "TEORÍA",
      materia: "",
      profesor: "",
      modalidad: modUso
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
  const sincronizarMat = false;

  try {
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "guardarHorarioParte",
        curso: estado.cursoActual,
        preceptores: preceptores,
        bloques: bloquesLimpios,
        sincronizarMateriasPlanilla: sincronizarMat,
        metadatosCurso: {
          modalidad: document.getElementById("cfgEspecialidadHorario")?.value || "",
          anio: parseInt(document.getElementById("cfgAnioHorario")?.value || "0", 10) || 0,
          grupoTaller1: document.getElementById("cfgGrupoTaller1")?.value || "",
          grupoTaller2: document.getElementById("cfgGrupoTaller2")?.value || ""
        }
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

let vistaActualApp = "asistencia";
const vistasSucias = { asistencia: true, parte: true, materia: true, alumno: true, actas: true, planilla: true };

function marcarVistasSucias(excluirVista = "") {
  Object.keys(vistasSucias).forEach(k => {
    if (k !== excluirVista) vistasSucias[k] = true;
  });
}

function renderizarVistaSiCorresponde(nombre) {
  if (nombre === "asistencia") {
    if (typeof renderListaAsistencia === "function") renderListaAsistencia();
    if (typeof renderTablaAcumuladoInasistencias === "function") renderTablaAcumuladoInasistencias();
    if (typeof renderHistorialAsistencias === "function") renderHistorialAsistencias();
  } else if (nombre === "parte") {
    if (typeof pdRenderCurrentSelection === "function") pdRenderCurrentSelection();
  } else if (nombre === "materia") {
    if (typeof renderVistaMateria === "function") renderVistaMateria();
  } else if (nombre === "alumno") {
    if (typeof renderVistaAlumno === "function") renderVistaAlumno();
  } else if (nombre === "actas") {
    if (typeof renderVistaActas === "function") renderVistaActas();
  } else if (nombre === "planilla") {
    if (typeof renderTablaCompleta === "function") renderTablaCompleta();
  }
  vistasSucias[nombre] = false;
}

// Limpiar cualquier caché local vieja de cursos que haya quedado guardada
try {
  Object.keys(localStorage).forEach(k => {
    if (k.indexOf("eest2_cache_") === 0) localStorage.removeItem(k);
  });
} catch (e) {}

function mostrarVista(nombre) {
  const permitidas = obtenerPestanasPermitidasActual();
  if (!permitidas.includes(nombre)) {
    nombre = permitidas[0] || "materia";
  }
  vistaActualApp = nombre;
  ["asistencia", "parte", "materia", "alumno", "actas", "planilla"].forEach(v => {
    const sec = document.getElementById(`vista-${v}`);
    const btn = document.getElementById(`tabBtn-${v}`);
    const permitido = permitidas.includes(v);
    if (sec) sec.classList.toggle("hidden", v !== nombre);
    if (btn) {
      btn.style.display = permitido ? "" : "none";
      btn.classList.toggle("active", v === nombre);
    }
  });
  if (vistasSucias[nombre] || nombre === "parte" || nombre === "actas") {
    renderizarVistaSiCorresponde(nombre);
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
      document.getElementById("lblActiveUserRole").textContent = obtenerRolesActuales().join(" + ");
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

  poblarSelectorCursosAgrupado(data.cursos || [], data.cursoActual);

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

  // Ajustar botones del encabezado según rol(es)
  const btnMisAsig = document.getElementById("btnMisAsignaciones");
  if (btnMisAsig) btnMisAsig.style.display = (!esFam) ? "inline-flex" : "none";

  const puedeEditarMatricula = esPreceptorEnCursoActual() || tieneRolActual("SECRETARIA");
  const puedeConfigHor = esPreceptorEnCursoActual();
  const btnHor = document.getElementById("btnHeaderHorariosModal");
  if (btnHor) btnHor.style.display = (!esFam && puedeConfigHor) ? "inline-flex" : "none";

  document.querySelectorAll("#headerStaffControlsBar button").forEach(b => {
    if (b.id === "btnHeaderNuevoCurso") {
      b.style.display = (!esFam && esJefe) ? "inline-flex" : "none";
    } else {
      b.style.display = (!esFam && puedeEditarMatricula) ? "inline-flex" : "none";
    }
  });

  const tabsPerm = obtenerPestanasPermitidasActual();
  if (!tabsPerm.includes(vistaActualApp)) {
    vistaActualApp = tabsPerm[0] || "materia";
  }

  marcarVistasSucias();
  mostrarVista(vistaActualApp);
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


function abrirModalAsignarGrupos() {
  const modal = document.getElementById("modalAsignarGrupos");
  if (!modal) return;
  const lbl = document.getElementById("lblCursoAsignarGrupos");
  if (lbl) lbl.textContent = (estado.cursoActual || "").replace(/_/g, " ");

  const selA = document.getElementById("selMitadGrupo1");
  const selB = document.getElementById("selMitadGrupo2");
  if (selA) selA.innerHTML = LETRAS_GRUPOS.map(l => `<option value="GRUPO ${l}" ${l === "A" ? "selected" : ""}>GRUPO ${l}</option>`).join("");
  if (selB) selB.innerHTML = LETRAS_GRUPOS.map(l => `<option value="GRUPO ${l}" ${l === "B" ? "selected" : ""}>GRUPO ${l}</option>`).join("");

  renderListaAsignarGrupos();
  modal.classList.add("open");
}

function cerrarModalAsignarGrupos() {
  const modal = document.getElementById("modalAsignarGrupos");
  if (modal) modal.classList.remove("open");
}

function renderListaAsignarGrupos() {
  const cont = document.getElementById("contenedorListaAsignarGrupos");
  if (!cont) return;
  const activos = (estado.estudiantes || []).filter(e => !esEstudianteTachado(e));
  if (activos.length === 0) {
    cont.innerHTML = `<p style="padding:12px; color:#64748b;">No hay estudiantes activos en este curso.</p>`;
    return;
  }

  let html = "";
  activos.forEach(est => {
    const grpNorm = normalizarGrupoLetra(est.grupo);
    html += `
      <div class="assign-grp-row">
        <div class="assign-grp-name"><strong>${est.orden}.</strong> ${escHtml(est.nombre)}</div>
        <select class="assign-grp-select" data-fila="${est.filaHoja}" data-orig="${escHtml(grpNorm)}">
          ${generarOpcionesGruposHTML(grpNorm)}
        </select>
      </div>
    `;
  });
  cont.innerHTML = html;
}

function aplicarDivisionMitadGrupos() {
  const g1 = document.getElementById("selMitadGrupo1")?.value || "GRUPO A";
  const g2 = document.getElementById("selMitadGrupo2")?.value || "GRUPO B";
  const selects = Array.from(document.querySelectorAll(".assign-grp-select"));
  if (selects.length === 0) return;
  const mitad = Math.ceil(selects.length / 2);
  selects.forEach((sel, idx) => {
    sel.value = idx < mitad ? g1 : g2;
  });
  mostrarToast(`Preasignado: primeros ${mitad} a ${g1} y resto a ${g2}. Tocá Guardar para confirmar.`);
}

async function guardarGruposMasivoEnSheets() {
  const selects = Array.from(document.querySelectorAll(".assign-grp-select"));
  const cambios = [];
  selects.forEach(sel => {
    const filaHoja = Number(sel.dataset.fila);
    const nuevoGrp = normalizarGrupoLetra(sel.value);
    const origGrp = normalizarGrupoLetra(sel.dataset.orig);
    if (nuevoGrp !== origGrp) {
      cambios.push({ filaHoja, nuevoGrp });
    }
  });

  if (cambios.length === 0) {
    cerrarModalAsignarGrupos();
    mostrarToast("No hubo cambios de grupo");
    return;
  }

  const btn = document.getElementById("btnGuardarGruposMasivo");
  try {
    if (btn) { btn.disabled = true; btn.textContent = `Guardando (${cambios.length})...`; }
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "actualizarCeldasLote",
        curso: estado.cursoActual,
        cambios: cambios.map(c => ({ filaHoja: c.filaHoja, columnaHoja: 3, valor: c.nuevoGrp }))
      })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);

    cambios.forEach(c => {
      const est = (estado.estudiantes || []).find(e => e.filaHoja === c.filaHoja);
      if (est) est.grupo = c.nuevoGrp;
    });

    aplicarDatosRecibidos(estado, true);
    cerrarModalAsignarGrupos();
    mostrarToast(`✅ ${cambios.length} grupo(s) guardados en 1 lote`);
  } catch (err) {
    mostrarToast("⚠️ Error al guardar grupos: " + err.message, 4000);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "💾 Guardar Grupos"; }
  }
}

async function asignarGrupoRapidoEstudiante(filaHoja, valorElegido) {
  const nuevoGrp = normalizarGrupoLetra(valorElegido);
  if (nuevoGrp === "SIN ASIGNAR") return;
  const est = (estado.estudiantes || []).find(e => e.filaHoja === Number(filaHoja));
  if (!est) return;

  try {
    mostrarToast(`⏳ Asignando ${nuevoGrp}...`);
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "actualizarCelda",
        curso: estado.cursoActual,
        filaHoja: est.filaHoja,
        columnaHoja: 3,
        valor: nuevoGrp
      })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);

    est.grupo = nuevoGrp;
    aplicarDatosRecibidos(estado, true);
    mostrarToast(`✅ ${est.nombre} ➔ ${nuevoGrp}`);
  } catch (err) {
    mostrarToast("⚠️ Error: " + err.message, 4000);
  }
}


let coincidenciasHorariosCache = { cursosPreceptor: [], materiasDocente: [] };

async function abrirModalMisAsignaciones() {
  if (esRolFamiliaActual() || !estado.usuarioActual) return;
  const modal = document.getElementById("modalMisAsignaciones");
  if (!modal) return;

  const roles = obtenerRolesActuales();
  const emailTxt = estado.usuarioActual.emailAbc ? ` • 📧 ${escHtml(estado.usuarioActual.emailAbc)}` : "";
  const badgesRolesHTML = roles.map(r => {
    const btnQuitar = roles.length > 1
      ? ` <button type="button" title="Quitar rol ${escHtml(r)}" style="border:none; background:none; color:#b91c1c; font-weight:900; cursor:pointer; padding:0 2px; margin-left:3px;" onclick="quitarRolPropioUI('${escHtml(r)}')">✖</button>`
      : "";
    return `<span class="badge badge-grp" style="display:inline-flex; align-items:center; margin-right:4px;">${escHtml(r)}${btnQuitar}</span>`;
  }).join("");
  const ayudaQuitar = roles.length > 1
    ? `<div style="font-size:11px; color:#64748b; margin-top:4px;">Si cargaste un cargo por error, tocá la <b>✖</b> del rol que quieras remover.</div>`
    : "";
  document.getElementById("misAsigResumenRoles").innerHTML =
    `<strong>👤 ${escHtml(estado.usuarioActual.nombre)}</strong> — Roles activos: ${badgesRolesHTML}${emailTxt}${ayudaQuitar}`;

  const boxRol2 = document.getElementById("misAsigBoxSegundoRol");
  if (boxRol2) {
    boxRol2.style.display = roles.length < 2 ? "block" : "none";
    const inpR2 = document.getElementById("misAsigCodigoRol2");
    if (inpR2) inpR2.value = "";
  }

  const esPR = roles.includes("PRECEPTOR") && !tieneAlgunRolActual(["ADMIN", "DIRECTIVO", "JEFE_PR", "SECRETARIA", "EOE"]);
  const esDoc = roles.includes("DOCENTE");
  document.getElementById("misAsigBoxPreceptor").style.display = esPR ? "block" : "none";
  document.getElementById("misAsigBoxDocente").style.display = esDoc ? "block" : "none";

  // Mostrar cursos actuales de Preceptor (solo lectura)
  const contPR = document.getElementById("misAsigListaCursosPR");
  if (esPR && contPR) {
    const misCursos = (estado.usuarioActual.cursosPermitidos || []).filter(Boolean);
    contPR.innerHTML = misCursos.length > 0
      ? misCursos.map(c => `<span class="badge badge-ok" style="font-size:12px; padding:5px 9px;">🏫 ${escHtml(c.replace(/_/g, " "))}</span>`).join("")
      : `<span style="font-size:12px; color:#b45309;">Aún no tenés cursos detectados. Verificá que tu apellido + inicial figure en Horarios Parte y tocá <b>🔄 Sincronizar desde Horarios</b>.</span>`;
  }

  const contDoc = document.getElementById("misAsigListaMateriasDoc");
  if (esDoc && contDoc) {
    contDoc.innerHTML = `<span style="font-size:12px; color:#64748b;">⏳ Buscando tus materias en los Partes Diarios...</span>`;
  }

  modal.classList.add("open");

  if (esDoc) {
    try {
      const resp = await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ accion: "obtenerMisCoincidenciasHorarios" })
      });
      const json = await resp.json();
      if (!json.ok) throw new Error(json.error);
      coincidenciasHorariosCache = json.coincidencias || { cursosPreceptor: [], materiasDocente: [] };
      renderListaMateriasDocenteCoincidentes();
    } catch (err) {
      if (contDoc) contDoc.innerHTML = `<span style="font-size:12px; color:#b91c1c;">⚠️ Error al buscar en horarios: ${escHtml(err.message)}</span>`;
    }
  }
}

function cerrarModalMisAsignaciones() {
  const modal = document.getElementById("modalMisAsignaciones");
  if (modal) modal.classList.remove("open");
}

function renderListaMateriasDocenteCoincidentes() {
  const cont = document.getElementById("misAsigListaMateriasDoc");
  if (!cont) return;
  const candidatas = (coincidenciasHorariosCache && coincidenciasHorariosCache.materiasDocente) || [];
  const activas = (estado.usuarioActual && estado.usuarioActual.materiasDocente) || [];

  if (candidatas.length === 0) {
    cont.innerHTML = `<span style="font-size:12px; color:#92400e;">No se encontraron coincidencias para <b>${escHtml(estado.usuarioActual?.nombre || "")}</b> en los horarios del Parte Diario. Verificá con Preceptoría cómo figura tu apellido + inicial.</span>`;
    return;
  }

  const normKey = (c, m) => `${String(c).toLowerCase()}::${String(m).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/gi, "").toUpperCase()}`;
  const setActivas = new Set(activas.map(a => normKey(a.curso, a.materia)));

  cont.innerHTML = candidatas.map((item, idx) => {
    const chk = (activas.length === 0 || setActivas.has(normKey(item.curso, item.materia))) ? "checked" : "";
    return `
      <label style="display:flex; align-items:center; justify-content:space-between; gap:8px; padding:6px 8px; background:#fffbeb; border:1px solid #fde68a; border-radius:6px; cursor:pointer; font-size:12px;">
        <span style="display:flex; align-items:center; gap:7px;">
          <input type="checkbox" class="chk-mis-mats-doc" data-curso="${escHtml(item.curso)}" data-materia="${escHtml(item.materia)}" ${chk}>
          <span><strong>${escHtml(item.curso.replace(/_/g, " "))}</strong> — ${escHtml(item.materia)}</span>
        </span>
        <small style="color:#64748b; font-weight:700;">Parte: ${escHtml(item.profesorHorario || "")}</small>
      </label>
    `;
  }).join("");
}

async function sincronizarMisAsignacionesDesdeHorariosUI() {
  const btn = document.getElementById("btnGuardarMisAsignaciones");
  try {
    mostrarToast("⏳ Sincronizando desde Horarios Parte...");
    if (btn) btn.disabled = true;
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "actualizarMisAsignaciones",
        curso: estado.cursoActual || "",
        sincronizarDesdeHorarios: true
      })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);

    aplicarDatosRecibidos(json.data, false);
    actualizarSubtituloHeader();
    await abrirModalMisAsignaciones();
    mostrarToast(`✅ Sincronizado (${json.detalle || "OK"})`, 3500);
  } catch (err) {
    mostrarToast("⚠️ Error: " + err.message, 4000);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function guardarMisAsignacionesUI() {
  const roles = obtenerRolesActuales();
  const codigoSegundoRol = document.getElementById("misAsigCodigoRol2")?.value.trim() || "";
  const esDoc = roles.includes("DOCENTE");

  const payload = {
    accion: "actualizarMisAsignaciones",
    curso: estado.cursoActual || ""
  };
  if (codigoSegundoRol) payload.codigoSegundoRol = codigoSegundoRol;
  if (esDoc) {
    payload.materiasDocente = Array.from(document.querySelectorAll(".chk-mis-mats-doc:checked")).map(cb => ({
      curso: cb.dataset.curso,
      materia: cb.dataset.materia
    }));
  }

  const btn = document.getElementById("btnGuardarMisAsignaciones");
  try {
    if (btn) { btn.disabled = true; btn.textContent = "Guardando..."; }
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);

    aplicarDatosRecibidos(json.data, false);
    actualizarSubtituloHeader();
    cerrarModalMisAsignaciones();
    mostrarToast("✅ Asignaciones guardadas");
  } catch (err) {
    mostrarToast("⚠️ Error: " + err.message, 4000);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "💾 Guardar Mis Asignaciones"; }
  }
}


async function quitarRolPropioUI(rolAQuitar) {
  const roles = obtenerRolesActuales();
  if (roles.length <= 1) return mostrarToast("No podés quitar tu único rol activo.");
  if (!confirm(`¿Seguro que querés remover el rol "${rolAQuitar}" de tu cuenta?`)) return;

  try {
    mostrarToast(`⏳ Removiendo rol ${rolAQuitar}...`);
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "actualizarMisAsignaciones",
        curso: estado.cursoActual || "",
        quitarRol: rolAQuitar
      })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);

    aplicarDatosRecibidos(json.data, false);
    actualizarSubtituloHeader();
    await abrirModalMisAsignaciones();
    mostrarToast(`✅ Rol "${rolAQuitar}" removido de tu cuenta`);
  } catch (err) {
    mostrarToast("⚠️ Error: " + err.message, 4000);
  }
}


let usuarioEnRecuperacionClave = "";

function abrirRecuperarClaveLogin() {
  document.getElementById("loginStepWelcome").style.display = "none";
  document.getElementById("loginStepForm").style.display = "none";
  document.getElementById("loginStepRegister").style.display = "none";
  document.getElementById("loginStepRecover").style.display = "block";
  document.getElementById("recSubStep1").style.display = "block";
  document.getElementById("recSubStep2").style.display = "none";
  mostrarErrorRecuperar("");
  const prevUser = document.getElementById("authInputUser")?.value.trim() || "";
  const inpRec = document.getElementById("recInputId");
  if (inpRec) {
    inpRec.value = prevUser;
    setTimeout(() => inpRec.focus(), 60);
  }
}

function volverALoginDesdeRecuperar() {
  seleccionarModoLogin(modoLoginSeleccionado || "PERSONAL");
}

function mostrarErrorRecuperar(msg) {
  const err = document.getElementById("recErrorBanner");
  if (!err) return;
  if (msg) {
    err.textContent = msg;
    err.style.display = "block";
  } else {
    err.style.display = "none";
  }
}

async function solicitarPinRecuperarClave() {
  mostrarErrorRecuperar("");
  const identificador = document.getElementById("recInputId")?.value.trim() || "";
  if (!identificador) return mostrarErrorRecuperar("Ingresá tu usuario, DNI o correo.");

  const btn = document.getElementById("btnRecSolicitarPin");
  try {
    if (btn) { btn.disabled = true; btn.textContent = "⏳ Enviando código..."; }
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "solicitarRecuperacionClave",
        identificador: identificador
      })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);

    usuarioEnRecuperacionClave = json.resultado.usuario;
    document.getElementById("recLblEmailMask").textContent = json.resultado.emailEnmascarado;
    document.getElementById("recSubStep1").style.display = "none";
    document.getElementById("recSubStep2").style.display = "block";
    document.getElementById("recInputPin").value = "";
    document.getElementById("recInputPass1").value = "";
    document.getElementById("recInputPass2").value = "";
    setTimeout(() => document.getElementById("recInputPin").focus(), 60);
  } catch (err) {
    mostrarErrorRecuperar(err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "📧 Enviar código de recuperación"; }
  }
}

async function confirmarPinRecuperarClave() {
  mostrarErrorRecuperar("");
  const pin = document.getElementById("recInputPin")?.value.trim() || "";
  const p1 = document.getElementById("recInputPass1")?.value.trim() || "";
  const p2 = document.getElementById("recInputPass2")?.value.trim() || "";

  if (!pin || pin.length < 6) return mostrarErrorRecuperar("Ingresá el código de 6 dígitos recibido en tu correo.");
  if (p1.length < 6) return mostrarErrorRecuperar("La nueva contraseña debe tener al menos 6 caracteres.");
  if (p1 !== p2) return mostrarErrorRecuperar("Las contraseñas no coinciden.");

  const btn = document.getElementById("btnRecConfirmar");
  try {
    if (btn) { btn.disabled = true; btn.textContent = "⏳ Guardando..."; }
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "confirmarRecuperacionClave",
        usuario: usuarioEnRecuperacionClave,
        pin: pin,
        nuevaClave: p1
      })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);

    volverALoginDesdeRecuperar();
    const inpUser = document.getElementById("authInputUser");
    if (inpUser) inpUser.value = usuarioEnRecuperacionClave;
    const inpPass = document.getElementById("authInputPass");
    if (inpPass) { inpPass.value = ""; inpPass.focus(); }
    mostrarToast("✅ Contraseña restablecida. Ya podés ingresar.", 4000);
  } catch (err) {
    mostrarErrorRecuperar(err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "✅ Guardar Nueva Contraseña"; }
  }
}
