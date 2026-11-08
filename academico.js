/* ==================== CLASIFICACIÓN Y ORDENAMIENTO VISUAL DE MATERIAS ==================== */
function obtenerMapaTiposMateriasLocal() {
  try {
    return JSON.parse(localStorage.getItem("eest2_tipos_materias") || "{}");
  } catch (e) {
    return {};
  }
}

function esMateriaDeTaller(mat) {
  if (!mat) return false;
  const clave = `${estado.cursoActual || "curso"}_${mat.indice}`;
  const mapaManual = obtenerMapaTiposMateriasLocal();
  if (mapaManual[clave]) {
    return mapaManual[clave] === "TALLER";
  }

  if (mat.esSubTallerCB || mat.esResumenTallerCB) return true;

  const nom = String(mat.nombre || "").toLowerCase();
  const bloquesSheet = (estado.horarioParte && estado.horarioParte.bloques) || [];
  const coincidenciaSheet = bloquesSheet.find(b =>
    b.materia && nom.indexOf(b.materia.toLowerCase()) !== -1
  );
  if (coincidenciaSheet) {
    return coincidenciaSheet.modalidad === "TALLER" || Boolean(coincidenciaSheet.esTaller);
  }

  const palabrasTaller = [
    "taller", "máquinas", "maquinas", "automatismo", "instalaciones",
    "energía", "energia", "diseño y proc", "procesamiento mec", "proc. mec",
    "procedimientos téc", "procedimientos tec", "proc. tec",
    "lenguajes tec", "leng. tec", "sistemas tec", "sist. tec",
    "prácticas prof", "practicas prof", "entorno"
  ];
  return palabrasTaller.some(p => nom.indexOf(p) !== -1);
}

function obtenerMateriasOrdenadasVisualmente() {
  const lista = [...(estado.materias || [])];
  return lista.sort((a, b) => {
    const peso = (m) => {
      if (m.esResumenTallerCB) return 2;
      return esMateriaDeTaller(m) ? 1 : 0;
    };
    const pa = peso(a);
    const pb = peso(b);
    if (pa !== pb) return pa - pb;
    return a.indice - b.indice;
  });
}

function poblarSelectorMateriasOrdenado(valorPrevio) {
  const selMat = document.getElementById("materiaSelect");
  if (!selMat) return;
  selMat.innerHTML = "";

  const ordenadas = obtenerMateriasOrdenadasVisualmente();
  const teo = ordenadas.filter(m => !esMateriaDeTaller(m));
  const tal = ordenadas.filter(m => esMateriaDeTaller(m));

  if (teo.length > 0) {
    const grpTeo = document.createElement("optgroup");
    grpTeo.label = "📘 MATERIAS DE TEORÍA";
    teo.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m.indice;
      opt.textContent = `📘 ${m.nombre}`;
      grpTeo.appendChild(opt);
    });
    selMat.appendChild(grpTeo);
  }

  if (tal.length > 0) {
    const grpTal = document.createElement("optgroup");
    grpTal.label = "🔧 MATERIAS DE TALLER";
    tal.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m.indice;
      opt.textContent = `🔧 ${m.nombre}`;
      grpTal.appendChild(opt);
    });
    selMat.appendChild(grpTal);
  }

  if (valorPrevio !== undefined && [...selMat.options].some(o => o.value === String(valorPrevio))) {
    selMat.value = valorPrevio;
  }
}

function alternarTipoMateriaTallerTeoria(indiceMat) {
  const mat = (estado.materias || []).find(m => m.indice === Number(indiceMat));
  if (!mat) return;
  const clave = `${estado.cursoActual || "curso"}_${mat.indice}`;
  const mapaManual = obtenerMapaTiposMateriasLocal();
  const actualEsTaller = esMateriaDeTaller(mat);
  mapaManual[clave] = actualEsTaller ? "TEORIA" : "TALLER";
  localStorage.setItem("eest2_tipos_materias", JSON.stringify(mapaManual));

  const matSelPrevia = document.getElementById("materiaSelect")?.value;
  poblarSelectorMateriasOrdenado(matSelPrevia);
  renderVistaMateria();
  renderVistaAlumno();
  renderTablaCompleta();
  mostrarToast(`🔄 "${mat.nombre}" pasada a ${mapaManual[clave] === "TALLER" ? "🔧 Taller" : "📘 Teoría"}`);
}

/* ==================== COLORES DE VALORACIONES Y CALIFICACIONES NUMÉRICAS ==================== */
function obtenerClaseColorNota(valor) {
  const v = String(valor === undefined || valor === null ? "" : valor).trim().toUpperCase();
  if (!v || v === "-") return "";

  if (v === "TEA") return "val-TEA";
  if (v === "TEP") return "val-TEP";
  if (v === "TED") return "val-TED";
  if (v === "AUS") return "cal-rojo";

  const num = parseFloat(v.replace(",", "."));
  if (!isNaN(num)) {
    if (num >= 1 && num <= 3) return "cal-rojo";
    if (num >= 4 && num <= 6) return "cal-verde";
    if (num >= 7 && num <= 10) return "cal-azul";
  }
  return "";
}

function fechaCortaDDMM(fechaStr) {
  const norm = normalizarFechaDDMMYYYY(fechaStr);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(norm)) return norm.slice(0, 5);
  return norm;
}

function turnoPerteneceATaller(turnoStr) {
  const t = String(turnoStr || "").toLowerCase();
  return t.indexOf("taller") !== -1 || t.indexOf("grupo ") !== -1 || t.indexOf("gr.") !== -1;
}

function textoNominaContieneEstudiante(textoNomina, est) {
  if (!textoNomina) return false;
  const limp = String(textoNomina).split("| Obs:")[0].trim();
  if (!limp || limp.toLowerCase().indexOf("sin ") === 0) return false;

  const items = limp.split("|").map(s => s.trim()).filter(Boolean);
  const ordStr = String(est.orden || "").trim();
  const ordPad = ordStr.padStart(2, "0");
  const nomEstLower = String(est.nombre || "").trim().toLowerCase();

  for (const item of items) {
    const itemLow = item.toLowerCase();
    if (nomEstLower && itemLow.indexOf(nomEstLower) !== -1) return true;
    const mOrd = item.match(/^(?:Orden\s*N°\s*)?0*(\d+)[\.\s]/i);
    if (mOrd && mOrd[1] === ordStr) return true;
    if (item.startsWith(`${ordPad}.`) || item.startsWith(`${ordStr}.`)) return true;
  }
  return false;
}

function obtenerFechasInasistenciasEstudiante(est) {
  const hist = estado.historialAsistencias || [];
  const teoSet = new Set();
  const talSet = new Set();

  const copiaHist = [...hist].reverse();
  copiaHist.forEach(item => {
    const fCorta = fechaCortaDDMM(item.fecha);
    if (!fCorta) return;
    const esTal = turnoPerteneceATaller(item.turnoGrupo);

    const estuvoAusente = textoNominaContieneEstudiante(item.nominaAusentes, est);
    const llegoTarde = textoNominaContieneEstudiante(item.nominaTardes, est);

    if (estuvoAusente) {
      if (esTal) talSet.add(fCorta);
      else teoSet.add(fCorta);
    } else if (llegoTarde) {
      if (esTal) talSet.add(`${fCorta}(T)`);
      else teoSet.add(`${fCorta}(T)`);
    }
  });

  return { teoria: Array.from(teoSet), taller: Array.from(talSet) };
}

function obtenerResumenMensualAbreviado(est) {
  if (!est.inasistencias || !est.inasistencias.meses) return "";
  const partes = [];
  MESES_LISTA.forEach(m => {
    const v = Number(est.inasistencias.meses[m] || 0);
    if (v > 0) partes.push(`${m.slice(0, 3)}:${v}`);
  });
  return partes.join(" | ");
}

// Privacidad estricta en el Parte Diario grupal: únicamente por N° de Orden de lista
function formatearEstudianteParaWhatsApp(est) {
  const ordStr = String(est.orden || "").padStart(2, "0");
  const grp = est.grupo ? ` (${est.grupo})` : "";
  return `Orden N° ${ordStr}${grp}`;
}

function esEstudianteTachado(est) {
  const st = String(est.estado || "Activo").toLowerCase();
  return st.indexOf("tachado") !== -1 || st.indexOf("baja") !== -1 || st.indexOf("pase") !== -1;
}

function inicializarFechaHoy() {
  const hoy = new Date();
  const yyyy = hoy.getFullYear();
  const mm = String(hoy.getMonth() + 1).padStart(2, "0");
  const dd = String(hoy.getDate()).padStart(2, "0");
  const inpF = document.getElementById("asistFecha");
  if (inpF) inpF.value = `${yyyy}-${mm}-${dd}`;
  const selM = document.getElementById("pdMonthSelect");
  if (selM) selM.value = String(hoy.getMonth());
  const inpY = document.getElementById("pdYearInput");
  if (inpY) inpY.value = String(yyyy);
  sincronizarMesDesdeFecha();
}

function sincronizarMesDesdeFecha() {
  const val = document.getElementById("asistFecha")?.value;
  if (!val) return;
  const partes = val.split("-");
  const numMes = parseInt(partes[1], 10);
  const mapaNumAMes = {
    3: "Marzo", 4: "Abril", 5: "Mayo", 6: "Junio", 7: "Julio",
    8: "Agosto", 9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"
  };
  if (mapaNumAMes[numMes]) {
    document.getElementById("asistMes").value = mapaNumAMes[numMes];
  }
}

function normalizarFechaDDMMYYYY(valor) {
  if (!valor) return "";
  const str = String(valor).trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const [d, m, y] = str.split("/");
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split("-");
    return `${d}/${m}/${y}`;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const dd = String(parsed.getDate()).padStart(2, "0");
    const mm = String(parsed.getMonth() + 1).padStart(2, "0");
    const yyyy = parsed.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
  return str;
}

function alCambiarFechaOTurno() {
  sincronizarMesDesdeFecha();
  cargarParteGuardadoSiExiste();
  renderListaAsistencia();
}

function cargarParteGuardadoSiExiste() {
  asistenciaActual = {};
  (estado.estudiantes || []).forEach(est => { asistenciaActual[est.filaHoja] = "P"; });

  const fechaBuscada = formatearFechaInput();
  const turnoBuscado = (document.getElementById("asistTurnoGrupo").value || "").split("|")[0].trim();
  const banner = document.getElementById("bannerEstadoParte");

  const registroExistente = (estado.historialAsistencias || []).find(item => {
    const fItem = normalizarFechaDDMMYYYY(item.fecha);
    const tItem = String(item.turnoGrupo || "").trim();
    return fItem === fechaBuscada && tItem === turnoBuscado;
  });

  if (!registroExistente) {
    if (banner) {
      banner.className = "edit-mode-banner new-entry";
      banner.textContent = `🆕 Parte nuevo para ${fechaBuscada} (${turnoBuscado}).`;
    }
    return false;
  }

  const textoAus = String(registroExistente.nominaAusentes || "");
  if (textoAus && textoAus.toLowerCase() !== "sin ausentes") {
    textoAus.split("|").map(s => s.trim()).forEach(itemStr => marcarEstudianteDesdeTextoHistorial(itemStr, "A"));
  }

  let textoTar = String(registroExistente.nominaTardes || "");
  let obsGuardada = "";
  if (textoTar.indexOf("| Obs:") !== -1) {
    const divObs = textoTar.split("| Obs:");
    textoTar = divObs[0].trim();
    obsGuardada = (divObs[1] || "").replace(/\s*\[ValAus:[0-9.]+\]/g, "").trim();
  }
  document.getElementById("asistObs").value = obsGuardada;

  if (textoTar && textoTar.toLowerCase() !== "sin tardes") {
    textoTar.split("|").map(s => s.trim()).forEach(itemStr => marcarEstudianteDesdeTextoHistorial(itemStr, "T"));
  }

  if (banner) {
    banner.className = "edit-mode-banner saved";
    banner.textContent = `📌 Viendo parte guardado del ${fechaBuscada} (${turnoBuscado}).`;
  }
  return true;
}

function marcarEstudianteDesdeTextoHistorial(itemStr, letraEstado) {
  if (!itemStr) return;
  const matchOrden = itemStr.match(/^(\d+)\.\s*(.+)$/);
  const limpios = (estado.estudiantes || []);

  if (matchOrden) {
    const numOrd = String(matchOrden[1]).trim();
    const restoNombre = matchOrden[2].replace(/\s*\([^)]*\)\s*$/, "").trim().toLowerCase();
    let encontrado = limpios.find(e => String(e.orden).trim() === numOrd && e.nombre.trim().toLowerCase() === restoNombre) ||
                     limpios.find(e => String(e.orden).trim() === numOrd) ||
                     limpios.find(e => e.nombre.trim().toLowerCase() === restoNombre);
    if (encontrado) {
      asistenciaActual[encontrado.filaHoja] = letraEstado;
      return;
    }
  }

  const itemLower = itemStr.toLowerCase();
  const porNombre = limpios.find(e => e.nombre && itemLower.indexOf(e.nombre.trim().toLowerCase()) !== -1);
  if (porNombre) asistenciaActual[porNombre.filaHoja] = letraEstado;
}

function cargarParteDesdeFilaHistorial(indexHist) {
  const item = (estado.historialAsistencias || [])[indexHist];
  if (!item) return;

  const fechaNorm = normalizarFechaDDMMYYYY(item.fecha);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(fechaNorm)) {
    const [dd, mm, yyyy] = fechaNorm.split("/");
    document.getElementById("asistFecha").value = `${yyyy}-${mm}-${dd}`;
    sincronizarMesDesdeFecha();
  }

  const selTurno = document.getElementById("asistTurnoGrupo");
  const opcionMatch = [...selTurno.options].find(o => o.value.split("|")[0].trim() === String(item.turnoGrupo || "").trim());
  if (opcionMatch) selTurno.value = opcionMatch.value;

  cargarParteGuardadoSiExiste();
  renderListaAsistencia();
  window.scrollTo({ top: 0, behavior: "smooth" });
  mostrarToast(`📂 Parte del ${fechaNorm} cargado`);
}

function guardarPreceptorLocal() {
  localStorage.setItem("eest2_preceptor", document.getElementById("asistPreceptor").value);
  actualizarVistaPreviaWA();
}

async function alternarEstadoTachado(filaHoja) {
  const est = (estado.estudiantes || []).find(e => e.filaHoja === Number(filaHoja));
  if (!est) return;

  const estabaTachado = esEstudianteTachado(est);
  const nuevoEstado = estabaTachado ? "Activo" : "Tachado en lista";
  if (!confirm(`¿${estabaTachado ? "Reactivar" : "Tachar"} a ${est.orden}. ${est.nombre}?`)) return;

  try {
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ accion: "actualizarCelda", curso: estado.cursoActual, filaHoja: est.filaHoja, columnaHoja: 4, valor: nuevoEstado })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);

    est.estado = nuevoEstado;
    renderListaAsistencia();
    renderTablaAcumuladoInasistencias();
    renderVistaMateria();
    renderVistaAlumno();
    renderTablaCompleta();
    mostrarToast(`✅ ${est.nombre}: ${nuevoEstado}`);
  } catch (err) {
    mostrarToast("⚠️ Error: " + err.message, 4000);
  }
}

async function editarDatosEstudiante(filaHoja) {
  const est = (estado.estudiantes || []).find(e => e.filaHoja === Number(filaHoja));
  if (!est) return;

  const nuevoNombre = prompt("Apellido y Nombre:", est.nombre);
  if (nuevoNombre === null) return;
  const nuevoGrupo = prompt("Grupo:", est.grupo || "Grupo 1");
  if (nuevoGrupo === null) return;

  try {
    await fetch(scriptUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ accion: "actualizarCelda", curso: estado.cursoActual, filaHoja: est.filaHoja, columnaHoja: 2, valor: nuevoNombre.trim().toUpperCase() }) });
    await fetch(scriptUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ accion: "actualizarCelda", curso: estado.cursoActual, filaHoja: est.filaHoja, columnaHoja: 3, valor: nuevoGrupo.trim() }) });
    est.nombre = nuevoNombre.trim().toUpperCase();
    est.grupo = nuevoGrupo.trim();
    aplicarDatosRecibidos(estado, true);
    mostrarToast("✅ Estudiante actualizado");
  } catch (err) {
    mostrarToast("⚠️ Error: " + err.message, 4000);
  }
}

async function eliminarEstudianteDeMatricula(filaHoja) {
  const est = (estado.estudiantes || []).find(e => e.filaHoja === Number(filaHoja));
  if (!est || !confirm(`⚠️ ¿Eliminar definitivamente a "${est.orden}. ${est.nombre}"?`)) return;

  try {
    for (let col = 1; col <= 4; col++) {
      await fetch(scriptUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ accion: "actualizarCelda", curso: estado.cursoActual, filaHoja: est.filaHoja, columnaHoja: col, valor: "" }) });
    }
    estado.estudiantes = (estado.estudiantes || []).filter(e => e.filaHoja !== Number(filaHoja));
    delete asistenciaActual[filaHoja];
    aplicarDatosRecibidos(estado, true);
    mostrarToast("🗑️ Estudiante eliminado");
  } catch (err) {
    mostrarToast("⚠️ Error: " + err.message, 4000);
  }
}

function actualizarOpcionesTurnoGrupo() {
  const sel = document.getElementById("asistTurnoGrupo");
  if (!sel) return;
  const valorPrevio = sel.value;
  const gruposSet = new Set();
  (estado.estudiantes || []).forEach(e => { if (e.grupo) gruposSet.add(e.grupo.trim()); });

  let opciones = [
    { label: "TT - Teoría (Curso Completo)", value: "TT - Teoría|ALL" },
    { label: "TM - Teoría (Curso Completo)", value: "TM - Teoría|ALL" },
    { label: "Educación Física (Curso Completo)", value: "Educación Física|ALL" }
  ];

  gruposSet.forEach(g => {
    opciones.push({ label: `TM Taller - Solo ${g}`, value: `TM Taller (${g})|${g}` });
    opciones.push({ label: `TT Taller - Solo ${g}`, value: `TT Taller (${g})|${g}` });
    opciones.push({ label: `TV Taller - Solo ${g}`, value: `TV Taller (${g})|${g}` });
  });

  sel.innerHTML = "";
  opciones.forEach(o => {
    const opt = document.createElement("option");
    opt.value = o.value;
    opt.textContent = o.label;
    sel.appendChild(opt);
  });
  if ([...sel.options].some(o => o.value === valorPrevio)) sel.value = valorPrevio;
}

function obtenerEstudiantesFiltradosAsistencia() {
  const filtroVal = document.getElementById("asistTurnoGrupo").value || "TT - Teoría|ALL";
  const grupoFiltro = filtroVal.split("|")[1] || "ALL";

  return (estado.estudiantes || []).filter(est => {
    if (esEstudianteTachado(est)) return false;
    if (grupoFiltro === "ALL") return true;
    return est.grupo.toLowerCase() === grupoFiltro.toLowerCase();
  });
}

function obtenerEstudiantesTachadosDelFiltro() {
  const filtroVal = document.getElementById("asistTurnoGrupo").value || "TT - Teoría|ALL";
  const grupoFiltro = filtroVal.split("|")[1] || "ALL";

  return (estado.estudiantes || []).filter(est => {
    if (!esEstudianteTachado(est)) return false;
    if (grupoFiltro === "ALL") return true;
    return est.grupo.toLowerCase() === grupoFiltro.toLowerCase();
  });
}

function obtenerValorAusenciaActual() {
  const mod = document.getElementById("asistModalidad").value;
  if (mod === "TRIPLE") return 0.33;
  if (mod === "SIMPLE") return 1.0;
  return 0.5;
}

function renderListaAsistencia() {
  const cont = document.getElementById("listaAsistenciaContainer");
  const contTachados = document.getElementById("contenedorTachadosAsistencia");
  if (!cont || !contTachados) return;

  const lista = obtenerEstudiantesFiltradosAsistencia();
  const listaTachados = obtenerEstudiantesTachadosDelFiltro();
  const valAus = obtenerValorAusenciaActual();

  let p = 0, a = 0, t = 0;
  let html = "";

  lista.forEach(est => {
    const estadoAlu = asistenciaActual[est.filaHoja] || "P";
    if (estadoAlu === "P") p++;
    else if (estadoAlu === "A") a++;
    else if (estadoAlu === "T") t++;

    const totalAnual = (est.inasistencias && est.inasistencias.total) ? est.inasistencias.total : 0;
    let claseBadgeFaltas = "badge-ok";
    let textoAlerta = `Acum: ${totalAnual}`;
    if (totalAnual >= 28) { claseBadgeFaltas = "badge-danger"; textoAlerta = `🚨 Acum: ${totalAnual} (Límite 28)`; }
    else if (totalAnual >= 20) { claseBadgeFaltas = "badge-danger"; textoAlerta = `⚠️ Acum: ${totalAnual}`; }

    html += `
      <div class="asist-student-row status-${estadoAlu}">
        <div class="stu-info">
          <div class="stu-name">${est.orden}. ${est.nombre}</div>
          <div class="stu-meta">
            <span class="badge badge-grp">${est.grupo || "Sin grupo"}</span>
            <span class="badge ${claseBadgeFaltas}">${textoAlerta}</span>
          </div>
        </div>
        <div class="pat-btn-group">
          <button type="button" class="pat-btn ${estadoAlu === 'P' ? 'active-P' : ''}" onclick="cambiarEstadoAsistencia(${est.filaHoja}, 'P')">P<small>0</small></button>
          <button type="button" class="pat-btn ${estadoAlu === 'A' ? 'active-A' : ''}" onclick="cambiarEstadoAsistencia(${est.filaHoja}, 'A')">A<small>+${valAus}</small></button>
          <button type="button" class="pat-btn ${estadoAlu === 'T' ? 'active-T' : ''}" onclick="cambiarEstadoAsistencia(${est.filaHoja}, 'T')">T<small>+0.25</small></button>
          <button type="button" class="btn-strike-mini" title="Tachar" onclick="alternarEstadoTachado(${est.filaHoja})">🚫</button>
        </div>
      </div>
    `;
  });

  cont.innerHTML = html || `<p style="padding:12px; color:#64748b;">No hay estudiantes activos.</p>`;

  if (listaTachados.length > 0) {
    let htmlTach = `<div class="tachados-box"><div class="tachados-title"><span>🚫 Tachados (${listaTachados.length})</span></div>`;
    listaTachados.forEach(est => {
      htmlTach += `
        <div class="tachado-item">
          <div><span class="stu-name tachado-text">${est.orden}. ${est.nombre}</span></div>
          <div style="display:flex; gap:6px;">
            <button type="button" class="btn-success-outline" onclick="alternarEstadoTachado(${est.filaHoja})">✅ Activar</button>
            <button type="button" class="btn-danger-outline" onclick="eliminarEstudianteDeMatricula(${est.filaHoja})">🗑️</button>
          </div>
        </div>`;
    });
    htmlTach += `</div>`;
    contTachados.innerHTML = htmlTach;
  } else {
    contTachados.innerHTML = "";
  }

  document.getElementById("countMat").textContent = lista.length;
  document.getElementById("countP").textContent = p;
  document.getElementById("countA").textContent = a;
  document.getElementById("countT").textContent = t;

  actualizarVistaPreviaWA();
}

function cambiarEstadoAsistencia(filaHoja, nuevoEstado) {
  asistenciaActual[filaHoja] = nuevoEstado;
  renderListaAsistencia();
}

function marcarTodosPresentes() {
  obtenerEstudiantesFiltradosAsistencia().forEach(est => { asistenciaActual[est.filaHoja] = "P"; });
  renderListaAsistencia();
}

function formatearFechaInput() {
  const raw = document.getElementById("asistFecha")?.value;
  if (!raw) return "";
  const [yyyy, mm, dd] = raw.split("-");
  return `${dd}/${mm}/${yyyy}`;
}

function construirMensajeWhatsApp() {
  const lista = obtenerEstudiantesFiltradosAsistencia();
  const fechaStr = formatearFechaInput();
  const turnoRaw = (document.getElementById("asistTurnoGrupo")?.value || "").split("|")[0];
  const valAus = obtenerValorAusenciaActual();
  const preceptor = document.getElementById("asistPreceptor")?.value.trim() || "Preceptoría";
  const obs = document.getElementById("asistObs")?.value.trim() || "";
  const cursoLimpio = (estado.cursoActual || "").replace(/_/g, " ");

  const ausentes = [], tardes = [];
  let presentesCount = 0;

  lista.forEach(est => {
    const st = asistenciaActual[est.filaHoja] || "P";
    if (st === "P") presentesCount++;
    else if (st === "A") ausentes.push(`• ${formatearEstudianteParaWhatsApp(est)}`);
    else if (st === "T") tardes.push(`• ${formatearEstudianteParaWhatsApp(est)}`);
  });

  let lineas = [
    `📋 *PARTE DIARIO DE ASISTENCIA - EEST N°2*`,
    `🏫 *Curso:* ${cursoLimpio} | *Turno:* ${turnoRaw}`,
    `📅 *Fecha:* ${fechaStr} (Aus: ${valAus} | Tarde: 0.25)`,
    ``,
    `👥 *En lista:* ${lista.length} | ✅ *Presentes:* ${presentesCount} | ❌ *Ausentes:* ${ausentes.length} | ⏰ *Tardes:* ${tardes.length}`
  ];

  if (ausentes.length > 0) lineas.push(``, `❌ *Ausentes (+${valAus}):*`, ...ausentes);
  else lineas.push(``, `✅ *Sin ausentes en este turno.*`);

  if (tardes.length > 0) lineas.push(``, `⏰ *Llegadas Tarde (+0.25):*`, ...tardes);
  if (obs) lineas.push(``, `📌 *Observaciones:* ${obs}`);
  lineas.push(``, `✍️ *Preceptor/a:* ${preceptor}`);
  return lineas.join("\n");
}

function actualizarVistaPreviaWA() {
  const box = document.getElementById("waPreviewBox");
  if (box) box.textContent = construirMensajeWhatsApp();
}

// Abre WhatsApp Personal (com.whatsapp) o WhatsApp Business (com.whatsapp.w4b) según la preferencia seleccionada
function abrirWhatsAppBusinessDirecto(textoForzado, telefonoOpcional) {
  const texto = textoForzado || construirMensajeWhatsApp();
  const encoded = encodeURIComponent(texto);
  const ua = navigator.userAgent || "";
  const esAndroid = /Android/i.test(ua);
  const telLimpio = String(telefonoOpcional || "").replace(/\D/g, "");
  const paqueteAndroid = (preferenciaAppWA === "PERSONAL") ? "com.whatsapp" : "com.whatsapp.w4b";

  if (telLimpio) {
    const numFull = telLimpio.startsWith("54") ? telLimpio : "549" + telLimpio;
    const urlWebPhone = `https://api.whatsapp.com/send?phone=${numFull}&text=${encoded}`;
    if (esAndroid) {
      window.location.href = `intent://send?phone=${numFull}&text=${encoded}#Intent;scheme=whatsapp;package=${paqueteAndroid};S.browser_fallback_url=${encodeURIComponent(urlWebPhone)};end`;
    } else {
      window.open(urlWebPhone, "_blank");
    }
    return;
  }

  const urlWebGeneral = `https://api.whatsapp.com/send?text=${encoded}`;
  if (esAndroid) {
    window.location.href = `intent://send?text=${encoded}#Intent;scheme=whatsapp;package=${paqueteAndroid};S.browser_fallback_url=${encodeURIComponent(urlWebGeneral)};end`;
  } else {
    window.open(urlWebGeneral, "_blank");
  }
}

async function copiarPartePortapapeles() {
  try {
    await navigator.clipboard.writeText(construirMensajeWhatsApp());
    mostrarToast("📋 Parte copiado");
  } catch (e) {
    mostrarToast("No se pudo copiar");
  }
}

async function guardarYEnviarWhatsAppBusiness() {
  const btn = document.getElementById("btnGuardarYEnviar");
  const lista = obtenerEstudiantesFiltradosAsistencia();
  if (lista.length === 0) return mostrarToast("No hay alumnos activos");

  const mensajeCongelado = construirMensajeWhatsApp();
  const seleccionCongelada = { ...asistenciaActual };

  const payload = {
    accion: "registrarAsistencia",
    curso: estado.cursoActual,
    fechaFormateada: formatearFechaInput(),
    mes: document.getElementById("asistMes").value,
    turnoGrupo: document.getElementById("asistTurnoGrupo").value.split("|")[0],
    modalidadDia: document.getElementById("asistModalidad").value,
    preceptor: document.getElementById("asistPreceptor").value.trim(),
    observaciones: document.getElementById("asistObs").value.trim(),
    registros: lista.map(est => ({
      filaHoja: est.filaHoja,
      orden: est.orden,
      nombre: est.nombre,
      grupo: est.grupo,
      estadoAsistencia: seleccionCongelada[est.filaHoja] || "P"
    }))
  };

  try {
    btn.disabled = true;
    btn.textContent = "⏳ Guardando en Sheets...";
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);

    asistenciaActual = seleccionCongelada;
    aplicarDatosRecibidos(json.data, true);
    mostrarToast("✅ Asistencia guardada");
    abrirWhatsAppBusinessDirecto(mensajeCongelado);
  } catch (err) {
    mostrarToast("⚠️ Error: " + err.message, 4000);
  } finally {
    btn.disabled = false;
    btn.textContent = `💾 Guardar Asistencia y Abrir ${obtenerEtiquetaAppWA()}`;
  }
}

function renderTablaAcumuladoInasistencias() {
  const cont = document.getElementById("tablaAcumuladoInasistencias");
  if (!cont) return;
  if (!estado.columnasInasistencias) {
    cont.innerHTML = `<p style="padding:10px; color:#64748b;">Sin columnas de inasistencias configuradas.</p>`;
    return;
  }
  let html = `<table class="app-table"><thead><tr><th>Ord</th><th>Estudiante</th><th>Grp</th>`;
  MESES_LISTA.forEach(m => { html += `<th>${m.slice(0, 3)}</th>`; });
  html += `<th>Total</th></tr></thead><tbody>`;

  (estado.estudiantes || []).forEach(est => {
    if (esEstudianteTachado(est)) return;
    const tot = (est.inasistencias && est.inasistencias.total) || 0;
    html += `<tr><td>${est.orden}</td><td class="td-left">${est.nombre}</td><td>${est.grupo}</td>`;
    MESES_LISTA.forEach(m => {
      const val = (est.inasistencias && est.inasistencias.meses && est.inasistencias.meses[m]) || 0;
      html += `<td>${val > 0 ? val : "-"}</td>`;
    });
    html += `<td><strong>${tot}</strong></td></tr>`;
  });
  html += `</tbody></table>`;
  cont.innerHTML = html;
}

function renderHistorialAsistencias() {
  const cont = document.getElementById("tablaHistorialPartes");
  const selFiltro = document.getElementById("filtroHistorialTurno");
  if (!cont || !selFiltro) return;
  const hist = estado.historialAsistencias || [];

  const valorActual = selFiltro.value || "ALL";
  const turnosUnicos = [...new Set(hist.map(h => h.turnoGrupo).filter(Boolean))];
  selFiltro.innerHTML = `<option value="ALL">Todos</option>`;
  turnosUnicos.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    if (t === valorActual) opt.selected = true;
    selFiltro.appendChild(opt);
  });

  if (hist.length === 0) {
    cont.innerHTML = `<p style="padding:10px; color:#64748b;">Sin partes registrados.</p>`;
    return;
  }

  let html = `<table class="app-table"><thead><tr><th>Acción</th><th>Fecha</th><th>Turno</th><th>P</th><th>A</th><th>T</th><th>Ausentes</th></tr></thead><tbody>`;
  hist.forEach((item, idx) => {
    if (valorActual !== "ALL" && item.turnoGrupo !== valorActual) return;
    html += `<tr>
      <td><button type="button" class="btn-outline" style="padding:3px 6px; font-size:11px;" onclick="cargarParteDesdeFilaHistorial(${idx})">✏️</button></td>
      <td><strong>${normalizarFechaDDMMYYYY(item.fecha)}</strong></td>
      <td><span class="badge badge-grp">${item.turnoGrupo}</span></td>
      <td style="color:#15803d;font-weight:800;">${item.presentes}</td>
      <td style="color:#b91c1c;font-weight:800;">${item.ausentes}</td>
      <td style="color:#b45309;font-weight:800;">${item.tardes}</td>
      <td class="td-left" style="font-size:11px;">${item.nominaAusentes}</td>
    </tr>`;
  });
  html += `</tbody></table>`;
  cont.innerHTML = html;
}

/* ==================== VISTAS DE CALIFICACIONES, FICHA ALUMNO Y PLANILLA ==================== */
function limpiarNombreMateria(nombreRaw) {
  return String(nombreRaw || "").replace(/^Materia\s*\d+\s*:\s*/i, "").trim();
}

function crearSelectorNotaHTML(filaHoja, colHoja, valorActual, tipo) {
  const v = String(valorActual || "").toUpperCase().trim();
  const clColor = obtenerClaseColorNota(v);

  if (tipo === "val") {
    return `<select class="${clColor}" onchange="guardarCeldaRemota(${filaHoja}, ${colHoja}, this)">
      <option value="" ${v === "" ? "selected" : ""}>-</option>
      <option value="TEA" ${v === "TEA" ? "selected" : ""}>TEA</option>
      <option value="TEP" ${v === "TEP" ? "selected" : ""}>TEP</option>
      <option value="TED" ${v === "TED" ? "selected" : ""}>TED</option>
    </select>`;
  } else {
    let opts = `<option value="" ${v === "" ? "selected" : ""}>-</option>`;
    for (let n = 10; n >= 1; n--) opts += `<option value="${n}" ${v === String(n) ? "selected" : ""}>${n}</option>`;
    opts += `<option value="AUS" ${v === "AUS" ? "selected" : ""}>AUS</option>`;
    return `<select class="${clColor}" onchange="guardarCeldaRemota(${filaHoja}, ${colHoja}, this)">${opts}</select>`;
  }
}

function renderVistaMateria() {
  const cont = document.getElementById("contenedorTarjetasMateria");
  if (!cont) return;
  const mostrarTachados = document.getElementById("chkMostrarTachadosMateria")?.checked;
  const idxMat = parseInt(document.getElementById("materiaSelect")?.value || "0", 10);
  const mat = (estado.materias || []).find(m => m.indice === idxMat);
  if (!mat) { cont.innerHTML = "<p>Sin materias.</p>"; return; }

  const esTal = esMateriaDeTaller(mat);
  let html = `
    <div class="section-divider-banner ${esTal ? 'divider-taller' : 'divider-teoria'}" style="display:flex; justify-content:space-between; align-items:center;">
      <span>${esTal ? '🔧 Materia de Taller' : '📘 Materia de Teoría'}: ${mat.nombre}</span>
      <span class="tag-tipo-mat ${esTal ? 'tag-tipo-taller' : 'tag-tipo-teoria'}"
        onclick="alternarTipoMateriaTallerTeoria(${mat.indice})">
        Cambiar a ${esTal ? '📘 Teoría' : '🔧 Taller'}
      </span>
    </div>
  `;

  (estado.estudiantes || []).forEach(est => {
    const tachado = esEstudianteTachado(est);
    if (tachado && !mostrarTachados) return;

    const notasMat = (est.notas && est.notas[mat.indice]) || {};
    const esResumenTaller = mat.esResumenTallerCB;

    html += `<div class="grade-card ${tachado ? 'card-tachada' : ''} ${esResumenTaller ? 'resumen-taller-card' : ''}">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; flex-wrap:wrap;">
        <strong class="${tachado ? 'stu-name tachado-text' : ''}" style="font-size:13px;">
          ${est.orden}. ${est.nombre} ${esResumenTaller ? ' 🔧 (Promedio Ciclo Básico)' : ''}
        </strong>
        <div style="display:flex; gap:5px; align-items:center;">
          <span class="badge badge-grp">${est.grupo}</span>
          ${tachado
            ? `<button class="btn-success-outline" style="padding:3px 7px; font-size:10.5px;" onclick="alternarEstadoTachado(${est.filaHoja})">✅</button>`
            : `<button class="btn-danger-outline" style="padding:3px 7px; font-size:10.5px;" onclick="alternarEstadoTachado(${est.filaHoja})">🚫</button>`
          }
        </div>
      </div>
      <div class="grade-inputs-grid">`;

    SUB_CAMPOS.forEach(sc => {
      const colHoja = mat.columnaInicio + sc.offset;
      const deshabilitado = esResumenTaller ? 'disabled title="Calculado automáticamente por el promedio de Procedimientos, Lenguajes y Sistemas"' : '';
      html += `<div class="mini-field">
        <label>${sc.label}</label>
        <div ${deshabilitado}>${crearSelectorNotaHTML(est.filaHoja, colHoja, notasMat[sc.key], sc.tipo)}</div>
      </div>`;
    });
    html += `</div></div>`;
  });
  cont.innerHTML = html;
}

function cambiarAmbitoInformeAlumno(nuevoAmbito) {
  configInformeAlumno.ambito = nuevoAmbito;
  renderVistaAlumno();
}

function actualizarConfigInformeDesdeInputs() {
  configInformeAlumno.filtroMaterias = document.getElementById("infFiltroMaterias")?.value || "TODAS";
  configInformeAlumno.soloCamposCargadosWA = document.getElementById("infSoloCargadosWA")?.checked ?? true;
  configInformeAlumno.telefonoPadre = document.getElementById("infTelefonoPadre")?.value || "";
  configInformeAlumno.fechasExtraTeo = document.getElementById("infFechasExtraTeo")?.value || "";
  configInformeAlumno.fechasExtraTal = document.getElementById("infFechasExtraTal")?.value || "";
  configInformeAlumno.notaAdicional = document.getElementById("infNotaAdicional")?.value || "";

  const box = document.getElementById("waAlumnoPreviewBox");
  const filaSel = parseInt(document.getElementById("alumnoSelect")?.value || "0", 10);
  const est = (estado.estudiantes || []).find(e => e.filaHoja === filaSel);
  if (box && est) box.textContent = construirMensajeWhatsAppAlumno(est);
}

function materiaCumpleFiltroInforme(mat, est) {
  const esTal = esMateriaDeTaller(mat);
  if (configInformeAlumno.ambito === "TALLER" && !esTal) return false;
  if (configInformeAlumno.ambito === "TEORIA" && esTal) return false;
  return true;
}

function formatearLineaMateriaWhatsApp(mat, est) {
  const notasMat = (est.notas && est.notas[mat.indice]) || {};
  const partes = [];
  SUB_CAMPOS.forEach(sc => {
    const val = String(notasMat[sc.key] || "").trim();
    if (configInformeAlumno.soloCamposCargadosWA) {
      if (val !== "") partes.push(`${sc.shortLabel}: *${val}*`);
    } else {
      partes.push(`${sc.shortLabel}: ${val || "-"}`);
    }
  });
  const detalle = partes.length > 0 ? partes.join(" | ") : "_Sin notas_";
  return `• *${limpiarNombreMateria(mat.nombre)}:* ${detalle}`;
}

function combinarFechasDetectadasYExtra(listaAuto, textoExtra) {
  const combinadas = [...listaAuto];
  if (textoExtra && textoExtra.trim()) {
    textoExtra.split(",").map(s => s.trim()).filter(Boolean).forEach(f => {
      if (!combinadas.includes(f)) combinadas.push(f);
    });
  }
  return combinadas;
}

// Mensaje individual con N° de Orden y cierre "Se solicita confirmar recepción del mensaje"
function construirMensajeWhatsAppAlumno(est) {
  if (!est) return "";
  const hoy = new Date();
  const fechaHoy = `${String(hoy.getDate()).padStart(2, "0")}/${String(hoy.getMonth() + 1).padStart(2, "0")}/${hoy.getFullYear()}`;
  const cursoLimpio = (estado.cursoActual || "").replace(/_/g, " ");
  const preceptor = document.getElementById("asistPreceptor")?.value.trim() || "Preceptoría";
  const totFaltas = (est.inasistencias && est.inasistencias.total) || 0;
  const resumenMeses = obtenerResumenMensualAbreviado(est);
  const fechasHist = obtenerFechasInasistenciasEstudiante(est);

  const fechasTeoFinal = combinarFechasDetectadasYExtra(fechasHist.teoria, configInformeAlumno.fechasExtraTeo);
  const fechasTalFinal = combinarFechasDetectadasYExtra(fechasHist.taller, configInformeAlumno.fechasExtraTal);

  const etiquetaAmbito = configInformeAlumno.ambito === "TALLER" ? "SOLO TALLER" : (configInformeAlumno.ambito === "TEORIA" ? "SOLO TEORÍA" : "COMPLETO");
  const numOrdenPad = String(est.orden || "").padStart(2, "0");

  const lineas = [
    `🏫 *E.E.S.T. N° 2 - INFORME ACADÉMICO Y ASISTENCIA*`,
    `👤 *Estudiante:* N° ${numOrdenPad} - ${est.nombre}`,
    `📌 *Curso:* ${cursoLimpio} (${est.grupo || "S/G"}) | *Fecha:* ${fechaHoy}`,
    `🔎 *Modalidad:* ${etiquetaAmbito}`,
    ``,
    `📊 *INASISTENCIAS ACUMULADAS:* *${totFaltas}*`
  ];

  if (resumenMeses) lineas.push(`• *Por mes:* ${resumenMeses}`);
  if (configInformeAlumno.ambito === "TODO" || configInformeAlumno.ambito === "TEORIA") lineas.push(`• *Días Aus./Tarde Teoría:* ${fechasTeoFinal.length > 0 ? fechasTeoFinal.join(", ") : "Sin registros"}`);
  if (configInformeAlumno.ambito === "TODO" || configInformeAlumno.ambito === "TALLER") lineas.push(`• *Días Aus./Tarde Taller:* ${fechasTalFinal.length > 0 ? fechasTalFinal.join(", ") : "Sin registros"}`);

  const materiasOrdenadas = obtenerMateriasOrdenadasVisualmente().filter(m => materiaCumpleFiltroInforme(m, est));
  const matsTeoria = materiasOrdenadas.filter(m => !esMateriaDeTaller(m));
  const matsTaller = materiasOrdenadas.filter(m => esMateriaDeTaller(m));

  if ((configInformeAlumno.ambito === "TODO" || configInformeAlumno.ambito === "TEORIA") && matsTeoria.length > 0) {
    lineas.push(``, `📘 *TEORÍA:*`);
    matsTeoria.forEach(m => lineas.push(formatearLineaMateriaWhatsApp(m, est)));
  }
  if ((configInformeAlumno.ambito === "TODO" || configInformeAlumno.ambito === "TALLER") && matsTaller.length > 0) {
    lineas.push(``, `🔧 *TALLER:*`);
    matsTaller.forEach(m => lineas.push(formatearLineaMateriaWhatsApp(m, est)));
  }

  if (configInformeAlumno.notaAdicional && configInformeAlumno.notaAdicional.trim()) {
    lineas.push(``, `📝 *Nota:* ${configInformeAlumno.notaAdicional.trim()}`);
  }
  lineas.push(``, `✍️ *Preceptor/a:* ${preceptor}`, `_Se solicita confirmar recepción del mensaje. Muchas gracias._`);
  return lineas.join("\n");
}

function enviarInformeAlumnoWhatsApp() {
  const filaSel = parseInt(document.getElementById("alumnoSelect")?.value || "0", 10);
  const est = (estado.estudiantes || []).find(e => e.filaHoja === filaSel);
  if (!est) return;
  abrirWhatsAppBusinessDirecto(construirMensajeWhatsAppAlumno(est), configInformeAlumno.telefonoPadre);
}

async function copiarInformeAlumnoPortapapeles() {
  const filaSel = parseInt(document.getElementById("alumnoSelect")?.value || "0", 10);
  const est = (estado.estudiantes || []).find(e => e.filaHoja === filaSel);
  if (!est) return;
  try {
    await navigator.clipboard.writeText(construirMensajeWhatsAppAlumno(est));
    mostrarToast("📋 Copiado al portapapeles");
  } catch (e) {
    mostrarToast("No se pudo copiar");
  }
}

function construirTalonComunicadoHTML(est) {
  const hoy = new Date();
  const fechaHoy = `${String(hoy.getDate()).padStart(2, "0")}/${String(hoy.getMonth() + 1).padStart(2, "0")}/${hoy.getFullYear()}`;
  const cursoLimpio = (estado.cursoActual || "").replace(/_/g, " ");
  const preceptor = document.getElementById("asistPreceptor")?.value.trim() || "Preceptoría";
  const totFaltas = (est.inasistencias && est.inasistencias.total) || 0;
  const resumenMeses = obtenerResumenMensualAbreviado(est) || "Sin inasistencias";
  const fechasHist = obtenerFechasInasistenciasEstudiante(est);
  const fechasTeoFinal = combinarFechasDetectadasYExtra(fechasHist.teoria, configInformeAlumno.fechasExtraTeo);
  const fechasTalFinal = combinarFechasDetectadasYExtra(fechasHist.taller, configInformeAlumno.fechasExtraTal);
  const etiquetaAmbito = configInformeAlumno.ambito === "TALLER" ? "SOLO TALLER" : (configInformeAlumno.ambito === "TEORIA" ? "SOLO TEORÍA" : "TEORÍA + TALLER");

  const materiasFiltradas = obtenerMateriasOrdenadasVisualmente().filter(m => materiaCumpleFiltroInforme(m, est));
  let filasTabla = "";
  materiasFiltradas.forEach(mat => {
    const esTal = esMateriaDeTaller(mat);
    const notasMat = (est.notas && est.notas[mat.indice]) || {};
    filasTabla += `<tr>
      <td class="com-mat-name">${limpiarNombreMateria(mat.nombre)}</td>
      <td><strong>${esTal ? "Taller" : "Teoría"}</strong></td>
      <td class="${obtenerClaseColorNota(notasMat.val1)}">${notasMat.val1 || "-"}</td>
      <td class="${obtenerClaseColorNota(notasMat.cal1)}">${notasMat.cal1 || "-"}</td>
      <td class="${obtenerClaseColorNota(notasMat.val2)}">${notasMat.val2 || "-"}</td>
      <td class="${obtenerClaseColorNota(notasMat.cal2)}">${notasMat.cal2 || "-"}</td>
      <td class="${obtenerClaseColorNota(notasMat.int1)}">${notasMat.int1 || "-"}</td>
      <td class="${obtenerClaseColorNota(notasMat.final)}"><strong>${notasMat.final || "-"}</strong></td>
    </tr>`;
  });

  return `
    <div class="comunicado-slip">
      <div class="com-header">
        <div>
          <div class="com-title">E.E.S.T. N° 2 "Pbro. Manuel de San Ginés" — San Fernando</div>
          <div class="com-subtitle">COMUNICADO ACADÉMICO Y DE ASISTENCIA (${etiquetaAmbito})</div>
        </div>
        <div style="text-align:right; font-size:9.5px; font-weight:bold;">Fecha: ${fechaHoy}<br>Curso: ${cursoLimpio}</div>
      </div>
      <div class="com-student-strip">
        <div><strong>ESTUDIANTE:</strong> ${est.orden}. ${est.nombre}</div>
        <div><strong>GRUPO:</strong> ${est.grupo || "-"}</div>
        <div><strong>TOTAL INASISTENCIAS:</strong> ${totFaltas}</div>
      </div>
      <div class="com-asist-box">
        <div><strong>Inasistencias por mes:</strong> ${resumenMeses}</div>
        <div><strong>Días Aus./Tarde (Teoría):</strong> ${fechasTeoFinal.length > 0 ? fechasTeoFinal.join(", ") : "Ninguno"}</div>
        <div><strong>Días Aus./Tarde (Taller):</strong> ${fechasTalFinal.length > 0 ? fechasTalFinal.join(", ") : "Ninguno"}</div>
      </div>
      <table class="com-table">
        <thead>
          <tr>
            <th style="text-align:left; width:36%;">MATERIA</th><th style="width:10%;">ÁREA</th>
            <th style="width:9%;">1° Val.</th><th style="width:9%;">Cal. 1°C</th>
            <th style="width:9%;">2° Val.</th><th style="width:9%;">Cal. 2°C</th>
            <th style="width:9%;">Intensif.</th><th style="width:9%;">Final</th>
          </tr>
        </thead>
        <tbody>${filasTabla}</tbody>
      </table>
      <div class="com-sign-row">
        <div><div class="com-sign-box"></div>Firma Familiar / Tutor</div>
        <div><div class="com-sign-box"></div>Firma Estudiante</div>
        <div><div class="com-sign-box"></div>Preceptor/a (${preceptor})</div>
      </div>
    </div>
  `;
}

function imprimirComunicadoAlumnoActual() {
  const filaSel = parseInt(document.getElementById("alumnoSelect")?.value || "0", 10);
  const est = (estado.estudiantes || []).find(e => e.filaHoja === filaSel);
  if (!est) return;
  document.getElementById("printComunicadosRoot").innerHTML = construirTalonComunicadoHTML(est);
  document.body.classList.add("print-mode-comunicado");
  window.print();
  setTimeout(() => document.body.classList.remove("print-mode-comunicado"), 600);
}

function imprimirComunicadosCursoCompleto() {
  const activos = (estado.estudiantes || []).filter(e => !esEstudianteTachado(e));
  if (activos.length === 0) return mostrarToast("No hay alumnos activos");
  document.getElementById("printComunicadosRoot").innerHTML = activos.map(est => construirTalonComunicadoHTML(est)).join("");
  document.body.classList.add("print-mode-comunicado");
  window.print();
  setTimeout(() => document.body.classList.remove("print-mode-comunicado"), 600);
}

function renderVistaAlumno() {
  const cont = document.getElementById("contenedorFichaAlumno");
  if (!cont) return;
  const filaSel = parseInt(document.getElementById("alumnoSelect")?.value || "0", 10);
  const est = (estado.estudiantes || []).find(e => e.filaHoja === filaSel);
  if (!est) return;

  const tachado = esEstudianteTachado(est);
  const totFaltas = (est.inasistencias && est.inasistencias.total) || 0;
  const amb = configInformeAlumno.ambito;
  const nombreApp = obtenerEtiquetaAppWA();

  let html = `
    <div class="student-admin-bar">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <div>
          <div class="stu-name ${tachado ? 'tachado-text' : ''}" style="font-size:15px;">${est.orden}. ${est.nombre}</div>
          <div style="font-size:12px; color:#475569; margin-top:3px;">
            <strong>Grupo:</strong> ${est.grupo} &nbsp;|&nbsp; <strong>Estado:</strong> ${est.estado || 'Activo'} &nbsp;|&nbsp; <strong>Faltas:</strong> ${totFaltas}
          </div>
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button type="button" class="btn-outline" onclick="editarDatosEstudiante(${est.filaHoja})">✏️ Editar</button>
          ${tachado ? `<button type="button" class="btn-success-outline" onclick="alternarEstadoTachado(${est.filaHoja})">✅ Activar</button>` : `<button type="button" class="btn-danger-outline" onclick="alternarEstadoTachado(${est.filaHoja})">🚫 Tachar</button>`}
          <button type="button" class="btn-danger-outline" onclick="eliminarEstudianteDeMatricula(${est.filaHoja})">🗑️</button>
        </div>
      </div>
    </div>

    <div class="report-config-card">
      <strong style="font-size:13.5px; color:#15803d;">📲 Comunicado Individual para Familias (WhatsApp y PDF)</strong>
      <div class="scope-pill-bar">
        <button type="button" class="scope-pill ${amb === 'TODO' ? 'active-TODO' : ''}" onclick="cambiarAmbitoInformeAlumno('TODO')">📋 Todo</button>
        <button type="button" class="scope-pill ${amb === 'TALLER' ? 'active-TALLER' : ''}" onclick="cambiarAmbitoInformeAlumno('TALLER')">🔧 Solo Taller</button>
        <button type="button" class="scope-pill ${amb === 'TEORIA' ? 'active-TEORIA' : ''}" onclick="cambiarAmbitoInformeAlumno('TEORIA')">📘 Solo Teoría</button>
      </div>
      <div class="form-grid">
        <div class="form-group"><label>WhatsApp Familiar</label><input type="tel" id="infTelefonoPadre" placeholder="Ej: 1123456789" value="${configInformeAlumno.telefonoPadre || ""}" oninput="actualizarConfigInformeDesdeInputs()"></div>
        <div class="form-group">
          <label>📲 App de WhatsApp</label>
          <select id="infTipoAppWA" onchange="cambiarPreferenciaAppWA(this.value)">
            <option value="W4B" ${preferenciaAppWA === "W4B" ? "selected" : ""}>WhatsApp Business</option>
            <option value="PERSONAL" ${preferenciaAppWA === "PERSONAL" ? "selected" : ""}>WhatsApp Personal (Común)</option>
          </select>
        </div>
        <div class="form-group"><label>Fechas Teoría Extra</label><input type="text" id="infFechasExtraTeo" value="${configInformeAlumno.fechasExtraTeo || ""}" oninput="actualizarConfigInformeDesdeInputs()"></div>
        <div class="form-group"><label>Fechas Taller Extra</label><input type="text" id="infFechasExtraTal" value="${configInformeAlumno.fechasExtraTal || ""}" oninput="actualizarConfigInformeDesdeInputs()"></div>
        <div class="form-group"><label>Nota Opcional</label><input type="text" id="infNotaAdicional" value="${configInformeAlumno.notaAdicional || ""}" oninput="actualizarConfigInformeDesdeInputs()"></div>
      </div>
      <div class="action-buttons" style="margin-top:10px;">
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:8px;">
          <button type="button" id="btnEnviarWAAlumno" class="btn-main btn-w4b" onclick="enviarInformeAlumnoWhatsApp()">📲 Enviar por ${nombreApp}</button>
          <button type="button" class="btn-main btn-print-blue" onclick="imprimirComunicadoAlumnoActual()">🖨️ Imprimir Talón Cuaderno</button>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" class="btn-outline" style="flex:1;" onclick="copiarInformeAlumnoPortapapeles()">📋 Copiar Texto</button>
          <button type="button" class="btn-outline" style="flex:1;" onclick="imprimirComunicadosCursoCompleto()">🖨️ Imprimir Lote Todo el Curso</button>
        </div>
      </div>
      <div class="wa-preview-box" id="waAlumnoPreviewBox">${construirMensajeWhatsAppAlumno(est)}</div>
    </div>
  `;

  const materiasOrdenadas = obtenerMateriasOrdenadasVisualmente();
  let mostroBannerTeoria = false;
  let mostroBannerTaller = false;

  materiasOrdenadas.forEach(mat => {
    const esTal = esMateriaDeTaller(mat);
    if (amb === "TALLER" && !esTal) return;
    if (amb === "TEORIA" && esTal) return;

    if (!esTal && !mostroBannerTeoria) {
      html += `<div class="section-divider-banner divider-teoria">📘 Materias de Teoría</div>`;
      mostroBannerTeoria = true;
    }
    if (esTal && !mostroBannerTaller) {
      html += `<div class="section-divider-banner divider-taller">🔧 Materias de Taller</div>`;
      mostroBannerTaller = true;
    }

    const notasMat = (est.notas && est.notas[mat.indice]) || {};
    const esResumenTaller = mat.esResumenTallerCB;

    html += `<div class="grade-card ${esResumenTaller ? 'resumen-taller-card' : ''}">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; flex-wrap:wrap;">
        <strong style="font-size:13px; color:#1e3a8a;">${mat.nombre} ${esResumenTaller ? ' 🔧 (Promedio)' : ''}</strong>
        <span class="tag-tipo-mat ${esTal ? 'tag-tipo-taller' : 'tag-tipo-teoria'}" title="Tocá para cambiar entre Teoría y Taller" onclick="alternarTipoMateriaTallerTeoria(${mat.indice})">${esTal ? '🔧 Taller' : '📘 Teoría'}</span>
      </div>
      <div class="grade-inputs-grid">`;
    SUB_CAMPOS.forEach(sc => {
      const colHoja = mat.columnaInicio + sc.offset;
      const deshabilitado = esResumenTaller ? 'disabled' : '';
      html += `<div class="mini-field"><label>${sc.label}</label><div ${deshabilitado}>${crearSelectorNotaHTML(est.filaHoja, colHoja, notasMat[sc.key], sc.tipo)}</div></div>`;
    });
    html += `</div></div>`;
  });

  cont.innerHTML = html;
}

function renderTablaCompleta() {
  const cont = document.getElementById("contenedorTablaCompleta");
  if (!cont) return;
  const mostrarTachados = document.getElementById("chkMostrarTachadosPlanilla")?.checked;
  const mats = obtenerMateriasOrdenadasVisualmente();

  let html = `<table class="app-table"><thead><tr>
    <th rowspan="2">Ord</th><th rowspan="2">Estudiante</th><th rowspan="2">Grp</th><th rowspan="2">Estado</th>`;
  mats.forEach(m => {
    const esTal = esMateriaDeTaller(m);
    const bgHeader = esTal ? "background:#e8f0fe; color:#0d47a1;" : "background:#f1f5f9; color:#1e293b;";
    html += `<th colspan="6" style="${bgHeader}">${esTal ? '🔧 ' : '📘 '}${m.nombre}</th>`;
  });
  html += `</tr><tr>`;
  mats.forEach(() => { html += `<th>1°V</th><th>1°C</th><th>2°V</th><th>2°C</th><th>Int</th><th>Fin</th>`; });
  html += `</tr></thead><tbody>`;

  (estado.estudiantes || []).forEach(est => {
    const tachado = esEstudianteTachado(est);
    if (tachado && !mostrarTachados) return;

    html += `<tr class="${tachado ? 'fila-tachada' : ''}">
      <td>${est.orden}</td><td class="td-left">${est.nombre}</td><td>${est.grupo}</td>
      <td><button type="button" class="${tachado ? 'btn-success-outline' : 'btn-danger-outline'}" style="padding:2px 5px; font-size:10px;" onclick="alternarEstadoTachado(${est.filaHoja})">${tachado ? '✅' : '🚫'}</button></td>`;

    mats.forEach(m => {
      const nm = (est.notas && est.notas[m.indice]) || {};
      SUB_CAMPOS.forEach(sc => {
        const valCelda = nm[sc.key] || "";
        const clColor = obtenerClaseColorNota(valCelda);
        html += `<td class="${clColor}">${valCelda || "-"}</td>`;
      });
    });
    html += `</tr>`;
  });
  html += `</tbody></table>`;
  cont.innerHTML = html;
}

async function guardarCeldaRemota(filaHoja, columnaHoja, selectElem) {
  const val = selectElem.value;
  selectElem.className = obtenerClaseColorNota(val);

  const aluLocal = (estado.estudiantes || []).find(e => e.filaHoja === Number(filaHoja));
  if (aluLocal && aluLocal.notas) {
    (estado.materias || []).forEach(m => {
      SUB_CAMPOS.forEach(sc => {
        if (m.columnaInicio + sc.offset === Number(columnaHoja)) {
          if (!aluLocal.notas[m.indice]) aluLocal.notas[m.indice] = {};
          aluLocal.notas[m.indice][sc.key] = val;
        }
      });
    });
    const boxWA = document.getElementById("waAlumnoPreviewBox");
    if (boxWA) boxWA.textContent = construirMensajeWhatsAppAlumno(aluLocal);
    renderTablaCompleta();
  }

  try {
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ accion: "actualizarCelda", curso: estado.cursoActual, filaHoja: filaHoja, columnaHoja: columnaHoja, valor: val })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);

    if (json.resultado && json.resultado.resumenTaller) {
      const resTaller = json.resultado.resumenTaller;
      if (aluLocal && aluLocal.notas && aluLocal.notas[resTaller.indiceMateriaResumen]) {
        const colRelativa = resTaller.columnaResumen;
        estado.materias.forEach(m => {
          if (m.indice === resTaller.indiceMateriaResumen) {
            const offset = colRelativa - m.columnaInicio;
            const scEncontrado = SUB_CAMPOS.find(s => s.offset === offset);
            if (scEncontrado) {
              aluLocal.notas[m.indice][scEncontrado.key] = resTaller.valorResumen;
            }
          }
        });
        renderVistaAlumno();
        renderTablaCompleta();
      }
    }
    mostrarToast("✅ Guardado");
  } catch (err) {
    mostrarToast("⚠️ Error: " + err.message);
  }
}

async function renombrarMateriaActual() {
  const idxMat = parseInt(document.getElementById("materiaSelect")?.value || "0", 10);
  const mat = (estado.materias || []).find(m => m.indice === idxMat);
  if (!mat) return;
  const nuevo = prompt("Nuevo nombre:", mat.nombre);
  if (!nuevo || !nuevo.trim()) return;

  const resp = await fetch(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ accion: "actualizarNombreMateria", curso: estado.cursoActual, columnaInicio: mat.columnaInicio, nuevoNombre: nuevo.trim() })
  });
  const json = await resp.json();
  if (json.ok) recargarCursoActual();
}

async function eliminarMateriaActual() {
  const idxMat = parseInt(document.getElementById("materiaSelect")?.value || "0", 10);
  const mat = (estado.materias || []).find(m => m.indice === idxMat);
  if (!mat) return;

  const ok = confirm(`⚠️ ¿Seguro que querés ELIMINAR la materia "${mat.nombre}" y sus 6 columnas de calificaciones en Google Sheets?\n\nEsta acción no se puede deshacer.`);
  if (!ok) return;

  try {
    mostrarToast(`⏳ Eliminando "${mat.nombre}"...`);
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "eliminarMateria",
        curso: estado.cursoActual,
        columnaInicio: mat.columnaInicio
      })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);

    aplicarDatosRecibidos(json.data, true);
    mostrarToast(`🗑️ Materia "${mat.nombre}" eliminada`);
  } catch (err) {
    mostrarToast("⚠️ Error al eliminar materia: " + err.message, 4000);
  }
}

async function abrirModalNuevoAlumno() {
  const nombre = prompt("Apellido y Nombre:");
  if (!nombre || !nombre.trim()) return;
  const grupo = prompt("Grupo:", "Grupo 1") || "Grupo 1";
  const orden = (estado.estudiantes || []).length + 1;

  const resp = await fetch(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ accion: "agregarEstudiante", curso: estado.cursoActual, datosAlumno: { orden, nombre: nombre.trim().toUpperCase(), grupo: grupo.trim(), estado: "Activo" } })
  });
  const json = await resp.json();
  if (json.ok) aplicarDatosRecibidos(json.data);
}

async function abrirModalNuevaMateria() {
  const nombreMat = prompt("Nombre de la materia:");
  if (!nombreMat || !nombreMat.trim()) return;
  const resp = await fetch(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ accion: "agregarMateria", curso: estado.cursoActual, nombreMateria: nombreMat.trim() })
  });
  const json = await resp.json();
  if (json.ok) aplicarDatosRecibidos(json.data);
}