function normalizarClaveNombreAlumno(nombreRaw) {
  return String(nombreRaw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^\d+[\.\-\)]\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function ordenarEstudiantesPorNumero(lista) {
  if (!Array.isArray(lista)) return [];
  return lista.sort((a, b) => {
    const na = parseInt(a.orden, 10);
    const nb = parseInt(b.orden, 10);
    if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
    if (!isNaN(na) && isNaN(nb)) return -1;
    if (isNaN(na) && !isNaN(nb)) return 1;
    return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es");
  });
}

function obtenerSiguienteNumeroOrden() {
  const ordenes = (estado.estudiantes || [])
    .map(e => parseInt(e.orden, 10))
    .filter(n => !isNaN(n) && n > 0);
  return ordenes.length > 0 ? Math.max(...ordenes) + 1 : 1;
}

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
  if (typeof esRolFamiliaActual === "function" && esRolFamiliaActual()) return;
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

function parsearNotaNumerica(val) {
  if (val === undefined || val === null) return NaN;
  const str = String(val).trim().replace(",", ".");
  const up = str.toUpperCase();
  if (!str || up === "AUS" || up === "CI") return NaN;
  const n = parseFloat(str);
  return (!isNaN(n) && n >= 1 && n <= 10) ? n : NaN;
}

function obtenerColumnaHojaSubCampo(mat, sc) {
  if (!mat || !sc) return -1;
  const ancho = mat.anchoCols || 6;
  if (ancho >= 8) return mat.columnaInicio + sc.offset;
  if (sc.key === "final") return mat.columnaInicio + 5;
  if (sc.key === "intDic" || sc.key === "intFeb") return -1;
  return mat.columnaInicio + sc.offset;
}

function debeIntensificarMateria(objNotas) {
  if (!objNotas) return false;
  const c1 = parsearNotaNumerica(objNotas.cal1);
  const c2 = parsearNotaNumerica(objNotas.cal2);
  const i1 = parsearNotaNumerica(objNotas.int1);
  const c1Up = String(objNotas.cal1 || "").trim().toUpperCase();
  const c2Up = String(objNotas.cal2 || "").trim().toUpperCase();

  const aprobo1C = (!isNaN(c1) && c1 >= 7) || (!isNaN(i1) && i1 >= 7);
  const aprobo2C = (!isNaN(c2) && c2 >= 7);
  if (aprobo1C && aprobo2C) return false;

  const desaprobo1C = !aprobo1C && ((!isNaN(c1) && c1 < 7) || c1Up === "AUS");
  const desaprobo2C = !aprobo2C && ((!isNaN(c2) && c2 < 7) || c2Up === "AUS");
  return desaprobo1C || desaprobo2C;
}

function debeIntensificarFebrero(objNotas) {
  if (!debeIntensificarMateria(objNotas)) return false;
  const nDic = parsearNotaNumerica(objNotas.intDic);
  if (!isNaN(nDic) && nDic >= 4) return false;
  return true;
}

function calcularCalificacionFinalMateria(objNotas) {
  if (!objNotas) return "";
  const c1 = parsearNotaNumerica(objNotas.cal1);
  const c2 = parsearNotaNumerica(objNotas.cal2);
  const i1 = parsearNotaNumerica(objNotas.int1);

  let notaEfectiva1C = NaN;
  if (!isNaN(i1) && i1 >= 7) {
    notaEfectiva1C = (!isNaN(c1) && c1 >= 7) ? Math.max(c1, i1) : i1;
  } else if (!isNaN(c1) && c1 >= 7) {
    notaEfectiva1C = c1;
  }

  if (!isNaN(notaEfectiva1C) && notaEfectiva1C >= 7 && !isNaN(c2) && c2 >= 7) {
    const prom = Math.round(((notaEfectiva1C + c2) / 2) * 2) / 2;
    return String(prom);
  }

  // En Diciembre y Febrero se aprueba con 4 o más
  const nDic = parsearNotaNumerica(objNotas.intDic);
  if (!isNaN(nDic) && nDic >= 4) {
    return String(nDic);
  }

  const nFeb = parsearNotaNumerica(objNotas.intFeb);
  if (!isNaN(nFeb) && nFeb >= 4) {
    return String(nFeb);
  }

  return "";
}

function calcularResumenSubModulosTallerCB(valoresTresModulos, esValoracion, umbralAprobacion = 7) {
  const limpios = (valoresTresModulos || [])
    .map(v => String(v === undefined || v === null ? "" : v).trim().toUpperCase())
    .filter(Boolean);

  if (limpios.length === 0) return "";

  if (esValoracion) {
    if (limpios.includes("TED")) return "TED";
    if (limpios.includes("TEP")) return "TEP";
    if (limpios.length === 3 && limpios.every(v => v === "TEA")) return "TEA";
    return "";
  }

  const numeros = [];
  let tieneAus = false;
  let tieneCI = false;

  limpios.forEach(v => {
    if (v === "AUS") {
      tieneAus = true;
    } else if (v === "CI") {
      tieneCI = true;
    } else {
      const n = parsearNotaNumerica(v);
      if (!isNaN(n)) numeros.push(n);
    }
  });

  const desaprobadas = numeros.filter(n => n < umbralAprobacion);
  if (desaprobadas.length > 0) {
    return String(Math.max(...desaprobadas));
  }

  if (tieneCI) return "CI";
  if (tieneAus) return "AUS";

  if (numeros.length === 3 && numeros.every(n => n >= umbralAprobacion)) {
    const suma = numeros[0] + numeros[1] + numeros[2];
    return String(Math.round(suma / 3));
  }

  return "";
}

function recalcularNotasEstudianteLocal(est, matEditada, keyEditada) {
  if (!est || !est.notas || !matEditada) return;
  const notasMat = est.notas[matEditada.indice] || {};

  if (["cal1", "cal2", "int1", "intDic", "intFeb"].includes(keyEditada)) {
    notasMat.final = calcularCalificacionFinalMateria(notasMat);
  }

  if (matEditada.esSubTallerCB) {
    const modulosSub = (estado.materias || []).filter(m => m.esSubTallerCB).slice(0, 3);
    const matResumen = (estado.materias || []).find(m => m.esResumenTallerCB);

    if (modulosSub.length === 3 && matResumen) {
      if (!est.notas[matResumen.indice]) est.notas[matResumen.indice] = {};
      const notasResumen = est.notas[matResumen.indice];

      ["val1", "val2"].forEach(kVal => {
        const vals = modulosSub.map(m => (est.notas[m.indice] && est.notas[m.indice][kVal]) || "");
        notasResumen[kVal] = calcularResumenSubModulosTallerCB(vals, true, 7);
      });

      ["cal1", "cal2"].forEach(kCal => {
        const cals = modulosSub.map(m => (est.notas[m.indice] && est.notas[m.indice][kCal]) || "");
        notasResumen[kCal] = calcularResumenSubModulosTallerCB(cals, false, 7);
      });

      const tieneAlgunInt1 = modulosSub.some(m => String((est.notas[m.indice] && est.notas[m.indice].int1) || "").trim() !== "");
      if (tieneAlgunInt1) {
        const calsInt1Efectivas = modulosSub.map(m => {
          const nM = est.notas[m.indice] || {};
          const vInt = String(nM.int1 || "").trim();
          if (vInt !== "") return vInt;
          const nCal1 = parsearNotaNumerica(nM.cal1);
          return (!isNaN(nCal1) && nCal1 >= 7) ? String(nM.cal1) : "";
        });
        notasResumen.int1 = calcularResumenSubModulosTallerCB(calsInt1Efectivas, false, 7);
      } else {
        notasResumen.int1 = "";
      }

      // Intensificación Diciembre para Taller CB (umbral 4)
      const tieneAlgunDic = modulosSub.some(m => String((est.notas[m.indice] && est.notas[m.indice].intDic) || "").trim() !== "");
      if (tieneAlgunDic) {
        const valsDic = modulosSub.map(m => {
          const nM = est.notas[m.indice] || {};
          const vDic = String(nM.intDic || "").trim();
          if (vDic !== "") return vDic;
          const nFin = parsearNotaNumerica(calcularCalificacionFinalMateria({ ...nM, intDic: "", intFeb: "" }));
          return (!isNaN(nFin) && nFin >= 7) ? String(nFin) : "";
        });
        notasResumen.intDic = calcularResumenSubModulosTallerCB(valsDic, false, 4);
      } else {
        notasResumen.intDic = "";
      }

      // Intensificación Febrero para Taller CB (umbral 4)
      const tieneAlgunFeb = modulosSub.some(m => String((est.notas[m.indice] && est.notas[m.indice].intFeb) || "").trim() !== "");
      if (tieneAlgunFeb) {
        const valsFeb = modulosSub.map(m => {
          const nM = est.notas[m.indice] || {};
          const vFeb = String(nM.intFeb || "").trim();
          if (vFeb !== "") return vFeb;
          const nDic = parsearNotaNumerica(nM.intDic);
          if (!isNaN(nDic) && nDic >= 4) return String(nDic);
          const nFin = parsearNotaNumerica(calcularCalificacionFinalMateria({ ...nM, intDic: "", intFeb: "" }));
          return (!isNaN(nFin) && nFin >= 7) ? String(nFin) : "";
        });
        notasResumen.intFeb = calcularResumenSubModulosTallerCB(valsFeb, false, 4);
      } else {
        notasResumen.intFeb = "";
      }

      notasResumen.final = calcularCalificacionFinalMateria(notasResumen);
    }
  }
}

function obtenerClaseColorNota(valor) {
  const v = String(valor === undefined || valor === null ? "" : valor).trim().toUpperCase();
  if (!v || v === "-") return "";

  if (v === "TEA") return "val-TEA";
  if (v === "TEP") return "val-TEP";
  if (v === "TED") return "val-TED";
  if (v === "CI") return "val-CI";
  if (v === "AUS") return "cal-rojo";

  const num = parseFloat(v.replace(",", "."));
  if (!isNaN(num)) {
    if (num >= 1 && num <= 3) return "cal-rojo";
    if (num >= 4 && num < 7) return "cal-verde";
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

function buscarEstudianteEnNominaConDetalle(textoNomina, est) {
  if (!textoNomina) return { presenteEnNomina: false, esJustificada: false };
  const limp = String(textoNomina).split("| Obs:")[0].trim();
  if (!limp || limp.toLowerCase().indexOf("sin ") === 0 || limp.indexOf("[SIN ACTIVIDAD") === 0) {
    return { presenteEnNomina: false, esJustificada: false };
  }

  const items = limp.split("|").map(s => s.trim()).filter(Boolean);
  const ordStr = String(est.orden || "").trim();
  const ordPad = ordStr.padStart(2, "0");
  const nomEstLower = String(est.nombre || "").trim().toLowerCase();

  for (const item of items) {
    const tieneJ = item.indexOf("[J]") !== -1;
    const itemSinJ = item.replace(/\[J\]/gi, "").trim();
    const itemLow = itemSinJ.toLowerCase();

    if (nomEstLower && itemLow.indexOf(nomEstLower) !== -1) {
      return { presenteEnNomina: true, esJustificada: tieneJ };
    }
    const mOrd = itemSinJ.match(/^(?:Orden\s*N°\s*)?0*(\d+)[\.\s]/i);
    if (mOrd && mOrd[1] === ordStr) {
      return { presenteEnNomina: true, esJustificada: tieneJ };
    }
    if (itemSinJ.startsWith(`${ordPad}.`) || itemSinJ.startsWith(`${ordStr}.`)) {
      return { presenteEnNomina: true, esJustificada: tieneJ };
    }
  }
  return { presenteEnNomina: false, esJustificada: false };
}

function obtenerFechasInasistenciasEstudiante(est) {
  const hist = estado.historialAsistencias || [];
  const teoSet = new Set();
  const talSet = new Set();

  const copiaHist = [...hist].reverse();
  copiaHist.forEach(item => {
    if (item.estadoDia && item.estadoDia !== "NORMAL") return;
    if (String(item.nominaAusentes || "").indexOf("[SIN ACTIVIDAD") === 0) return;

    const fCorta = fechaCortaDDMM(item.fecha);
    if (!fCorta) return;
    const esTal = turnoPerteneceATaller(item.turnoGrupo);

    const infoAus = buscarEstudianteEnNominaConDetalle(item.nominaAusentes, est);
    const infoTar = buscarEstudianteEnNominaConDetalle(item.nominaTardes, est);

    if (infoAus.presenteEnNomina) {
      const etiqueta = infoAus.esJustificada ? `${fCorta}(J)` : fCorta;
      if (esTal) talSet.add(etiqueta);
      else teoSet.add(etiqueta);
    } else if (infoTar.presenteEnNomina) {
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

function formatearEstudianteParaWhatsApp(est) {
  const ordStr = String(est.orden || "").padStart(2, "0");
  const grp = est.grupo ? ` (${est.grupo})` : "";
  return `Orden N° ${ordStr}${grp}`;
}

function esEstudianteTachado(est) {
  const st = String(est.estado || "Activo").toLowerCase();
  return st.indexOf("tachado") !== -1 || st.indexOf("baja") !== -1 || st.indexOf("pase") !== -1;
}

function obtenerDiaSemanaDesdeFechaDDMMYYYY(fechaStr) {
  const norm = normalizarFechaDDMMYYYY(fechaStr);
  const m = norm.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  const d = parseInt(m[1], 10);
  const mes = parseInt(m[2], 10) - 1;
  const y = parseInt(m[3], 10);
  const dateObj = new Date(y, mes, d, 12, 0, 0);
  const mapaDias = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
  return mapaDias[dateObj.getDay()] || "";
}

function normalizarLetraGrupo(grpRaw) {
  const s = String(grpRaw || "").toUpperCase().trim();
  if (!s || s === "TEO" || s === "ALL" || s.indexOf("COMPLETO") !== -1) return "ALL";
  const m = s.match(/(?:GRUPO|GR\.?)\s*([A-Z0-9]+)/i);
  if (m && m[1]) return m[1].toUpperCase();
  return s;
}

function esBloqueEdFisica(bloque) {
  if (!bloque) return false;
  const mod = String(bloque.modalidad || "").toUpperCase().trim();
  const tur = String(bloque.turno || "").toUpperCase().trim();
  const mat = String(bloque.materia || "").toUpperCase().trim();
  return mod === "ED_FISICA" || tur.indexOf("FÍSICA") !== -1 || tur.indexOf("FISICA") !== -1 || mat.indexOf("EDUCACIÓN FÍSICA") !== -1 || mat.indexOf("EDUCACION FISICA") !== -1;
}

function bloqueCoincideConTurnoParte(bloque, turnoGrupoStr) {
  const tParte = String(turnoGrupoStr || "").toUpperCase().trim();
  const tBloque = String(bloque.turno || "").toUpperCase().trim();
  const modBloque = String(bloque.modalidad || "").toUpperCase().trim();
  const esEdFisBloque = esBloqueEdFisica(bloque);
  const esEdFisParte = tParte.indexOf("EDUCACIÓN FÍSICA") !== -1 || tParte.indexOf("EDUCACION FISICA") !== -1;

  if (esEdFisParte) return esEdFisBloque;
  if (esEdFisBloque) return false;

  const esTalBloque = modBloque === "TALLER" || Boolean(bloque.esTaller) || tBloque.indexOf("TALLER") !== -1;
  const esTalParte = tParte.indexOf("TALLER") !== -1;

  if (esTalParte !== esTalBloque) return false;

  const prefTurnoParte = tParte.split(/[\s\-]/)[0]; // TM, TT, TV
  if (["TM", "TT", "TV"].includes(prefTurnoParte)) {
    if (tBloque.indexOf(prefTurnoParte) === -1) return false;
  }

  if (esTalParte) {
    const mGrpParte = tParte.match(/\(([^)]+)\)/);
    const grpParte = mGrpParte ? normalizarLetraGrupo(mGrpParte[1]) : normalizarLetraGrupo(tParte);
    const grpBloque = normalizarLetraGrupo(bloque.grupo);
    if (grpParte !== "ALL" && grpBloque !== "ALL" && grpParte !== grpBloque) {
      return false;
    }
  }
  return true;
}

function bloqueTieneHorarioYProfesor(b) {
  if (!b) return false;
  const vacios = ["", "-", "—", "S/D", "SIN CARGAR", "SIN PROFESOR", "VACANTE", "A CONFIRMAR"];
  const mat = String(b.materia || "").trim().toUpperCase();
  const hor = String(b.horario || "").trim().toUpperCase();
  const prof = String(b.profesor || "").trim().toUpperCase();
  if (vacios.includes(mat)) return false;
  if (vacios.includes(hor)) return false;
  if (vacios.includes(prof)) return false;
  return true;
}

function obtenerBloquesDelDiaYTurno(fechaDDMMYYYY, turnoGrupoStr, soloConHorarioYProfe = false) {
  const diaSemana = obtenerDiaSemanaDesdeFechaDDMMYYYY(fechaDDMMYYYY);
  if (!diaSemana) return [];
  const bloques = (estado.horarioParte && estado.horarioParte.bloques) || [];
  return bloques.filter(b => {
    const diaB = String(b.dia || "").trim().toUpperCase();
    if (diaB !== diaSemana || !bloqueCoincideConTurnoParte(b, turnoGrupoStr)) return false;
    if (soloConHorarioYProfe && !bloqueTieneHorarioYProfesor(b)) return false;
    return true;
  });
}

function renderAsistenciaDocenteDia() {
  const cont = document.getElementById("contenedorAsistenciaDocenteDia");
  if (!cont) return;

  const estadoDia = obtenerEstadoDiaActual();
  if (estadoDia !== "NORMAL") {
    cont.innerHTML = "";
    cont.style.display = "none";
    return;
  }

  const turnoValFull = document.getElementById("asistTurnoGrupo")?.value || "";
  if (turnoValFull === "SIN_CLASES|NONE") {
    cont.innerHTML = "";
    cont.style.display = "none";
    return;
  }
  const fechaStr = formatearFechaInput();
  const turnoRaw = turnoValFull.split("|")[0].trim();
  const bloquesHoy = obtenerBloquesDelDiaYTurno(fechaStr, turnoRaw, true);
  const diaSem = obtenerDiaSemanaDesdeFechaDDMMYYYY(fechaStr);

  if (bloquesHoy.length === 0) {
    cont.style.display = "block";
    cont.innerHTML = `
      <div class="prof-asist-title">
        <span>👩‍🏫 Asistencia Docente por Materia (${diaSem || "Día"} — ${turnoRaw})</span>
        <small style="color:#64748b; font-weight:600;">Sin bloques configurados para este día/turno en 🗓️ Horarios Parte</small>
      </div>
    `;
    return;
  }

  const materiasUnicas = [];
  bloquesHoy.forEach(b => {
    const nomMat = String(b.materia || "").trim();
    if (nomMat && !materiasUnicas.some(m => m.materia === nomMat)) {
      materiasUnicas.push({
        materia: nomMat,
        profesor: b.profesor || "",
        horario: b.horario || ""
      });
    }
  });

  cont.style.display = "block";
  let html = `
    <div class="prof-asist-title">
      <span>Asistencia Docente — ${diaSem} (${turnoRaw})</span>
      <small style="color:#475569;">Marcá la materia si el docente no asistió</small>
    </div>
    <div class="prof-pills-wrap">
  `;

  materiasUnicas.forEach(item => {
    const sinProf = materiasSinProfesorActual.includes(item.materia);
    const profTxt = item.profesor ? ` (${item.profesor})` : "";
    const matEsc = item.materia.replace(/'/g, "\\'");
    html += `
      <button type="button" class="prof-chk-pill ${sinProf ? 'sin-profesor' : ''}" onclick="alternarMateriaSinProfesor('${matEsc}')">
        <span>${sinProf ? '🚫 Sin Profesor:' : '✅ Dictada:'}</span>
        <strong>${item.materia}</strong>
        <small>${profTxt}</small>
      </button>
    `;
  });

  html += `</div>`;
  cont.innerHTML = html;
}

function alternarMateriaSinProfesor(nombreMat) {
  const idx = materiasSinProfesorActual.indexOf(nombreMat);
  if (idx === -1) {
    materiasSinProfesorActual.push(nombreMat);
  } else {
    materiasSinProfesorActual.splice(idx, 1);
  }
  renderAsistenciaDocenteDia();
  actualizarVistaPreviaWA();
}

function claveMateriaNormalizada(nom) {
  return String(nom || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase();
}

function materiasCoincidenNombre(nomPlanilla, nomHorario) {
  const a = claveMateriaNormalizada(limpiarNombreMateria(nomPlanilla));
  const b = claveMateriaNormalizada(nomHorario);
  if (!a || !b) return false;
  if (a === b || a.indexOf(b) !== -1 || b.indexOf(a) !== -1) return true;
  if (a.length >= 6 && b.length >= 6 && a.slice(0, 6) === b.slice(0, 6)) return true;
  return false;
}

function calcularAsistenciaPorMateriaEstudiante(est) {
  if (!est) return [];
  const hist = estado.historialAsistencias || [];
  const bloquesConfig = (estado.horarioParte && estado.horarioParte.bloques) || [];
  const grpAluNorm = normalizarLetraGrupo(est.grupo);

  const catalogo = [];
  obtenerMateriasOrdenadasVisualmente().forEach(m => {
    if (m.esResumenTallerCB) return;
    catalogo.push({
      nombre: limpiarNombreMateria(m.nombre),
      esTaller: esMateriaDeTaller(m),
      clasesDictadas: 0,
      clasesSinProfesor: 0,
      presentes: 0,
      tardes: 0,
      ausentesInjustif: 0,
      ausentesJustif: 0,
      fechasAusente: []
    });
  });

  bloquesConfig.forEach(b => {
    const nomB = String(b.materia || "").trim();
    if (!nomB) return;
    const existe = catalogo.find(c => materiasCoincidenNombre(c.nombre, nomB));
    if (!existe) {
      catalogo.push({
        nombre: nomB,
        esTaller: b.modalidad === "TALLER" || Boolean(b.esTaller),
        clasesDictadas: 0,
        clasesSinProfesor: 0,
        presentes: 0,
        tardes: 0,
        ausentesInjustif: 0,
        ausentesJustif: 0,
        fechasAusente: []
      });
    }
  });

  const copiaHist = [...hist].reverse();
  copiaHist.forEach(parte => {
    if (parte.estadoDia && parte.estadoDia !== "NORMAL") return;
    if (String(parte.nominaAusentes || "").indexOf("[SIN ACTIVIDAD") === 0) return;

    const turnoParte = String(parte.turnoGrupo || "").trim();
    if (turnoPerteneceATaller(turnoParte)) {
      const mGrp = turnoParte.match(/\(([^)]+)\)/);
      const grpParte = mGrp ? normalizarLetraGrupo(mGrp[1]) : normalizarLetraGrupo(turnoParte);
      if (grpParte !== "ALL" && grpAluNorm !== "ALL" && grpParte !== grpAluNorm) {
        return;
      }
    }

    const bloquesDiaTurno = obtenerBloquesDelDiaYTurno(parte.fecha, turnoParte);
    if (bloquesDiaTurno.length === 0) return;

    const matsDelParte = [];
    bloquesDiaTurno.forEach(b => {
      const grpB = normalizarLetraGrupo(b.grupo);
      if (grpB !== "ALL" && grpAluNorm !== "ALL" && grpB !== grpAluNorm) return;
      const nomMat = String(b.materia || "").trim();
      if (nomMat && !matsDelParte.includes(nomMat)) matsDelParte.push(nomMat);
    });

    const listaSinProf = Array.isArray(parte.materiasSinProfesor) ? parte.materiasSinProfesor : [];
    const infoAus = buscarEstudianteEnNominaConDetalle(parte.nominaAusentes, est);
    const infoTar = buscarEstudianteEnNominaConDetalle(parte.nominaTardes, est);
    const fCorta = fechaCortaDDMM(parte.fecha);

    matsDelParte.forEach(nomMatHorario => {
      const regCat = catalogo.find(c => materiasCoincidenNombre(c.nombre, nomMatHorario));
      if (!regCat) return;

      if (listaSinProf.some(sp => materiasCoincidenNombre(sp, nomMatHorario))) {
        regCat.clasesSinProfesor++;
        return;
      }

      regCat.clasesDictadas++;
      if (infoAus.presenteEnNomina) {
        if (infoAus.esJustificada) {
          regCat.ausentesJustif++;
          regCat.fechasAusente.push(`${fCorta}(J)`);
        } else {
          regCat.ausentesInjustif++;
          regCat.fechasAusente.push(fCorta);
        }
      } else if (infoTar.presenteEnNomina) {
        regCat.tardes++;
      } else {
        regCat.presentes++;
      }
    });
  });

  return catalogo.map(item => {
    const asistidasEfectivas = item.presentes + item.tardes;
    const porcentaje = item.clasesDictadas > 0
      ? Math.round((asistidasEfectivas / item.clasesDictadas) * 100)
      : 100;
    return {
      ...item,
      asistidasEfectivas: asistidasEfectivas,
      porcentaje: porcentaje,
      enRegla75: porcentaje >= 75
    };
  });
}

const ETIQUETAS_ESTADO_DIA = {
  NORMAL: "Clases Normales",
  SIN_DOCENTES: "Sin Docentes",
  SUSPENSION: "Suspensión de Clases",
  FERIADO: "Feriado / Asueto",
  PARO: "Paro Docente / Transporte",
  JORNADA: "Jornada Institucional"
};

function obtenerEstadoDiaActual() {
  const sel = document.getElementById("asistEstadoDia");
  return sel ? (sel.value || "NORMAL") : "NORMAL";
}

function obtenerEtiquetaMotivoDia(codigo) {
  return ETIQUETAS_ESTADO_DIA[codigo] || codigo || "Sin Actividad";
}

function alCambiarEstadoDia() {
  renderListaAsistencia();
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
  if (mapaNumAMes[numMes] && document.getElementById("asistMes")) {
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
  actualizarOpcionesTurnoGrupo();
  cargarParteGuardadoSiExiste();
  renderListaAsistencia();
}


function autoseleccionarModalidadDia(fechaDDMMYYYY) {
  const selMod = document.getElementById("asistModalidad");
  if (!selMod) return;
  const diaSem = obtenerDiaSemanaDesdeFechaDDMMYYYY(fechaDDMMYYYY || formatearFechaInput());
  const bloques = ((estado.horarioParte && estado.horarioParte.bloques) || [])
    .filter(b => String(b.dia || "").trim().toUpperCase() === diaSem && bloqueTieneHorarioYProfesor(b));

  const tieneTeo = bloques.some(b => !esBloqueEdFisica(b) && String(b.modalidad || "").toUpperCase() !== "TALLER" && !b.esTaller);
  const tieneTal = bloques.some(b => !esBloqueEdFisica(b) && (String(b.modalidad || "").toUpperCase() === "TALLER" || Boolean(b.esTaller)));
  const tieneEF = bloques.some(b => esBloqueEdFisica(b));

  // Regla actual de la escuela: siempre 0.50 (DOBLE), salvo triple turno (Teoría + Taller + Ed. Física = 0.33)
  if (tieneTeo && tieneTal && tieneEF) {
    selMod.value = "TRIPLE";
  } else {
    selMod.value = "DOBLE";
  }
}

function cargarParteGuardadoSiExiste() {
  asistenciaActual = {};
  materiasSinProfesorActual = [];
  (estado.estudiantes || []).forEach(est => { asistenciaActual[est.filaHoja] = "P"; });

  const fechaBuscada = formatearFechaInput();
  const turnoBuscado = (document.getElementById("asistTurnoGrupo")?.value || "").split("|")[0].trim();
  const banner = document.getElementById("bannerEstadoParte");
  const selEstDia = document.getElementById("asistEstadoDia");
  const inpObs = document.getElementById("asistObs");

  const registroExistente = (estado.historialAsistencias || []).find(item => {
    const fItem = normalizarFechaDDMMYYYY(item.fecha);
    const tItem = String(item.turnoGrupo || "").trim();
    return fItem === fechaBuscada && tItem === turnoBuscado;
  });

  if (!registroExistente) {
    if (selEstDia) selEstDia.value = "NORMAL";
    if (inpObs) inpObs.value = "";
    autoseleccionarModalidadDia(fechaBuscada);
    if (banner) {
      banner.className = "edit-mode-banner new-entry";
      banner.textContent = `🆕 Parte nuevo para ${fechaBuscada} (${turnoBuscado}).`;
    }
    return false;
  }

  const selMod = document.getElementById("asistModalidad");
  if (selMod && registroExistente.valorAusencia) {
    const vAus = Number(registroExistente.valorAusencia);
    if (vAus === 0.33) selMod.value = "TRIPLE";
    else if (vAus === 1) selMod.value = "SIMPLE";
    else if (vAus === 0.5) selMod.value = "DOBLE";
  }

  let estDiaGuardado = registroExistente.estadoDia || "NORMAL";
  const textoAus = String(registroExistente.nominaAusentes || "");
  if (estDiaGuardado === "NORMAL" && textoAus.indexOf("[SIN ACTIVIDAD:") === 0) {
    const mMotivo = textoAus.match(/\[SIN ACTIVIDAD:\s*([^—\]]+)/i);
    const txtMot = mMotivo ? mMotivo[1].trim().toLowerCase() : "";
    if (txtMot.indexOf("docente") !== -1) estDiaGuardado = "SIN_DOCENTES";
    else if (txtMot.indexOf("suspens") !== -1) estDiaGuardado = "SUSPENSION";
    else if (txtMot.indexOf("feriado") !== -1 || txtMot.indexOf("asueto") !== -1) estDiaGuardado = "FERIADO";
    else if (txtMot.indexOf("paro") !== -1) estDiaGuardado = "PARO";
    else if (txtMot.indexOf("jornada") !== -1) estDiaGuardado = "JORNADA";
    else estDiaGuardado = "SUSPENSION";
  }
  if (selEstDia) selEstDia.value = estDiaGuardado;

  if (Array.isArray(registroExistente.materiasSinProfesor)) {
    materiasSinProfesorActual = [...registroExistente.materiasSinProfesor];
  }

  if (estDiaGuardado === "NORMAL" && textoAus && textoAus.toLowerCase() !== "sin ausentes") {
    textoAus.split("|").map(s => s.trim()).forEach(itemStr => {
      const esJust = itemStr.indexOf("[J]") !== -1;
      const limpioItem = itemStr.replace(/\[J\]/gi, "").trim();
      marcarEstudianteDesdeTextoHistorial(limpioItem, esJust ? "J" : "A");
    });
  }

  let textoTar = String(registroExistente.nominaTardes || "");
  let obsGuardada = "";
  if (textoTar.indexOf("| Obs:") !== -1) {
    const divObs = textoTar.split("| Obs:");
    textoTar = divObs[0].trim();
    obsGuardada = (divObs[1] || "")
      .replace(/\s*\[ValAus:[0-9.]+\]/g, "")
      .replace(/\s*\[EstDia:[A-Z_]+\]/g, "")
      .replace(/\s*\[SinProf:[^\]]+\]/g, "")
      .trim();
  }
  if (inpObs) inpObs.value = obsGuardada;

  if (estDiaGuardado === "NORMAL" && textoTar && textoTar.toLowerCase() !== "sin tardes" && textoTar.toLowerCase() !== "sin actividad") {
    textoTar.split("|").map(s => s.trim()).forEach(itemStr => marcarEstudianteDesdeTextoHistorial(itemStr, "T"));
  }

  if (banner) {
    banner.className = "edit-mode-banner saved";
    const extraEstado = estDiaGuardado !== "NORMAL" ? ` — [${obtenerEtiquetaMotivoDia(estDiaGuardado)}]` : "";
    const extraSinProf = materiasSinProfesorActual.length > 0 ? ` — [Sin Prof: ${materiasSinProfesorActual.join(", ")}]` : "";
    banner.textContent = `📌 Viendo parte guardado del ${fechaBuscada} (${turnoBuscado})${extraEstado}${extraSinProf}.`;
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

  actualizarOpcionesTurnoGrupo(String(item.turnoGrupo || "").trim());
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

  const nuevoOrdenRaw = prompt("N° de Orden en la lista:", est.orden);
  if (nuevoOrdenRaw === null) return;
  const nuevoOrdenNum = parseInt(String(nuevoOrdenRaw).trim(), 10);
  const nuevoOrden = (!isNaN(nuevoOrdenNum) && nuevoOrdenNum > 0) ? nuevoOrdenNum : String(nuevoOrdenRaw).trim();
  if (!nuevoOrden) {
    mostrarToast("⚠️ El N° de orden no puede quedar vacío");
    return;
  }

  const nuevoNombreRaw = prompt("Apellido y Nombre:", est.nombre);
  if (nuevoNombreRaw === null) return;
  const nuevoNombre = nuevoNombreRaw.replace(/^\d+[\.\-\)]\s*/, "").trim().toUpperCase();
  if (!nuevoNombre) {
    mostrarToast("⚠️ El nombre no puede quedar vacío");
    return;
  }

  const claveNueva = normalizarClaveNombreAlumno(nuevoNombre);
  const duplicado = (estado.estudiantes || []).find(
    e => e.filaHoja !== Number(filaHoja) && normalizarClaveNombreAlumno(e.nombre) === claveNueva
  );
  if (duplicado) {
    mostrarToast(`⚠️ Ya existe "${duplicado.orden}. ${duplicado.nombre}" en la lista.`, 4500);
    return;
  }

  const nuevoGrupo = prompt("Grupo:", est.grupo || "Grupo 1");
  if (nuevoGrupo === null) return;

  try {
    mostrarToast("⏳ Actualizando datos del estudiante...");
    await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ accion: "actualizarCelda", curso: estado.cursoActual, filaHoja: est.filaHoja, columnaHoja: 1, valor: nuevoOrden })
    });
    await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ accion: "actualizarCelda", curso: estado.cursoActual, filaHoja: est.filaHoja, columnaHoja: 2, valor: nuevoNombre })
    });
    await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ accion: "actualizarCelda", curso: estado.cursoActual, filaHoja: est.filaHoja, columnaHoja: 3, valor: nuevoGrupo.trim() })
    });

    est.orden = nuevoOrden;
    est.nombre = nuevoNombre;
    est.grupo = nuevoGrupo.trim();
    ordenarEstudiantesPorNumero(estado.estudiantes);
    aplicarDatosRecibidos(estado, true);
    mostrarToast(`✅ Actualizado: ${est.orden}. ${est.nombre}`);
  } catch (err) {
    mostrarToast("⚠️ Error: " + err.message, 4000);
  }
}

async function eliminarEstudianteDeMatricula(filaHoja) {
  const est = (estado.estudiantes || []).find(e => e.filaHoja === Number(filaHoja));
  if (!est || !confirm(`⚠️ ¿Eliminar definitivamente a "${est.orden}. ${est.nombre}"?`)) return;

  const deseaRenumerar = confirm(
    `¿Querés renumerar automáticamente los N° de Orden (1, 2, 3...) después de eliminar a ${est.nombre} para que no queden números salteados?`
  );

  try {
    mostrarToast("⏳ Eliminando estudiante...");
    for (let col = 1; col <= 4; col++) {
      await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ accion: "actualizarCelda", curso: estado.cursoActual, filaHoja: est.filaHoja, columnaHoja: col, valor: "" })
      });
    }
    estado.estudiantes = (estado.estudiantes || []).filter(e => e.filaHoja !== Number(filaHoja));
    delete asistenciaActual[filaHoja];

    if (deseaRenumerar && estado.estudiantes.length > 0) {
      await renumerarOrdenEstudiantesCurso(true);
    } else {
      aplicarDatosRecibidos(estado, true);
      mostrarToast("🗑️ Estudiante eliminado");
    }
  } catch (err) {
    mostrarToast("⚠️ Error: " + err.message, 4000);
  }
}

async function renumerarOrdenEstudiantesCurso(silencioso = false) {
  const lista = estado.estudiantes || [];
  if (lista.length === 0) {
    mostrarToast("No hay estudiantes en el curso.");
    return;
  }

  const vistos = new Map();
  const duplicados = [];
  lista.forEach(est => {
    const clave = normalizarClaveNombreAlumno(est.nombre);
    if (!clave) return;
    if (vistos.has(clave)) {
      duplicados.push({ repetido: est, original: vistos.get(clave) });
    } else {
      vistos.set(clave, est);
    }
  });

  if (!silencioso) {
    let msgConfirm = `🔢 ¿Querés corregir y renumerar los N° de Orden de toda la lista de 1 a ${lista.length - duplicados.length}?`;
    if (duplicados.length > 0) {
      msgConfirm += `\n\n🧹 Además se detectaron ${duplicados.length} estudiante(s) duplicado(s) que serán unificados automáticamente conservando su último grupo asignado.`;
    }
    if (!confirm(msgConfirm)) return;
  }

  try {
    mostrarToast("⏳ Corrigiendo numeración y sincronizando con Sheets...");

    const respLote = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "renumerarEstudiantes",
        curso: estado.cursoActual
      })
    });
    const jsonLote = await respLote.json();
    if (!jsonLote.ok) throw new Error(jsonLote.error);

    aplicarDatosRecibidos(jsonLote.data, true);
    mostrarToast(`✅ Numeración corregida (1 a ${estado.estudiantes.length})`);
  } catch (err) {
    mostrarToast("⚠️ Error al renumerar: " + err.message, 4000);
  }
}

function actualizarOpcionesTurnoGrupo(turnoForzado = "") {
  const sel = document.getElementById("asistTurnoGrupo");
  if (!sel) return;
  const valorPrevio = sel.value;
  const gruposSet = new Set();
  (estado.estudiantes || []).forEach(e => { if (e.grupo) gruposSet.add(e.grupo.trim()); });

  const todasOpciones = [
    { label: "TM - Teoría (Curso Completo)", value: "TM - Teoría|ALL" },
    { label: "TT - Teoría (Curso Completo)", value: "TT - Teoría|ALL" },
    { label: "TV - Teoría (Curso Completo)", value: "TV - Teoría|ALL" },
    { label: "Educación Física (Curso Completo)", value: "Educación Física|ALL" }
  ];

  gruposSet.forEach(g => {
    todasOpciones.push({ label: `TM Taller - Solo ${g}`, value: `TM Taller (${g})|${g}` });
    todasOpciones.push({ label: `TT Taller - Solo ${g}`, value: `TT Taller (${g})|${g}` });
    todasOpciones.push({ label: `TV Taller - Solo ${g}`, value: `TV Taller (${g})|${g}` });
  });

  const bloquesConfig = (estado.horarioParte && estado.horarioParte.bloques) || [];
  const fechaStr = formatearFechaInput();
  const diaSem = obtenerDiaSemanaDesdeFechaDDMMYYYY(fechaStr);

  let opcionesFinales = todasOpciones;

  if (bloquesConfig.length > 0 && fechaStr) {
    opcionesFinales = todasOpciones.filter(o => {
      const turnoBase = o.value.split("|")[0].trim();
      return obtenerBloquesDelDiaYTurno(fechaStr, turnoBase, true).length > 0;
    });

    if (turnoForzado) {
      const yaEsta = opcionesFinales.some(o => o.value.split("|")[0].trim() === turnoForzado);
      if (!yaEsta) {
        const matchOrig = todasOpciones.find(o => o.value.split("|")[0].trim() === turnoForzado);
        if (matchOrig) {
          opcionesFinales.push({ label: `${matchOrig.label} (Histórico)`, value: matchOrig.value });
        } else {
          opcionesFinales.push({ label: `${turnoForzado} (Histórico)`, value: `${turnoForzado}|ALL` });
        }
      }
    }
  }

  sel.innerHTML = "";

  if (opcionesFinales.length === 0) {
    const optVacio = document.createElement("option");
    optVacio.value = "SIN_CLASES|NONE";
    optVacio.textContent = `Sin clases programadas (${diaSem || "este día"})`;
    sel.appendChild(optVacio);
    sel.value = "SIN_CLASES|NONE";
    return;
  }

  opcionesFinales.forEach(o => {
    const opt = document.createElement("option");
    opt.value = o.value;
    opt.textContent = o.label;
    sel.appendChild(opt);
  });

  if ([...sel.options].some(o => o.value === valorPrevio)) {
    sel.value = valorPrevio;
  } else {
    sel.selectedIndex = 0;
  }
}

function obtenerEstudiantesFiltradosAsistencia() {
  const filtroVal = document.getElementById("asistTurnoGrupo")?.value || "TT - Teoría|ALL";
  const grupoFiltro = filtroVal.split("|")[1] || "ALL";
  if (grupoFiltro === "NONE") return [];

  return (estado.estudiantes || []).filter(est => {
    if (esEstudianteTachado(est)) return false;
    if (grupoFiltro === "ALL") return true;
    return est.grupo.toLowerCase() === grupoFiltro.toLowerCase();
  });
}

function obtenerEstudiantesTachadosDelFiltro() {
  const filtroVal = document.getElementById("asistTurnoGrupo")?.value || "TT - Teoría|ALL";
  const grupoFiltro = filtroVal.split("|")[1] || "ALL";

  return (estado.estudiantes || []).filter(est => {
    if (!esEstudianteTachado(est)) return false;
    if (grupoFiltro === "ALL") return true;
    return est.grupo.toLowerCase() === grupoFiltro.toLowerCase();
  });
}

function obtenerValorAusenciaActual() {
  const mod = document.getElementById("asistModalidad")?.value || "DOBLE";
  if (mod === "TRIPLE") return 0.33;
  if (mod === "SIMPLE") return 1.0;
  return 0.5;
}

function renderListaAsistencia() {
  const cont = document.getElementById("listaAsistenciaContainer");
  const contTachados = document.getElementById("contenedorTachadosAsistencia");
  if (!cont || !contTachados) return;

  renderAsistenciaDocenteDia();

  const lista = obtenerEstudiantesFiltradosAsistencia();
  const listaTachados = obtenerEstudiantesTachadosDelFiltro();
  const valAus = obtenerValorAusenciaActual();
  const estadoDia = obtenerEstadoDiaActual();
  const selMod = document.getElementById("asistModalidad");
  if (selMod) selMod.disabled = (estadoDia !== "NORMAL");

  let p = 0, a = 0, j = 0, t = 0;
  const turnoSelVal = document.getElementById("asistTurnoGrupo")?.value || "";
  const sinClasesHoy = turnoSelVal === "SIN_CLASES|NONE";
  const btnGuardarAsist = document.getElementById("btnSoloGuardarAsistencia");
  if (btnGuardarAsist && btnGuardarAsist.textContent.indexOf("Guardando") === -1) {
    btnGuardarAsist.disabled = sinClasesHoy;
  }

  if (sinClasesHoy) {
    const diaSem = obtenerDiaSemanaDesdeFechaDDMMYYYY(formatearFechaInput()) || "este día";
    cont.innerHTML = `
      <div class="no-activity-card">
        <strong>📅 ${diaSem} — Sin turnos con clases programadas</strong>
        <p>No hay bloques con horario y docente asignado en <b>Horarios Parte</b> para este día.<br>
        <button type="button" class="btn-outline" style="margin-top:8px;" onclick="abrirModalConfigHorario()">🗓️ Configurar Horarios Parte</button></p>
      </div>
    `;
  } else if (estadoDia !== "NORMAL") {
    const etiquetaMotivo = obtenerEtiquetaMotivoDia(estadoDia);
    cont.innerHTML = `
      <div class="no-activity-card">
        <strong>📌 Turno marcado como: ${etiquetaMotivo}</strong>
        <p>En este estado los estudiantes no asisten y <u>no se computan inasistencias (0.00)</u> en la planilla mensual.<br>
        Tocá <b>"Guardar Asistencia"</b> para dejar registrado el parte del día en el historial (y si querés, <b>"Enviar por WhatsApp"</b>).</p>
      </div>
    `;
  } else {
    let html = "";
    lista.forEach(est => {
      const estadoAlu = asistenciaActual[est.filaHoja] || "P";
      if (estadoAlu === "P") p++;
      else if (estadoAlu === "A") a++;
      else if (estadoAlu === "J") j++;
      else if (estadoAlu === "T") t++;

      const totalAnual = (est.inasistencias && est.inasistencias.total) ? est.inasistencias.total : 0;
      let claseBadgeFaltas = "badge-ok";
      let textoAlerta = `Acum: ${totalAnual}`;
      if (totalAnual >= 28) { claseBadgeFaltas = "badge-danger"; textoAlerta = `🚨 Acum: ${totalAnual} (Rige 75%)`; }
      else if (totalAnual >= 20) { claseBadgeFaltas = "badge-danger"; textoAlerta = `⚠️ Acum: ${totalAnual} (Citar 20)`; }
      else if (totalAnual >= 10) { claseBadgeFaltas = "badge-warn"; textoAlerta = `🔔 Acum: ${totalAnual} (Citar 10)`; }

      html += `
        <div class="asist-student-row status-${estadoAlu}">
          <div class="stu-info">
            <div class="stu-name">${est.orden}. ${est.nombre}</div>
            <div class="stu-meta">
              <span class="badge badge-grp">${est.grupo || "Sin grupo"}</span>
              <span class="badge ${claseBadgeFaltas}">${textoAlerta}</span>
            </div>
            <div class="stu-actions-inline">
              ${totalAnual >= 10 ? `<button type="button" class="btn-outline btn-stu-mini" onclick="prepararActaDesdeAlumno(${est.filaHoja}, 'INASISTENCIAS')">📄 Acta</button>` : ""}
              <button type="button" class="btn-outline btn-stu-mini" title="Editar N° de Orden, Nombre o Grupo" onclick="editarDatosEstudiante(${est.filaHoja})">✏️ Editar</button>
              <button type="button" class="btn-outline btn-stu-mini" title="Tachar en lista" onclick="alternarEstadoTachado(${est.filaHoja})">🚫</button>
            </div>
          </div>
          <div class="pat-btn-group">
            <button type="button" class="pat-btn ${estadoAlu === 'P' ? 'active-P' : ''}" title="Presente (0)" onclick="cambiarEstadoAsistencia(${est.filaHoja}, 'P')">P<small>0</small></button>
            <button type="button" class="pat-btn ${estadoAlu === 'A' ? 'active-A' : ''}" title="Ausente (+${valAus})" onclick="cambiarEstadoAsistencia(${est.filaHoja}, 'A')">A<small>+${valAus}</small></button>
            <button type="button" class="pat-btn ${estadoAlu === 'J' ? 'active-J' : ''}" title="Ausente Justificado (No computa falta)" onclick="cambiarEstadoAsistencia(${est.filaHoja}, 'J')">J<small>0</small></button>
            <button type="button" class="pat-btn ${estadoAlu === 'T' ? 'active-T' : ''}" title="Tarde (+0.25)" onclick="cambiarEstadoAsistencia(${est.filaHoja}, 'T')">T<small>+0.25</small></button>
          </div>
        </div>
      `;
    });

    cont.innerHTML = html || `<p style="padding:12px; color:#64748b;">No hay estudiantes activos.</p>`;
  }

  if (listaTachados.length > 0) {
    let htmlTach = `<div class="tachados-box"><div class="tachados-title"><span>🚫 Tachados (${listaTachados.length})</span></div>`;
    listaTachados.forEach(est => {
      htmlTach += `
        <div class="tachado-item">
          <div><span class="stu-name tachado-text">${est.orden}. ${est.nombre}</span></div>
          <div style="display:flex; gap:6px;">
            <button type="button" class="btn-outline" style="padding:4px 8px; font-size:11px;" onclick="editarDatosEstudiante(${est.filaHoja})">✏️ Editar</button>
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
  const elCountJ = document.getElementById("countJ");
  if (elCountJ) elCountJ.textContent = j;
  document.getElementById("countT").textContent = t;

  actualizarVistaPreviaWA();
}

function cambiarEstadoAsistencia(filaHoja, nuevoEstado) {
  asistenciaActual[filaHoja] = nuevoEstado;
  renderListaAsistencia();
}

function marcarTodosPresentes() {
  const selEstDia = document.getElementById("asistEstadoDia");
  if (selEstDia && selEstDia.value !== "NORMAL") selEstDia.value = "NORMAL";
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
  const estadoDia = obtenerEstadoDiaActual();
  const preceptor = document.getElementById("asistPreceptor")?.value.trim() || "Preceptoría";
  const obs = document.getElementById("asistObs")?.value.trim() || "";
  const cursoLimpio = (estado.cursoActual || "").replace(/_/g, " ");

  if (estadoDia !== "NORMAL") {
    const motivoTexto = obtenerEtiquetaMotivoDia(estadoDia);
    const lineasSinAct = [
      `📋 *PARTE DIARIO DE ASISTENCIA - EEST N°2*`,
      `🏫 *Curso:* ${cursoLimpio} | *Turno:* ${turnoRaw}`,
      `📅 *Fecha:* ${fechaStr}`,
      ``,
      `📌 *ESTADO DEL TURNO:* *${motivoTexto.toUpperCase()}*`,
      `ℹ️ _Sin dictado de clases en este turno. No se computan inasistencias (0.00)._`
    ];
    if (obs) lineasSinAct.push(``, `📝 *Observaciones:* ${obs}`);
    lineasSinAct.push(``, `✍️ *Preceptor/a:* ${preceptor}`);
    return lineasSinAct.join("\n");
  }

  const ausentes = [], justificados = [], tardes = [];
  let presentesCount = 0;

  lista.forEach(est => {
    const st = asistenciaActual[est.filaHoja] || "P";
    if (st === "P") presentesCount++;
    else if (st === "A") ausentes.push(`• ${formatearEstudianteParaWhatsApp(est)}`);
    else if (st === "J") justificados.push(`• ${formatearEstudianteParaWhatsApp(est)}`);
    else if (st === "T") tardes.push(`• ${formatearEstudianteParaWhatsApp(est)}`);
  });

  const totalNoAsistieron = ausentes.length + justificados.length;

  let lineas = [
    `📋 *PARTE DIARIO DE ASISTENCIA - EEST N°2*`,
    `🏫 *Curso:* ${cursoLimpio} | *Turno:* ${turnoRaw}`,
    `📅 *Fecha:* ${fechaStr} (Aus: ${valAus} | Justif: 0 | Tarde: 0.25)`,
    ``,
    `👥 *En lista:* ${lista.length} | ✅ *Presentes:* ${presentesCount} | ❌ *Ausentes:* ${totalNoAsistieron}${justificados.length > 0 ? ` (${justificados.length} Justif.)` : ""} | ⏰ *Tardes:* ${tardes.length}`
  ];

  if (ausentes.length > 0) {
    lineas.push(``, `❌ *Ausentes (+${valAus}):*`, ...ausentes);
  }
  if (justificados.length > 0) {
    lineas.push(``, `📄 *Ausentes Justificados (0 - No computa):*`, ...justificados);
  }
  if (ausentes.length === 0 && justificados.length === 0) {
    lineas.push(``, `✅ *Sin ausentes en este turno.*`);
  }

  if (tardes.length > 0) lineas.push(``, `⏰ *Llegadas Tarde (+0.25):*`, ...tardes);
  if (materiasSinProfesorActual.length > 0) {
    lineas.push(``, `👩‍🏫 *Sin Profesor en:* ${materiasSinProfesorActual.join(", ")}`);
  }
  if (obs) lineas.push(``, `📌 *Observaciones:* ${obs}`);
  lineas.push(``, `✍️ *Preceptor/a:* ${preceptor}`);
  return lineas.join("\n");
}

function actualizarVistaPreviaWA() {
  const box = document.getElementById("waPreviewBox");
  if (box) box.textContent = construirMensajeWhatsApp();
}

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

function obtenerColoresCeldaCanvas(valor) {
  const v = String(valor === undefined || valor === null ? "" : valor).trim().toUpperCase();
  if (!v || v === "-") return { bg: "#ffffff", fg: "#64748b", bold: false };
  if (v === "TEA") return { bg: "#dbeafe", fg: "#1d4ed8", bold: true };
  if (v === "TEP") return { bg: "#dcfce7", fg: "#15803d", bold: true };
  if (v === "TED" || v === "AUS") return { bg: "#fee2e2", fg: "#dc2626", bold: true };
  if (v === "CI") return { bg: "#fef3c7", fg: "#b45309", bold: true };
  const num = parseFloat(v.replace(",", "."));
  if (!isNaN(num)) {
    if (num >= 1 && num <= 3) return { bg: "#fee2e2", fg: "#dc2626", bold: true };
    if (num >= 4 && num < 7) return { bg: "#dcfce7", fg: "#15803d", bold: true };
    if (num >= 7 && num <= 10) return { bg: "#dbeafe", fg: "#1d4ed8", bold: true };
  }
  return { bg: "#ffffff", fg: "#0f172a", bold: true };
}

function envolverTextoCanvas(ctx, texto, maxWidth) {
  const palabras = String(texto || "").split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return [""];
  const lineas = [];
  let actual = palabras[0];
  for (let i = 1; i < palabras.length; i++) {
    const prueba = actual + " " + palabras[i];
    if (ctx.measureText(prueba).width <= maxWidth) {
      actual = prueba;
    } else {
      lineas.push(actual);
      actual = palabras[i];
    }
  }
  lineas.push(actual);
  return lineas;
}

function truncarTextoCanvas(ctx, texto, maxWidth) {
  const str = String(texto || "");
  if (ctx.measureText(str).width <= maxWidth) return str;
  let s = str;
  while (s.length > 3 && ctx.measureText(s + "…").width > maxWidth) {
    s = s.slice(0, -1);
  }
  return s + "…";
}

function canvasABlobPNG(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("No se pudo generar la imagen PNG"));
    }, "image/png");
  });
}

async function compartirODescargarImagenPNG(blob, nombreArchivo, titulo, textoAcomp) {
  const file = new File([blob], nombreArchivo, { type: "image/png" });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: titulo,
        text: textoAcomp || ""
      });
      return true;
    } catch (err) {
      if (err && err.name === "AbortError") return false;
    }
  }

  let copiadoPortapapeles = false;
  if (navigator.clipboard && window.ClipboardItem) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      copiadoPortapapeles = true;
    } catch (e) {}
  }

  const urlObj = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = urlObj;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(urlObj), 4000);

  mostrarToast(
    copiadoPortapapeles
      ? "🖼️ Imagen descargada y copiada (pegala con Ctrl+V en WhatsApp)"
      : "🖼️ Imagen descargada. Adjuntala en WhatsApp.",
    4200
  );
  return true;
}

async function generarImagenParteDiarioBlob() {
  const lista = obtenerEstudiantesFiltradosAsistencia();
  const fechaStr = formatearFechaInput();
  const turnoRaw = (document.getElementById("asistTurnoGrupo")?.value || "").split("|")[0].trim();
  const valAus = obtenerValorAusenciaActual();
  const estadoDia = obtenerEstadoDiaActual();
  const preceptor = document.getElementById("asistPreceptor")?.value.trim() || "Preceptoría";
  const obs = document.getElementById("asistObs")?.value.trim() || "";
  const cursoLimpio = (estado.cursoActual || "").replace(/_/g, " ");

  const ausentes = [], justificados = [], tardes = [];
  let presentesCount = 0;

  if (estadoDia === "NORMAL") {
    lista.forEach(est => {
      const st = asistenciaActual[est.filaHoja] || "P";
      if (st === "P") presentesCount++;
      else if (st === "A") ausentes.push(formatearEstudianteParaWhatsApp(est));
      else if (st === "J") justificados.push(formatearEstudianteParaWhatsApp(est));
      else if (st === "T") tardes.push(formatearEstudianteParaWhatsApp(est));
    });
  }

  const W = 820;
  const PAD = 20;
  const CW = W - PAD * 2;
  const SCALE = 2;

  const tmp = document.createElement("canvas");
  const mctx = tmp.getContext("2d");

  const calcularFilasChips = (items) => {
    if (!items || items.length === 0) return 0;
    const cols = 3;
    return Math.ceil(items.length / cols);
  };

  let H = PAD;
  H += 56; // header
  H += 10;

  if (estadoDia !== "NORMAL") {
    H += 68;
  } else {
    H += 56; // KPI bar
    H += 12;
    if (ausentes.length > 0) H += 24 + calcularFilasChips(ausentes) * 30 + 10;
    if (justificados.length > 0) H += 24 + calcularFilasChips(justificados) * 30 + 10;
    if (ausentes.length === 0 && justificados.length === 0) H += 34;
    if (tardes.length > 0) H += 24 + calcularFilasChips(tardes) * 30 + 10;
    if (materiasSinProfesorActual.length > 0) {
      mctx.font = "bold 12.5px Arial, sans-serif";
      const lSin = envolverTextoCanvas(mctx, "Sin Profesor en: " + materiasSinProfesorActual.join(", "), CW - 20);
      H += lSin.length * 18 + 16;
    }
  }

  let lineasObs = [];
  if (obs) {
    mctx.font = "12.5px Arial, sans-serif";
    lineasObs = envolverTextoCanvas(mctx, "Observaciones: " + obs, CW - 20);
    H += lineasObs.length * 18 + 16;
  }

  H += 36; // footer
  H += PAD;

  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Borde exterior limpio
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(PAD - 8, PAD - 8, CW + 16, H - (PAD - 8) * 2);

  let y = PAD;

  // Encabezado institucional
  ctx.fillStyle = "#1e3a8a";
  ctx.fillRect(PAD, y, CW, 52);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 14.5px Arial, sans-serif";
  ctx.fillText('E.E.S.T. N° 2 "PBRO. MANUEL DE SAN GINÉS" — SAN FERNANDO', PAD + 12, y + 21);
  ctx.font = "bold 11.5px Arial, sans-serif";
  ctx.fillStyle = "#bfdbfe";
  ctx.fillText(`PARTE DIARIO DE ASISTENCIA  |  ${cursoLimpio} — ${turnoRaw}`, PAD + 12, y + 40);

  ctx.textAlign = "right";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 13px Arial, sans-serif";
  ctx.fillText(`Fecha: ${fechaStr}`, PAD + CW - 12, y + 21);
  ctx.font = "11px Arial, sans-serif";
  ctx.fillStyle = "#dbeafe";
  ctx.fillText(estadoDia === "NORMAL" ? `Aus: ${valAus} | Justif: 0 | Tarde: 0.25` : "Sin cómputo de faltas", PAD + CW - 12, y + 40);
  ctx.textAlign = "left";
  y += 62;

  if (estadoDia !== "NORMAL") {
    const motivoTexto = obtenerEtiquetaMotivoDia(estadoDia).toUpperCase();
    ctx.fillStyle = "#fffbeb";
    ctx.fillRect(PAD, y, CW, 58);
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(PAD, y, CW, 58);
    ctx.fillStyle = "#b45309";
    ctx.font = "bold 15px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`ESTADO DEL TURNO: ${motivoTexto}`, W / 2, y + 25);
    ctx.font = "12px Arial, sans-serif";
    ctx.fillStyle = "#78350f";
    ctx.fillText("Sin dictado de clases en este turno. No se computan inasistencias (0.00).", W / 2, y + 45);
    ctx.textAlign = "left";
    y += 68;
  } else {
    // Barra KPI de 5 columnas
    const kpis = [
      { lbl: "EN LISTA", val: lista.length, bg: "#e2e8f0", fg: "#1e293b" },
      { lbl: "PRESENTES (P)", val: presentesCount, bg: "#dcfce7", fg: "#15803d" },
      { lbl: "AUSENTES (A)", val: ausentes.length, bg: "#fee2e2", fg: "#b91c1c" },
      { lbl: "JUSTIF. (J)", val: justificados.length, bg: "#ede9fe", fg: "#6d28d9" },
      { lbl: "TARDES (T)", val: tardes.length, bg: "#fef3c7", fg: "#b45309" }
    ];
    const gap = 8;
    const kw = (CW - gap * 4) / 5;
    kpis.forEach((k, idx) => {
      const kx = PAD + idx * (kw + gap);
      ctx.fillStyle = k.bg;
      ctx.fillRect(kx, y, kw, 50);
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1;
      ctx.strokeRect(kx, y, kw, 50);
      ctx.fillStyle = k.fg;
      ctx.textAlign = "center";
      ctx.font = "bold 20px Arial, sans-serif";
      ctx.fillText(String(k.val), kx + kw / 2, y + 27);
      ctx.font = "bold 9.5px Arial, sans-serif";
      ctx.fillText(k.lbl, kx + kw / 2, y + 43);
    });
    ctx.textAlign = "left";
    y += 62;

    const dibujarSeccionChips = (titulo, items, bg, border, fg) => {
      if (!items || items.length === 0) return;
      ctx.fillStyle = fg;
      ctx.font = "bold 12px Arial, sans-serif";
      ctx.fillText(titulo, PAD, y + 14);
      y += 22;

      const cols = 3;
      const cgap = 8;
      const chipW = (CW - cgap * (cols - 1)) / cols;
      items.forEach((txt, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = PAD + col * (chipW + cgap);
        const cy = y + row * 30;
        ctx.fillStyle = bg;
        ctx.fillRect(cx, cy, chipW, 24);
        ctx.strokeStyle = border;
        ctx.lineWidth = 1;
        ctx.strokeRect(cx, cy, chipW, 24);
        ctx.fillStyle = fg;
        ctx.font = "bold 11.5px Arial, sans-serif";
        ctx.fillText(truncarTextoCanvas(ctx, txt, chipW - 14), cx + 8, cy + 16);
      });
      y += Math.ceil(items.length / cols) * 30 + 10;
    };

    if (ausentes.length > 0) {
      dibujarSeccionChips(`AUSENTES (+${valAus}) — Identificados por N° de Orden:`, ausentes, "#fff1f2", "#fca5a5", "#991b1b");
    }
    if (justificados.length > 0) {
      dibujarSeccionChips("AUSENTES JUSTIFICADOS (0 — No computa):", justificados, "#f5f3ff", "#c4b5fd", "#6d28d9");
    }
    if (ausentes.length === 0 && justificados.length === 0) {
      ctx.fillStyle = "#f0fdf4";
      ctx.fillRect(PAD, y, CW, 26);
      ctx.strokeStyle = "#86efac";
      ctx.strokeRect(PAD, y, CW, 26);
      ctx.fillStyle = "#15803d";
      ctx.font = "bold 12px Arial, sans-serif";
      ctx.fillText("Sin ausentes registrados en este turno.", PAD + 10, y + 17);
      y += 34;
    }
    if (tardes.length > 0) {
      dibujarSeccionChips("LLEGADAS TARDE (+0.25):", tardes, "#fffbeb", "#fcd34d", "#b45309");
    }
    if (materiasSinProfesorActual.length > 0) {
      ctx.font = "bold 12px Arial, sans-serif";
      const lSin = envolverTextoCanvas(ctx, "Sin Profesor en: " + materiasSinProfesorActual.join(", "), CW - 20);
      const bh = lSin.length * 18 + 10;
      ctx.fillStyle = "#fef2f2";
      ctx.fillRect(PAD, y, CW, bh);
      ctx.strokeStyle = "#fca5a5";
      ctx.strokeRect(PAD, y, CW, bh);
      ctx.fillStyle = "#b91c1c";
      lSin.forEach((ln, idx) => ctx.fillText(ln, PAD + 10, y + 17 + idx * 18));
      y += bh + 8;
    }
  }

  if (lineasObs.length > 0) {
    const bh = lineasObs.length * 18 + 10;
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(PAD, y, CW, bh);
    ctx.strokeStyle = "#cbd5e1";
    ctx.strokeRect(PAD, y, CW, bh);
    ctx.fillStyle = "#1e293b";
    ctx.font = "12px Arial, sans-serif";
    lineasObs.forEach((ln, idx) => ctx.fillText(ln, PAD + 10, y + 17 + idx * 18));
    y += bh + 8;
  }

  // Pie de parte
  ctx.strokeStyle = "#cbd5e1";
  ctx.beginPath();
  ctx.moveTo(PAD, y + 4);
  ctx.lineTo(PAD + CW, y + 4);
  ctx.stroke();

  ctx.fillStyle = "#334155";
  ctx.font = "bold 11.5px Arial, sans-serif";
  ctx.fillText(`Preceptor/a: ${preceptor}`, PAD, y + 22);
  ctx.textAlign = "right";
  ctx.font = "10.5px Arial, sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText("E.E.S.T. N° 2 San Fernando — Parte Diario Digital", PAD + CW, y + 22);
  ctx.textAlign = "left";

  return canvasABlobPNG(canvas);
}

async function enviarParteImagenWhatsApp() {
  try {
    mostrarToast("⏳ Generando imagen del parte...", 3000);
    const blob = await generarImagenParteDiarioBlob();
    const fechaSlug = (formatearFechaInput() || "parte").replace(/\//g, "-");
    const cursoSlug = (estado.cursoActual || "curso").replace(/\s+/g, "_");
    const nombreArchivo = `Parte_${cursoSlug}_${fechaSlug}.png`;
    const titulo = `Parte Diario ${cursoSlug.replace(/_/g, " ")} (${formatearFechaInput()})`;
    await compartirODescargarImagenPNG(blob, nombreArchivo, titulo, titulo);
  } catch (err) {
    mostrarToast("⚠️ Error al generar imagen: " + err.message, 4000);
  }
}

async function generarImagenInformeAlumnoBlob(est) {
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
  const materiasFiltradas = obtenerMateriasOrdenadasVisualmente().filter(m => materiaCumpleFiltroInforme(m));
  const pendActivas = obtenerPendientesDeEstudiante(est).filter(p => p.estado !== "ACREDITADA");
  const notaOpc = (configInformeAlumno.notaAdicional || "").trim();

  const W = 940;
  const PAD = 18;
  const CW = W - PAD * 2;
  const SCALE = 2;

  const tmp = document.createElement("canvas");
  const mctx = tmp.getContext("2d");
  mctx.font = "11.5px Arial, sans-serif";

  const infoLines = [];
  infoLines.push(...envolverTextoCanvas(mctx, `Inasistencias por mes: ${resumenMeses}`, CW - 16));
  if (configInformeAlumno.ambito === "TODO" || configInformeAlumno.ambito === "TEORIA") {
    infoLines.push(...envolverTextoCanvas(mctx, `Días Aus./Tarde (Teoría): ${fechasTeoFinal.length > 0 ? fechasTeoFinal.join(", ") : "Ninguno"}`, CW - 16));
  }
  if (configInformeAlumno.ambito === "TODO" || configInformeAlumno.ambito === "TALLER") {
    infoLines.push(...envolverTextoCanvas(mctx, `Días Aus./Tarde (Taller): ${fechasTalFinal.length > 0 ? fechasTalFinal.join(", ") : "Ninguno"}`, CW - 16));
  }
  if (pendActivas.length > 0) {
    const txtP = pendActivas.map(p => `${p.materia} (${p.anioOrigen || "Ant."})`).join(" | ");
    infoLines.push(...envolverTextoCanvas(mctx, `Pendientes Años Ant. (${pendActivas.length}/${TOPE_MATERIAS_PENDIENTES}): ${txtP}`, CW - 16));
  }

  let notaLines = [];
  if (notaOpc) {
    notaLines = envolverTextoCanvas(mctx, `Nota: ${notaOpc}`, CW - 16);
  }

  const infoBoxH = infoLines.length * 16 + 12;
  const ROW_H = 24;
  const HDR_H = 24;
  const tableH = HDR_H + Math.max(1, materiasFiltradas.length) * ROW_H;
  const notaBoxH = notaLines.length > 0 ? (notaLines.length * 16 + 12 + 8) : 0;

  const H = PAD + 44 + 8 + 30 + 8 + infoBoxH + 8 + tableH + 8 + notaBoxH + 28 + PAD;

  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Marco exterior ajustado al contenido
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 1.6;
  ctx.strokeRect(PAD - 8, PAD - 8, CW + 16, H - (PAD - 8) * 2);

  let y = PAD;

  // Encabezado
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 14.5px Arial, sans-serif";
  ctx.fillText('E.E.S.T. N° 2 "PBRO. MANUEL DE SAN GINÉS" — SAN FERNANDO', PAD, y + 16);
  ctx.fillStyle = "#334155";
  ctx.font = "bold 11px Arial, sans-serif";
  ctx.fillText(`COMUNICADO ACADÉMICO Y DE ASISTENCIA (${etiquetaAmbito})`, PAD, y + 33);

  ctx.textAlign = "right";
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 11.5px Arial, sans-serif";
  ctx.fillText(`Fecha: ${fechaHoy}`, PAD + CW, y + 16);
  ctx.fillText(`Curso: ${cursoLimpio}`, PAD + CW, y + 33);
  ctx.textAlign = "left";

  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(PAD, y + 41);
  ctx.lineTo(PAD + CW, y + 41);
  ctx.stroke();
  y += 50;

  // Franja del estudiante
  ctx.fillStyle = "#f0f4f8";
  ctx.fillRect(PAD, y, CW, 28);
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 1;
  ctx.strokeRect(PAD, y, CW, 28);

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 12px Arial, sans-serif";
  ctx.fillText(`ESTUDIANTE: ${est.orden}. ${est.nombre}`, PAD + 8, y + 18);
  ctx.font = "bold 11.5px Arial, sans-serif";
  ctx.fillText(`DNI: ${est.dni || "-"}`, PAD + 440, y + 18);
  ctx.fillText(`GRUPO: ${est.grupo || "-"}`, PAD + 590, y + 18);
  ctx.textAlign = "right";
  ctx.fillStyle = totFaltas >= 20 ? "#b91c1c" : "#0f172a";
  ctx.fillText(`TOTAL INASISTENCIAS: ${totFaltas}`, PAD + CW - 8, y + 18);
  ctx.textAlign = "left";
  y += 36;

  // Caja de inasistencias y fechas
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(PAD, y, CW, infoBoxH);
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 1;
  ctx.strokeRect(PAD, y, CW, infoBoxH);

  ctx.fillStyle = "#111827";
  ctx.font = "11.5px Arial, sans-serif";
  infoLines.forEach((ln, idx) => {
    ctx.fillText(ln, PAD + 8, y + 16 + idx * 16);
  });
  y += infoBoxH + 8;

  // Tabla de calificaciones
  const cols = [
    { label: "MATERIA", w: 280, align: "left", key: "_mat" },
    { label: "ÁREA", w: 72, align: "center", key: "_area" },
    { label: "1° Val.", w: 69, align: "center", key: "val1" },
    { label: "1°C", w: 69, align: "center", key: "cal1" },
    { label: "2° Val.", w: 69, align: "center", key: "val2" },
    { label: "2°C", w: 69, align: "center", key: "cal2" },
    { label: "Int. 1°C", w: 69, align: "center", key: "int1" },
    { label: "Dic.", w: 69, align: "center", key: "intDic" },
    { label: "Feb.", w: 69, align: "center", key: "intFeb" },
    { label: "Final", w: 69, align: "center", key: "final" }
  ];

  // Encabezado tabla
  let cx = PAD;
  cols.forEach(c => {
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(cx, y, c.w, HDR_H);
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 1;
    ctx.strokeRect(cx, y, c.w, HDR_H);
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 11px Arial, sans-serif";
    if (c.align === "left") {
      ctx.fillText(c.label, cx + 6, y + 16);
    } else {
      ctx.textAlign = "center";
      ctx.fillText(c.label, cx + c.w / 2, y + 16);
      ctx.textAlign = "left";
    }
    cx += c.w;
  });
  y += HDR_H;

  // Filas de materias
  materiasFiltradas.forEach(mat => {
    const esTal = esMateriaDeTaller(mat);
    const notasMat = (est.notas && est.notas[mat.indice]) || {};
    cx = PAD;

    cols.forEach(c => {
      let texto = "-";
      let estilo = { bg: "#ffffff", fg: "#0f172a", bold: false };

      if (c.key === "_mat") {
        texto = limpiarNombreMateria(mat.nombre);
        estilo = { bg: "#ffffff", fg: "#0f172a", bold: true };
      } else if (c.key === "_area") {
        texto = esTal ? "Taller" : "Teoría";
        estilo = { bg: esTal ? "#eff6ff" : "#ffffff", fg: esTal ? "#0d47a1" : "#1e293b", bold: true };
      } else {
        const val = String(notasMat[c.key] || "").trim();
        texto = val || "-";
        estilo = obtenerColoresCeldaCanvas(val);
      }

      ctx.fillStyle = estilo.bg;
      ctx.fillRect(cx, y, c.w, ROW_H);
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = 0.8;
      ctx.strokeRect(cx, y, c.w, ROW_H);

      ctx.fillStyle = estilo.fg;
      ctx.font = `${estilo.bold ? "bold " : ""}11px Arial, sans-serif`;
      if (c.align === "left") {
        ctx.fillText(truncarTextoCanvas(ctx, texto, c.w - 10), cx + 6, y + 16);
      } else {
        ctx.textAlign = "center";
        ctx.fillText(texto, cx + c.w / 2, y + 16);
        ctx.textAlign = "left";
      }
      cx += c.w;
    });
    y += ROW_H;
  });

  y += 8;

  if (notaLines.length > 0) {
    const bh = notaLines.length * 16 + 12;
    ctx.fillStyle = "#fffbeb";
    ctx.fillRect(PAD, y, CW, bh);
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 1;
    ctx.strokeRect(PAD, y, CW, bh);
    ctx.fillStyle = "#78350f";
    ctx.font = "bold 11.5px Arial, sans-serif";
    notaLines.forEach((ln, idx) => ctx.fillText(ln, PAD + 8, y + 16 + idx * 16));
    y += bh + 8;
  }

  // Pie de informe
  ctx.fillStyle = "#334155";
  ctx.font = "bold 11px Arial, sans-serif";
  ctx.fillText(`Preceptor/a: ${preceptor}`, PAD, y + 16);
  ctx.textAlign = "right";
  ctx.font = "italic 11px Arial, sans-serif";
  ctx.fillStyle = "#475569";
  ctx.fillText("Se solicita confirmar recepción del informe. Muchas gracias.", PAD + CW, y + 16);
  ctx.textAlign = "left";

  return canvasABlobPNG(canvas);
}

async function enviarInformeAlumnoImagenWhatsApp() {
  const filaSel = parseInt(document.getElementById("alumnoSelect")?.value || "0", 10);
  const est = (estado.estudiantes || []).find(e => e.filaHoja === filaSel) || (estado.estudiantes || [])[0];
  if (!est) return;
  try {
    mostrarToast("⏳ Generando imagen del informe...", 3000);
    const blob = await generarImagenInformeAlumnoBlob(est);
    const nomSlug = String(est.nombre || "estudiante").replace(/[^A-Za-z0-9]+/g, "_").slice(0, 28);
    const nombreArchivo = `Informe_${est.orden}_${nomSlug}.png`;
    const titulo = `Informe Académico — ${est.nombre}`;
    await compartirODescargarImagenPNG(blob, nombreArchivo, titulo, `E.E.S.T. N° 2 — Informe de ${est.nombre}`);
  } catch (err) {
    mostrarToast("⚠️ Error al generar imagen: " + err.message, 4000);
  }
}

async function guardarAsistenciaEnSheets(abrirWspDespues = false) {
  const btn = document.getElementById("btnSoloGuardarAsistencia");
  if ((document.getElementById("asistTurnoGrupo")?.value || "") === "SIN_CLASES|NONE") {
    return mostrarToast("No hay clases programadas para este día");
  }
  const lista = obtenerEstudiantesFiltradosAsistencia();
  if (lista.length === 0) return mostrarToast("No hay alumnos activos");

  const estadoDia = obtenerEstadoDiaActual();
  const motivoDiaTexto = obtenerEtiquetaMotivoDia(estadoDia);
  const mensajeCongelado = construirMensajeWhatsApp();
  const seleccionCongelada = { ...asistenciaActual };
  const sinProfCongelado = [...materiasSinProfesorActual];

  const payload = {
    accion: "registrarAsistencia",
    curso: estado.cursoActual,
    fechaFormateada: formatearFechaInput(),
    mes: document.getElementById("asistMes").value,
    turnoGrupo: document.getElementById("asistTurnoGrupo").value.split("|")[0],
    modalidadDia: document.getElementById("asistModalidad").value,
    estadoDia: estadoDia,
    motivoDiaTexto: motivoDiaTexto,
    materiasSinProfesor: sinProfCongelado,
    preceptor: document.getElementById("asistPreceptor").value.trim(),
    observaciones: document.getElementById("asistObs").value.trim(),
    registros: lista.map(est => ({
      filaHoja: est.filaHoja,
      orden: est.orden,
      nombre: est.nombre,
      grupo: est.grupo,
      estadoAsistencia: (estadoDia === "NORMAL") ? (seleccionCongelada[est.filaHoja] || "P") : "P"
    }))
  };

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = "⏳ Guardando en Sheets...";
    }
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);

    asistenciaActual = seleccionCongelada;
    materiasSinProfesorActual = sinProfCongelado;
    aplicarDatosRecibidos(json.data, true);
    mostrarToast("✅ Asistencia guardada en Google Sheets");
    if (abrirWspDespues) {
      abrirWhatsAppBusinessDirecto(mensajeCongelado);
    }
  } catch (err) {
    mostrarToast("⚠️ Error: " + err.message, 4000);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "💾 Guardar Asistencia";
    }
  }
}

async function guardarYEnviarWhatsAppBusiness() {
  return guardarAsistenciaEnSheets(true);
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
  html += `<th>Total</th><th>Acción</th></tr></thead><tbody>`;

  (estado.estudiantes || []).forEach(est => {
    if (esEstudianteTachado(est)) return;
    const tot = (est.inasistencias && est.inasistencias.total) || 0;
    const clTot = tot >= 20 ? "cal-rojo" : (tot >= 10 ? "val-TEP" : "");
    html += `<tr><td>${est.orden}</td><td class="td-left">${est.nombre}</td><td>${est.grupo}</td>`;
    MESES_LISTA.forEach(m => {
      const val = (est.inasistencias && est.inasistencias.meses && est.inasistencias.meses[m]) || 0;
      html += `<td>${val > 0 ? val : "-"}</td>`;
    });
    html += `<td class="${clTot}"><strong>${tot}</strong></td>`;
    html += `<td><button type="button" class="btn-outline" style="padding:2px 6px; font-size:10.5px;" onclick="prepararActaDesdeAlumno(${est.filaHoja}, 'INASISTENCIAS')">📄 Acta</button></td></tr>`;
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

  let html = `<div class="hist-cards-list">`;
  let visibles = 0;

  hist.forEach((item, idx) => {
    if (valorActual !== "ALL" && item.turnoGrupo !== valorActual) return;
    visibles++;

    const esSinActividad = (item.estadoDia && item.estadoDia !== "NORMAL") || String(item.nominaAusentes || "").indexOf("[SIN ACTIVIDAD") === 0;
    const fechaTxt = normalizarFechaDDMMYYYY(item.fecha);
    const sinProfArr = Array.isArray(item.materiasSinProfesor) ? item.materiasSinProfesor : [];
    const htmlSinProf = sinProfArr.length > 0
      ? `<div class="hist-sin-prof">🚫 Sin Prof: ${sinProfArr.join(", ")}</div>`
      : "";

    let detalleHTML = "";
    if (esSinActividad) {
      const txtMot = String(item.nominaAusentes || "").replace(/^\[SIN ACTIVIDAD:\s*/i, "").replace(/\]$/, "").trim();
      detalleHTML = `<div class="hist-sin-act">📌 ${txtMot || obtenerEtiquetaMotivoDia(item.estadoDia)}</div>`;
    } else {
      const rawAus = String(item.nominaAusentes || "").trim();
      const sinAusentes = !rawAus || rawAus.toLowerCase().indexOf("sin ausentes") === 0;
      if (sinAusentes) {
        detalleHTML = `<div class="hist-ok-line">✅ Sin ausentes</div>`;
      } else {
        const listaAus = rawAus.split("|").map(s => s.trim()).filter(Boolean);
        const chipsAus = listaAus.map(nom => {
          const esJ = nom.indexOf("[J]") !== -1;
          return `<span class="hist-aus-chip ${esJ ? 'chip-just' : ''}">${nom}</span>`;
        }).join("");

        if (listaAus.length <= 2) {
          detalleHTML = `<div class="hist-chips-wrap">${chipsAus}</div>`;
        } else {
          detalleHTML = `
            <details class="hist-details">
              <summary>Ver nómina de ausentes (${listaAus.length})</summary>
              <div class="hist-chips-wrap" style="margin-top:6px;">${chipsAus}</div>
            </details>
          `;
        }
      }
    }

    html += `
      <div class="hist-card ${esSinActividad ? 'hist-card-sin-act' : ''}">
        <div class="hist-card-top">
          <div class="hist-card-meta">
            <strong class="hist-date">${fechaTxt}</strong>
            <span class="badge badge-grp">${item.turnoGrupo}</span>
          </div>
          <div class="hist-card-right">
            <div class="hist-pills">
              <span class="hist-pill pill-p" title="Presentes">P:${item.presentes}</span>
              <span class="hist-pill pill-a" title="Ausentes / Justif.">A:${item.ausentes}</span>
              <span class="hist-pill pill-t" title="Tardes">T:${item.tardes}</span>
            </div>
            <button type="button" class="btn-outline hist-load-btn" onclick="cargarParteDesdeFilaHistorial(${idx})">✏️ Cargar</button>
          </div>
        </div>
        <div class="hist-card-body">
          ${detalleHTML}
          ${htmlSinProf}
        </div>
      </div>
    `;
  });

  html += `</div>`;
  cont.innerHTML = visibles > 0 ? html : `<p style="padding:10px; color:#64748b;">Sin partes para el filtro seleccionado.</p>`;
}

function limpiarNombreMateria(nombreRaw) {
  return String(nombreRaw || "").replace(/^Materia\s*\d+\s*:\s*/i, "").trim();
}

function construirBannerMigracionDicFebHTML() {
  const tiene6Cols = (estado.materias || []).some(m => (m.anchoCols || 6) < 8);
  if (!tiene6Cols) return "";
  if (typeof esRolFamiliaActual === "function" && esRolFamiliaActual()) return "";
  return `
    <div style="background:#eff6ff; border:1px solid #93c5fd; border-radius:8px; padding:10px 12px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <div style="font-size:12px; color:#1e3a8a; font-weight:700;">
        📌 Este curso todavía usa 6 columnas por materia. Actualizalo para habilitar las columnas de <b>Intensificación Diciembre y Febrero</b> en Google Sheets sin perder ninguna nota.
      </div>
      <button type="button" class="btn-main btn-print-blue" style="padding:7px 12px; font-size:12px;" onclick="migrarCursoAColumnasDicFeb()">
        🔄 Habilitar Diciembre y Febrero en este Curso
      </button>
    </div>
  `;
}

async function migrarCursoAColumnasDicFeb() {
  const cursoLimpio = (estado.cursoActual || "").replace(/_/g, " ");
  if (!confirm(`¿Agregar automáticamente las columnas de "Intensificación Dic." e "Intensificación Feb." en todas las materias de ${cursoLimpio}?

Todas las notas e inasistencias ya cargadas se conservan intactas.`)) {
    return;
  }
  try {
    mostrarToast("⏳ Actualizando columnas de Diciembre y Febrero en Sheets...", 5000);
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "migrarColumnasDicFeb",
        curso: estado.cursoActual
      })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);

    aplicarDatosRecibidos(json.data, true);
    mostrarToast("✅ Columnas de Diciembre y Febrero habilitadas en " + cursoLimpio, 4000);
  } catch (err) {
    mostrarToast("⚠️ Error al migrar: " + err.message, 4500);
  }
}

function crearSelectorNotaHTML(filaHoja, colHoja, valorActual, tipo, claveCampo = "", esResumenTaller = false, objNotasMateria = null) {
  const v = String(valorActual || "").toUpperCase().trim().replace(",", ".");
  const clColor = obtenerClaseColorNota(v);
  const esCampoFinal = (claveCampo === "final");
  const esCampoInt1 = (claveCampo === "int1");
  const esCampoDic = (claveCampo === "intDic");
  const esCampoFeb = (claveCampo === "intFeb");
  const esFam = (typeof esRolFamiliaActual === "function" && esRolFamiliaActual());
  const sinColumnaMigrada = (Number(colHoja) === -1);

  let int1BloqueadoPorRegla = false;
  if (esCampoInt1 && objNotasMateria) {
    const valC1 = objNotasMateria.cal1;
    const notaNumC1 = parsearNotaNumerica(valC1);
    const valUpC1 = String(valC1 || "").toUpperCase().trim();
    if ((!isNaN(notaNumC1) && notaNumC1 >= 7) || valUpC1 === "TEA") {
      int1BloqueadoPorRegla = true;
    }
  }

  let dicBloqueadoPorRegla = false;
  if (esCampoDic) {
    dicBloqueadoPorRegla = !debeIntensificarMateria(objNotasMateria);
  }

  let febBloqueadoPorRegla = false;
  if (esCampoFeb) {
    febBloqueadoPorRegla = !debeIntensificarFebrero(objNotasMateria);
  }

  const estaBloqueado = esFam || esCampoFinal || esResumenTaller || sinColumnaMigrada || int1BloqueadoPorRegla || dicBloqueadoPorRegla || febBloqueadoPorRegla;

  let motivoBloqueo = "Se calcula automáticamente";
  if (esFam) motivoBloqueo = "Modo lectura para familias";
  else if (sinColumnaMigrada) motivoBloqueo = "Tocá 'Habilitar Diciembre y Febrero' arriba para activar esta columna en Sheets";
  else if (esCampoInt1 && int1BloqueadoPorRegla) motivoBloqueo = "Solo disponible si el 1° Cuatrimestre es 6 o menos";
  else if (esCampoDic && dicBloqueadoPorRegla) motivoBloqueo = "Solo se habilita si el estudiante debe intensificar (1°C o 2°C menor a 7)";
  else if (esCampoFeb && febBloqueadoPorRegla) motivoBloqueo = "Solo se habilita si debe intensificar y no aprobó en Diciembre (4 o más)";

  const attrDisabled = estaBloqueado
    ? `disabled style="cursor:not-allowed; opacity:${(dicBloqueadoPorRegla || febBloqueadoPorRegla || sinColumnaMigrada) ? '0.45' : '0.9'};" title="${motivoBloqueo}"`
    : "";

  if (tipo === "val") {
    return `<select class="${clColor}" ${attrDisabled} onchange="guardarCeldaRemota(${filaHoja}, ${colHoja}, this)">
      <option value="" ${v === "" ? "selected" : ""}>-</option>
      <option value="TEA" ${v === "TEA" ? "selected" : ""}>TEA</option>
      <option value="TEP" ${v === "TEP" ? "selected" : ""}>TEP</option>
      <option value="TED" ${v === "TED" ? "selected" : ""}>TED</option>
    </select>`;
  }

  let opts = `<option value="" ${v === "" ? "selected" : ""}>-</option>`;

  if (esCampoFinal) {
    if (v !== "") {
      opts += `<option value="${v}" selected>${v}</option>`;
    }
    return `<select class="${clColor}" ${attrDisabled}>${opts}</select>`;
  }

  if (esCampoInt1 && !esResumenTaller) {
    const escalaInt1 = ["10", "9", "8", "7"];
    escalaInt1.forEach(n => {
      opts += `<option value="${n}" ${v === n ? "selected" : ""}>${n}</option>`;
    });
    if (v !== "" && !escalaInt1.includes(v)) {
      opts += `<option value="${v}" selected>${v}</option>`;
    }
    return `<select class="${clColor}" ${attrDisabled} onchange="guardarCeldaRemota(${filaHoja}, ${colHoja}, this)">${opts}</select>`;
  }

  if ((esCampoDic || esCampoFeb) && !esResumenTaller) {
    for (let n = 10; n >= 1; n--) {
      opts += `<option value="${n}" ${v === String(n) ? "selected" : ""}>${n}</option>`;
    }
    opts += `<option value="CI" ${v === "CI" ? "selected" : ""}>CI</option>`;
    opts += `<option value="AUS" ${v === "AUS" ? "selected" : ""}>AUS</option>`;
    return `<select class="${clColor}" ${attrDisabled} onchange="guardarCeldaRemota(${filaHoja}, ${colHoja}, this)">${opts}</select>`;
  }

  for (let n = 10; n >= 1; n--) {
    opts += `<option value="${n}" ${v === String(n) ? "selected" : ""}>${n}</option>`;
  }
  opts += `<option value="AUS" ${v === "AUS" ? "selected" : ""}>AUS</option>`;
  return `<select class="${clColor}" ${attrDisabled} onchange="guardarCeldaRemota(${filaHoja}, ${colHoja}, this)">${opts}</select>`;
}

function renderVistaMateria() {
  const cont = document.getElementById("contenedorTarjetasMateria");
  if (!cont) return;
  const mostrarTachados = document.getElementById("chkMostrarTachadosMateria")?.checked;
  const idxMat = parseInt(document.getElementById("materiaSelect")?.value || "0", 10);
  const mat = (estado.materias || []).find(m => m.indice === idxMat);
  if (!mat) { cont.innerHTML = "<p>Sin materias.</p>"; return; }

  const esTal = esMateriaDeTaller(mat);
  let html = construirBannerMigracionDicFebHTML() + `
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
    const esResumenTaller = Boolean(mat.esResumenTallerCB);

    html += `<div class="grade-card ${tachado ? 'card-tachada' : ''} ${esResumenTaller ? 'resumen-taller-card' : ''}">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; flex-wrap:wrap;">
        <strong class="${tachado ? 'stu-name tachado-text' : ''}" style="font-size:13px;">
          ${est.orden}. ${est.nombre} ${esResumenTaller ? ' 🔧 (Promedio Ciclo Básico)' : ''}
        </strong>
        <div style="display:flex; gap:5px; align-items:center;">
          <span class="badge badge-grp">${est.grupo}</span>
          <button class="btn-outline" style="padding:3px 7px; font-size:10.5px;" title="Editar N° Orden / Nombre / Grupo" onclick="editarDatosEstudiante(${est.filaHoja})">✏️</button>
          ${tachado
            ? `<button class="btn-success-outline" style="padding:3px 7px; font-size:10.5px;" onclick="alternarEstadoTachado(${est.filaHoja})">✅</button>`
            : `<button class="btn-danger-outline" style="padding:3px 7px; font-size:10.5px;" onclick="alternarEstadoTachado(${est.filaHoja})">🚫</button>`
          }
        </div>
      </div>
      <div class="grade-inputs-grid">`;

    SUB_CAMPOS.forEach(sc => {
      const colHoja = obtenerColumnaHojaSubCampo(mat, sc);
      const etiquetaCampo = (sc.key === "final") ? `${sc.label} (Auto)` : sc.label;
      html += `<div class="mini-field">
        <label>${etiquetaCampo}</label>
        <div>${crearSelectorNotaHTML(est.filaHoja, colHoja, notasMat[sc.key], sc.tipo, sc.key, esResumenTaller, notasMat)}</div>
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

function materiaCumpleFiltroInforme(mat) {
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

  const materiasOrdenadas = obtenerMateriasOrdenadasVisualmente().filter(m => materiaCumpleFiltroInforme(m));
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

  const pendActivasWA = obtenerPendientesDeEstudiante(est).filter(p => p.estado !== "ACREDITADA");
  if (pendActivasWA.length > 0) {
    lineas.push(``, `📚 *PENDIENTES DE AÑOS ANTERIORES (${pendActivasWA.length}):*`);
    pendActivasWA.forEach(p => {
      const condTxt = p.condicion === "RECURSADO" ? "Recursado" : "Comisión Evaluadora";
      lineas.push(`• *${p.materia}* (${p.anioOrigen || "Año ant."}) — _${condTxt}_`);
    });
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
  const tel = configInformeAlumno.telefonoPadre || est.telefonoFamilia || "";
  abrirWhatsAppBusinessDirecto(construirMensajeWhatsAppAlumno(est), tel);
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

  const materiasFiltradas = obtenerMateriasOrdenadasVisualmente().filter(m => materiaCumpleFiltroInforme(m));
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
      <td class="${obtenerClaseColorNota(notasMat.intDic)}">${notasMat.intDic || "-"}</td>
      <td class="${obtenerClaseColorNota(notasMat.intFeb)}">${notasMat.intFeb || "-"}</td>
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
        <div><strong>DNI:</strong> ${est.dni || "-"}</div>
        <div><strong>GRUPO:</strong> ${est.grupo || "-"}</div>
        <div><strong>TOTAL INASISTENCIAS:</strong> ${totFaltas}</div>
      </div>
      <div class="com-asist-box">
        <div><strong>Inasistencias por mes:</strong> ${resumenMeses}</div>
        <div><strong>Días Aus./Tarde (Teoría):</strong> ${fechasTeoFinal.length > 0 ? fechasTeoFinal.join(", ") : "Ninguno"}</div>
        <div><strong>Días Aus./Tarde (Taller):</strong> ${fechasTalFinal.length > 0 ? fechasTalFinal.join(", ") : "Ninguno"}</div>
        ${(() => {
          const pAct = obtenerPendientesDeEstudiante(est).filter(p => p.estado !== "ACREDITADA");
          if (pAct.length === 0) return "";
          return `<div><strong>Pendientes Años Ant. (${pAct.length}/${TOPE_MATERIAS_PENDIENTES}):</strong> ${pAct.map(p => `${p.materia} (${p.anioOrigen || "Ant."})`).join(" | ")}</div>`;
        })()}
      </div>
      <table class="com-table">
        <thead>
          <tr>
            <th style="text-align:left; width:30%;">MATERIA</th><th style="width:8%;">ÁREA</th>
            <th style="width:7.5%;">1° Val.</th><th style="width:7.5%;">1°C</th>
            <th style="width:7.5%;">2° Val.</th><th style="width:7.5%;">2°C</th>
            <th style="width:8%;">Int. 1°C</th><th style="width:8%;">Dic.</th>
            <th style="width:8%;">Feb.</th><th style="width:8%;">Final</th>
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
  const root = document.getElementById("printComunicadosRoot");
  root.classList.add("comunicado-single");
  root.innerHTML = construirTalonComunicadoHTML(est);
  document.body.classList.remove("print-mode-acta");
  document.body.classList.add("print-mode-comunicado");
  window.print();
  setTimeout(() => {
    document.body.classList.remove("print-mode-comunicado");
    root.classList.remove("comunicado-single");
  }, 600);
}

function imprimirComunicadosCursoCompleto() {
  const activos = (estado.estudiantes || []).filter(e => !esEstudianteTachado(e));
  if (activos.length === 0) return mostrarToast("No hay alumnos activos");
  const root = document.getElementById("printComunicadosRoot");
  root.classList.remove("comunicado-single");
  root.innerHTML = activos.map(est => construirTalonComunicadoHTML(est)).join("");
  document.body.classList.remove("print-mode-acta");
  document.body.classList.add("print-mode-comunicado");
  window.print();
  setTimeout(() => document.body.classList.remove("print-mode-comunicado"), 600);
}

async function guardarDatosFamiliaUI(filaHoja) {
  const est = (estado.estudiantes || []).find(e => e.filaHoja === Number(filaHoja));
  if (!est) return;

  const dni = document.getElementById("famInputDni")?.value.trim() || "";
  const adulto = document.getElementById("famInputAdulto")?.value.trim() || "";
  const email = document.getElementById("famInputEmail")?.value.trim() || "";
  const tel = document.getElementById("famInputTel")?.value.trim() || "";
  const resetClave = document.getElementById("famChkResetClave")?.checked || false;

  try {
    mostrarToast("⏳ Guardando legajo familiar y habilitando DNI...");
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "guardarDatosFamiliaEstudiante",
        curso: estado.cursoActual,
        datosFamilia: {
          orden: est.orden,
          nombre: est.nombre,
          dni: dni,
          adultoResponsable: adulto,
          emailFamilia: email,
          telefonoFamilia: tel,
          resetearClave: resetClave
        }
      })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);

    aplicarDatosRecibidos(json.data, true);
    mostrarToast(`✅ Legajo familiar guardado (Ingreso habilitado con DNI: ${dni || 'S/D'})`, 4000);
  } catch (err) {
    mostrarToast("⚠️ Error: " + err.message, 4000);
  }
}

function aplicarPlantillaNotificacionAlumno(tipoPlantilla, filaHoja) {
  const est = (estado.estudiantes || []).find(e => e.filaHoja === Number(filaHoja));
  if (!est) return;

  const totFaltas = (est.inasistencias && est.inasistencias.total) || 0;
  const cursoLimpio = (estado.cursoActual || "").replace(/_/g, " ");
  const inpTipo = document.getElementById("notifInputTipo");
  const inpAsunto = document.getElementById("notifInputAsunto");
  const inpMensaje = document.getElementById("notifInputMensaje");

  if (tipoPlantilla === "10_FALTAS") {
    if (inpTipo) inpTipo.value = "CITACION_10";
    if (inpAsunto) inpAsunto.value = `Notificación y Citación por 10 Inasistencias Acumuladas (${totFaltas})`;
    if (inpMensaje) {
      inpMensaje.value =
        `Estimada familia de ${est.nombre} (${cursoLimpio}):\n\n` +
        `Por medio de la presente notificamos que el/la estudiante registra a la fecha un total de ${totFaltas} inasistencias.\n` +
        `Habiendo alcanzado las 10 inasistencias en el marco de la Resolución N° 1650/24, solicitamos la presencia del adulto responsable en la escuela para firmar el acta de compromiso de asistencia a clases.`;
    }
  } else if (tipoPlantilla === "20_FALTAS") {
    if (inpTipo) inpTipo.value = "CITACION_20";
    if (inpAsunto) inpAsunto.value = `URGENTE: Citación por 20 Inasistencias Acumuladas (${totFaltas})`;
    if (inpMensaje) {
      inpMensaje.value =
        `Estimada familia de ${est.nombre} (${cursoLimpio}):\n\n` +
        `Notificamos que el/la estudiante ha alcanzado un total de ${totFaltas} inasistencias acumuladas en el ciclo lectivo.\n` +
        `Conforme a la Resolución N° 1650/24, solicitamos la presencia del adulto responsable en el establecimiento a fin de labrar el acta correspondiente y acordar pautas de acompañamiento para evitar llegar al límite anual de 28 inasistencias.`;
    }
  } else if (tipoPlantilla === "28_FALTAS") {
    if (inpTipo) inpTipo.value = "CITACION_28";
    if (inpAsunto) inpAsunto.value = `CITACIÓN PRIORITARIA: 28 Inasistencias — Rige 75% de Asistencia por Materia`;
    if (inpMensaje) {
      inpMensaje.value =
        `Estimada familia de ${est.nombre} (${cursoLimpio}):\n\n` +
        `Notificamos que el/la estudiante registra ${totFaltas} inasistencias, habiendo alcanzado el límite de 28 inasistencias anuales previsto en la Resolución N° 1650/24.\n` +
        `A partir de esta instancia pasa a contabilizarse el 75% de asistencia sobre las clases efectivamente dictadas en cada materia (Teoría y Taller), debiendo intensificar aquellas materias que no alcancen dicho porcentaje.\n` +
        `Se cita al adulto responsable en el establecimiento.`;
    }
  } else if (tipoPlantilla === "CITACION_GRAL") {
    if (inpTipo) inpTipo.value = "CITACION_FAMILIA";
    if (inpAsunto) inpAsunto.value = `Citación Presencial de Familia - E.E.S.T. N° 2 San Fernando`;
    if (inpMensaje) {
      inpMensaje.value =
        `Estimada familia de ${est.nombre} (${cursoLimpio}):\n\n` +
        `Solicitamos la presencia del adulto responsable en la escuela en la fecha y horario indicados a fin de mantener una reunión sobre la trayectoria escolar del/de la estudiante.`;
    }
  }
}

async function enviarNotificacionFamiliaUI(filaHoja) {
  const est = (estado.estudiantes || []).find(e => e.filaHoja === Number(filaHoja));
  if (!est) return;

  const tipo = document.getElementById("notifInputTipo")?.value || "COMUNICADO";
  const asunto = document.getElementById("notifInputAsunto")?.value.trim() || "";
  const mensaje = document.getElementById("notifInputMensaje")?.value.trim() || "";
  const fechaCitRaw = document.getElementById("notifInputFechaCit")?.value || "";
  const horaCit = document.getElementById("notifInputHoraCit")?.value.trim() || "";
  const emailDest = document.getElementById("notifInputEmailDest")?.value.trim() || est.emailFamilia || "";

  if (!asunto || !mensaje) {
    mostrarToast("⚠️ Completá el asunto y el mensaje de la notificación");
    return;
  }

  let fechaCitFormateada = "";
  if (fechaCitRaw && /^\d{4}-\d{2}-\d{2}$/.test(fechaCitRaw)) {
    const [y, m, d] = fechaCitRaw.split("-");
    fechaCitFormateada = `${d}/${m}/${y}`;
  }

  try {
    mostrarToast("⏳ Enviando notificación y correo electrónico...");
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "enviarNotificacionFamilia",
        curso: estado.cursoActual,
        notificacion: {
          ordenAlumno: est.orden,
          nombreAlumno: est.nombre,
          dniAlumno: est.dni || "",
          tipo: tipo,
          asunto: asunto,
          mensaje: mensaje,
          fechaCitacion: fechaCitFormateada,
          horaCitacion: horaCit,
          emailDestino: emailDest
        }
      })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);

    aplicarDatosRecibidos(json.data, true);
    mostrarToast(json.emailEnviado ? `📧 Notificación enviada por Email y App` : `📌 Guardada en App (${json.detalleEmail})`, 4500);
  } catch (err) {
    mostrarToast("⚠️ Error: " + err.message, 4000);
  }
}

async function confirmarLecturaNotificacionUI(idNotif) {
  try {
    mostrarToast("⏳ Registrando confirmación de lectura...");
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "confirmarLecturaNotificacion",
        curso: estado.cursoActual,
        idNotificacion: idNotif
      })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);

    aplicarDatosRecibidos(json.data, true);
    mostrarToast("✅ Recepción confirmada con fecha y hora");
  } catch (err) {
    mostrarToast("⚠️ Error: " + err.message, 4000);
  }
}

async function eliminarNotificacionUI(idNotif) {
  if (!confirm("¿Eliminar este registro de notificación?")) return;
  try {
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "eliminarNotificacionFamilia",
        curso: estado.cursoActual,
        idNotificacion: idNotif
      })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);
    aplicarDatosRecibidos(json.data, true);
    mostrarToast("🗑️ Notificación eliminada");
  } catch (err) {
    mostrarToast("⚠️ Error: " + err.message, 4000);
  }
}

const TOPE_MATERIAS_PENDIENTES = 5;

function obtenerPendientesDeEstudiante(est) {
  if (!est) return [];
  const lista = estado.pendientesCurso || [];
  const dniEst = String(est.dni || "").replace(/\D+/g, "").trim();
  const claveEst = normalizarClaveNombreAlumno(est.nombre);

  return lista.filter(p => {
    const dniP = String(p.dniAlumno || "").replace(/\D+/g, "").trim();
    if (dniEst && dniP && dniEst === dniP) return true;
    return normalizarClaveNombreAlumno(p.nombreAlumno) === claveEst;
  });
}

function toggleFormNuevaPendiente() {
  const box = document.getElementById("formNuevaPendienteBox");
  if (!box) return;
  box.style.display = (box.style.display === "none" || !box.style.display) ? "block" : "none";
}

async function guardarNuevaPendienteUI(filaHoja) {
  const est = (estado.estudiantes || []).find(e => e.filaHoja === Number(filaHoja));
  if (!est) return;

  const materia = document.getElementById("pendInputMateria")?.value.trim() || "";
  const anioOrigen = document.getElementById("pendInputAnioOrigen")?.value.trim() || "";
  const area = document.getElementById("pendInputArea")?.value || "TEORIA";
  const condicion = document.getElementById("pendInputCondicion")?.value || "COMISION_EVALUADORA";
  const instanciaFecha = document.getElementById("pendInputInstancia")?.value.trim() || "";
  const observaciones = document.getElementById("pendInputObs")?.value.trim() || "";

  if (!materia) {
    mostrarToast("⚠️ Escribí el nombre de la materia pendiente");
    return;
  }

  try {
    mostrarToast("⏳ Guardando materia pendiente...");
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "guardarMateriaPendiente",
        curso: estado.cursoActual,
        pendiente: {
          dniAlumno: est.dni || "",
          nombreAlumno: est.nombre,
          anioOrigen: anioOrigen || "Año anterior",
          materia: materia,
          area: area,
          condicion: condicion,
          instanciaFecha: instanciaFecha,
          observaciones: observaciones
        }
      })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);

    aplicarDatosRecibidos(json.data, true);
    mostrarToast(`✅ Materia pendiente "${materia.toUpperCase()}" registrada`);
  } catch (err) {
    mostrarToast("⚠️ Error: " + err.message, 4000);
  }
}

async function acreditarPendienteUI(idPendiente, nombreMat) {
  const notaRaw = prompt(`Acreditación en Comisión Evaluadora — "${nombreMat}"\n\nIngresá la calificación de acreditación (4 a 10):`);
  if (notaRaw === null) return;
  const notaNum = parseFloat(String(notaRaw).trim().replace(",", "."));
  if (isNaN(notaNum) || notaNum < 4 || notaNum > 10) {
    mostrarToast("⚠️ Para acreditar la nota debe ser entre 4 y 10");
    return;
  }

  const hoy = new Date();
  const fechaHoy = `${String(hoy.getDate()).padStart(2, "0")}/${String(hoy.getMonth() + 1).padStart(2, "0")}/${hoy.getFullYear()}`;
  const instancia = prompt("Instancia / Mesa y Fecha:", `Comisión Evaluadora (${fechaHoy})`);
  if (instancia === null) return;

  const obs = prompt("Observaciones / Libro y Folio de Acta (Opcional):", "");
  if (obs === null) return;

  try {
    mostrarToast("⏳ Registrando acreditación...");
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "acreditarMateriaPendiente",
        curso: estado.cursoActual,
        acreditacion: {
          idPendiente: idPendiente,
          nota: notaNum,
          instanciaFecha: instancia.trim(),
          observaciones: obs.trim()
        }
      })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);

    aplicarDatosRecibidos(json.data, true);
    mostrarToast(`✅ "${nombreMat}" acreditada con ${notaNum}`);
  } catch (err) {
    mostrarToast("⚠️ Error: " + err.message, 4000);
  }
}

async function reabrirPendienteUI(idPendiente, nombreMat) {
  if (!confirm(`¿Volver "${nombreMat}" al estado PENDIENTE (se borrará la nota de acreditación)?`)) return;
  try {
    mostrarToast("⏳ Actualizando estado...");
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "reabrirMateriaPendiente",
        curso: estado.cursoActual,
        idPendiente: idPendiente
      })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);

    aplicarDatosRecibidos(json.data, true);
    mostrarToast(`↩️ "${nombreMat}" marcada nuevamente como pendiente`);
  } catch (err) {
    mostrarToast("⚠️ Error: " + err.message, 4000);
  }
}

async function alternarCondicionPendienteUI(idPendiente, condicionActual) {
  const nuevaCond = (condicionActual === "RECURSADO") ? "COMISION_EVALUADORA" : "RECURSADO";
  const labelNueva = (nuevaCond === "RECURSADO") ? "Recursado" : "Comisión Evaluadora";
  try {
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "cambiarCondicionPendiente",
        curso: estado.cursoActual,
        idPendiente: idPendiente,
        nuevaCondicion: nuevaCond
      })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);

    aplicarDatosRecibidos(json.data, true);
    mostrarToast(`🔄 Condición cambiada a ${labelNueva}`);
  } catch (err) {
    mostrarToast("⚠️ Error: " + err.message, 4000);
  }
}

async function eliminarPendienteUI(idPendiente, nombreMat) {
  if (!confirm(`¿Eliminar el registro de materia pendiente "${nombreMat}"?`)) return;
  try {
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "eliminarMateriaPendiente",
        curso: estado.cursoActual,
        idPendiente: idPendiente
      })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);

    aplicarDatosRecibidos(json.data, true);
    mostrarToast("🗑️ Materia pendiente eliminada");
  } catch (err) {
    mostrarToast("⚠️ Error: " + err.message, 4000);
  }
}

function construirSeccionPendientesAlumnoHTML(est, esFam) {
  const todas = obtenerPendientesDeEstudiante(est);
  const activas = todas.filter(p => p.estado !== "ACREDITADA");
  const acreditadas = todas.filter(p => p.estado === "ACREDITADA");
  const cantActivas = activas.length;

  let badgeTope = "";
  let alertaEDTE = "";
  if (cantActivas === 0) {
    badgeTope = `<span class="badge badge-ok">✅ 0 / ${TOPE_MATERIAS_PENDIENTES} pendientes (Al día)</span>`;
  } else if (cantActivas <= TOPE_MATERIAS_PENDIENTES) {
    badgeTope = `<span class="badge badge-warn">📋 ${cantActivas} / ${TOPE_MATERIAS_PENDIENTES} pendientes — Comisión Evaluadora</span>`;
  } else {
    badgeTope = `<span class="badge badge-danger">🚨 ${cantActivas} / ${TOPE_MATERIAS_PENDIENTES} pendientes — Supera tope (EDTE / Recursado)</span>`;
    alertaEDTE = `
      <div style="background:#fef2f2; border:1.5px solid #fca5a5; color:#991b1b; border-radius:8px; padding:8px 10px; font-size:12px; font-weight:700; margin-bottom:10px;">
        🚨 Atención: El estudiante registra <b>${cantActivas} materias pendientes de acreditación</b>, superando el tope general de ${TOPE_MATERIAS_PENDIENTES}. Requiere intervención del Equipo de Definición de Trayectorias Educativas (EDTE) para definir qué materias acredita en Comisión Evaluadora y cuáles recursa.
      </div>
    `;
  }

  let html = `
    <div class="panel pendientes-panel" style="margin-bottom:14px; border:1px solid #fdba74; background:#fffaf5;">
      <div class="panel-title" style="color:#9a3412;">
        <span>Materias Pendientes de Acreditación</span>
        <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
          ${badgeTope}
          ${!esFam ? `<button type="button" class="btn-outline" style="border-color:#c2410c; color:#9a3412;" onclick="toggleFormNuevaPendiente()">+ Cargar Pendiente</button>` : ""}
        </div>
      </div>
      ${alertaEDTE}
  `;

  if (!esFam) {
    html += `
      <div id="formNuevaPendienteBox" style="display:none; background:#ffffff; border:1px solid #fed7aa; border-radius:8px; padding:10px 12px; margin-bottom:12px;">
        <div class="form-grid">
          <div class="form-group">
            <label>Materia Pendiente</label>
            <input type="text" id="pendInputMateria" placeholder="Ej: Matemática, Taller, Física...">
          </div>
          <div class="form-group">
            <label>Año / Curso de Origen</label>
            <input type="text" id="pendInputAnioOrigen" placeholder="Ej: 4to - 2025">
          </div>
          <div class="form-group">
            <label>Área</label>
            <select id="pendInputArea">
              <option value="TEORIA">📘 Teoría</option>
              <option value="TALLER">🔧 Taller</option>
            </select>
          </div>
          <div class="form-group">
            <label>Condición (RA)</label>
            <select id="pendInputCondicion">
              <option value="COMISION_EVALUADORA">📝 Comisión Evaluadora</option>
              <option value="RECURSADO">🔁 Recursado</option>
            </select>
          </div>
          <div class="form-group">
            <label>Instancia / Mesa Prevista (Opcional)</label>
            <input type="text" id="pendInputInstancia" placeholder="Ej: Comisión Julio / Dic 2026">
          </div>
          <div class="form-group">
            <label>Observaciones (Opcional)</label>
            <input type="text" id="pendInputObs" placeholder="Ej: Profesor / Contenidos / Pase">
          </div>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:10px;">
          <button type="button" class="btn-outline" onclick="toggleFormNuevaPendiente()">Cancelar</button>
          <button type="button" class="btn-main btn-print-blue" style="padding:7px 14px; font-size:12px;" onclick="guardarNuevaPendienteUI(${est.filaHoja})">
            💾 Guardar Materia Pendiente
          </button>
        </div>
      </div>
    `;
  }

  if (todas.length === 0) {
    html += `<p style="font-size:12px; color:#64748b;">No se registran materias pendientes de acreditación de años anteriores para este estudiante.</p>`;
  } else {
    activas.forEach(p => {
      const esRec = p.condicion === "RECURSADO";
      const matEsc = p.materia.replace(/'/g, "\'");
      html += `
        <div class="pendiente-item-card ${esRec ? 'pendiente-recursado' : ''}">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
            <div>
              <strong>${p.area === "TALLER" ? "🔧" : "📘"} ${p.materia}</strong>
              <span class="badge badge-grp" style="margin-left:4px;">${p.anioOrigen || "Año ant."}</span>
              <span class="badge ${esRec ? 'badge-danger' : 'badge-warn'}">${esRec ? '🔁 Recursado' : '📝 Comisión Evaluadora'}</span>
            </div>
            ${!esFam ? `
            <div style="display:flex; gap:5px; flex-wrap:wrap;">
              <button type="button" class="btn-success-outline" style="padding:4px 8px; font-size:11px;" onclick="acreditarPendienteUI('${p.id}', '${matEsc}')">✅ Acreditar</button>
              <button type="button" class="btn-outline" style="padding:4px 8px; font-size:11px;" title="Cambiar entre Comisión Evaluadora y Recursado" onclick="alternarCondicionPendienteUI('${p.id}', '${p.condicion}')">🔁</button>
              <button type="button" class="btn-danger-outline" style="padding:4px 8px; font-size:11px;" onclick="eliminarPendienteUI('${p.id}', '${matEsc}')">🗑️</button>
            </div>` : ""}
          </div>
          ${(p.instanciaFecha || p.observaciones) ? `
          <div style="font-size:11.5px; color:#475569; margin-top:4px;">
            ${p.instanciaFecha ? `📅 <b>Instancia:</b> ${p.instanciaFecha}` : ""}
            ${(p.instanciaFecha && p.observaciones) ? " &nbsp;|&nbsp; " : ""}
            ${p.observaciones ? `📝 ${p.observaciones}` : ""}
          </div>` : ""}
        </div>
      `;
    });

    if (acreditadas.length > 0) {
      html += `<div style="font-size:11px; font-weight:800; color:#15803d; margin:10px 0 6px 0; text-transform:uppercase;">✅ Materias Pendientes ya Acreditadas (${acreditadas.length})</div>`;
      acreditadas.forEach(p => {
        const matEsc = p.materia.replace(/'/g, "\'");
        html += `
          <div class="pendiente-item-card pendiente-acreditada">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
              <div>
                <strong>${p.area === "TALLER" ? "🔧" : "📘"} ${p.materia}</strong>
                <span class="badge badge-grp" style="margin-left:4px;">${p.anioOrigen || "Año ant."}</span>
                <span class="badge badge-ok">✅ Acreditada: ${p.notaAcreditacion}</span>
              </div>
              ${!esFam ? `
              <div style="display:flex; gap:5px;">
                <button type="button" class="btn-outline" style="padding:3px 7px; font-size:11px;" onclick="reabrirPendienteUI('${p.id}', '${matEsc}')">↩️ Reabrir</button>
                <button type="button" class="btn-danger-outline" style="padding:3px 7px; font-size:11px;" onclick="eliminarPendienteUI('${p.id}', '${matEsc}')">🗑️</button>
              </div>` : ""}
            </div>
            ${(p.instanciaFecha || p.observaciones) ? `
            <div style="font-size:11.5px; color:#475569; margin-top:4px;">
              ${p.instanciaFecha ? `📅 ${p.instanciaFecha}` : ""}
              ${(p.instanciaFecha && p.observaciones) ? " &nbsp;|&nbsp; " : ""}
              ${p.observaciones ? `📝 ${p.observaciones}` : ""}
            </div>` : ""}
          </div>
        `;
      });
    }
  }

  html += `</div>`;
  return html;
}

function construirSeccionGraficosAsistenciaHTML(est, resumenPorMateria) {
  const totFaltas = (est.inasistencias && est.inasistencias.total) || 0;
  const partesNormales = (estado.historialAsistencias || []).filter(
    h => (!h.estadoDia || h.estadoDia === "NORMAL") && String(h.nominaAusentes || "").indexOf("[SIN ACTIVIDAD") === -1
  );
  let jornadasEstimadas = 0;
  const fechasUnicasNormales = new Set(partesNormales.map(p => normalizarFechaDDMMYYYY(p.fecha)).filter(Boolean));
  jornadasEstimadas = Math.max(fechasUnicasNormales.size, Math.ceil(totFaltas + 10), 40);

  const porcentajeAnual = Math.max(0, Math.min(100, Math.round(((jornadasEstimadas - totFaltas) / jornadasEstimadas) * 100)));
  let colorAnillo = "#16a34a";
  let textoEstadoAnual = "En regla (< 10 faltas)";
  if (totFaltas >= 28) {
    colorAnillo = "#dc2626";
    textoEstadoAnual = "🚨 Límite 28 alcanzado (Rige 75% por materia)";
  } else if (totFaltas >= 20) {
    colorAnillo = "#ea580c";
    textoEstadoAnual = "⚠️ Alerta 20 inasistencias (2° Citación)";
  } else if (totFaltas >= 10) {
    colorAnillo = "#d97706";
    textoEstadoAnual = "🔔 Alerta 10 inasistencias (1° Citación)";
  }

  let maxMes = 4;
  MESES_LISTA.forEach(m => {
    const v = Number((est.inasistencias && est.inasistencias.meses && est.inasistencias.meses[m]) || 0);
    if (v > maxMes) maxMes = v;
  });

  let barrasHTML = "";
  MESES_LISTA.forEach(m => {
    const val = Number((est.inasistencias && est.inasistencias.meses && est.inasistencias.meses[m]) || 0);
    const pctAltura = val > 0 ? Math.max(12, Math.round((val / maxMes) * 100)) : 4;
    const colorBarra = val >= 4 ? "#dc2626" : (val >= 2 ? "#d97706" : (val > 0 ? "#2563eb" : "#cbd5e1"));
    barrasHTML += `
      <div class="bar-month-col">
        <span class="bar-month-val">${val > 0 ? val : "0"}</span>
        <div class="bar-month-fill" style="height:${pctAltura}%; background:${colorBarra};" title="${m}: ${val} inasistencias"></div>
        <span class="bar-month-lbl">${m.slice(0, 3)}</span>
      </div>
    `;
  });

  let filas75 = "";
  resumenPorMateria.forEach(rm => {
    const badgeEstado = rm.clasesDictadas === 0
      ? `<span class="badge badge-grp">Sin partes cargados</span>`
      : (rm.enRegla75
          ? `<span class="badge badge-ok">✅ Cumple (${rm.porcentaje}%)</span>`
          : `<span class="badge badge-danger">⚠️ Intensifica (${rm.porcentaje}% < 75%)</span>`);

    filas75 += `
      <tr>
        <td class="td-left">${rm.esTaller ? '🔧' : '📘'} ${rm.nombre}</td>
        <td><strong>${rm.clasesDictadas}</strong>${rm.clasesSinProfesor > 0 ? ` <small style="color:#b91c1c;">(-${rm.clasesSinProfesor} s/prof)</small>` : ''}</td>
        <td style="color:#15803d; font-weight:800;">${rm.asistidasEfectivas}</td>
        <td style="color:#b91c1c; font-weight:800;">${rm.ausentesInjustif}${rm.ausentesJustif > 0 ? ` <small style="color:#6d28d9;">(+${rm.ausentesJustif} J)</small>` : ''}</td>
        <td><strong>${rm.clasesDictadas > 0 ? rm.porcentaje + '%' : '100%'}</strong></td>
        <td>${badgeEstado}</td>
      </tr>
    `;
  });

  return `
    <div class="charts-grid-box">
      <div class="chart-card">
        <strong style="font-size:12.5px; color:#0f172a; text-align:center;">📈 Porcentaje de Asistencia Anual</strong>
        <div class="donut-ring" style="background: conic-gradient(${colorAnillo} 0% ${porcentajeAnual}%, #e2e8f0 ${porcentajeAnual}% 100%);">
          <div class="donut-inner">
            <strong style="color:${colorAnillo};">${porcentajeAnual}%</strong>
            <small>Asistencia</small>
          </div>
        </div>
        <div style="font-size:12px; font-weight:800; color:#0f172a; text-align:center;">
          Inasistencias Acumuladas: <span style="color:${colorAnillo};">${totFaltas}</span> / 28
        </div>
        <div style="font-size:11px; color:#475569; font-weight:700; margin-top:4px; text-align:center;">
          ${textoEstadoAnual}
        </div>
      </div>

      <div class="chart-card" style="align-items:stretch;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:4px;">
          <strong style="font-size:12.5px; color:#0f172a;">📊 Evolución Mensual de Inasistencias (Marzo a Diciembre)</strong>
          <span style="font-size:11px; color:#64748b; font-weight:700;">Umbrales de citación: 10 • 20 • 28 faltas</span>
        </div>
        <div class="bars-monthly-wrap">${barrasHTML}</div>
      </div>
    </div>

    <div class="panel" style="margin-bottom:14px; border:1px solid #cbd5e1;">
      <div class="panel-title" style="margin-bottom:6px;">
        <span>Asistencia por Materia (75% mínimo)</span>
        <span class="badge ${totFaltas >= 28 ? 'badge-danger' : 'badge-grp'}">
          ${totFaltas >= 28 ? '🚨 ACTIVO POR SUPERAR 28 FALTAS (Res. 1650/24)' : 'ℹ️ Seguimiento Preventivo por Asignatura'}
        </span>
      </div>
      <p style="font-size:11.5px; color:#475569; margin-bottom:8px;">
        Se contabilizan únicamente las <b>clases efectivamente dictadas</b> (partes con estado Normal donde asistió el profesor/a de la materia).
      </p>
      <div class="table-wrap">
        <table class="app-table">
          <thead>
            <tr>
              <th>Materia</th>
              <th>Clases Dictadas</th>
              <th>Asistidas (P/T)</th>
              <th>Ausencias (A/J)</th>
              <th>% Asistencia</th>
              <th>Situación (Mín. 75%)</th>
            </tr>
          </thead>
          <tbody>${filas75 || '<tr><td colspan="6">Sin materias configuradas.</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderVistaAlumno() {
  const cont = document.getElementById("contenedorFichaAlumno");
  if (!cont) return;
  const filaSel = parseInt(document.getElementById("alumnoSelect")?.value || "0", 10);
  const est = (estado.estudiantes || []).find(e => e.filaHoja === filaSel) || (estado.estudiantes || [])[0];
  if (!est) {
    cont.innerHTML = `<p style="padding:12px; color:#64748b;">No se encontró el legajo del estudiante.</p>`;
    return;
  }

  const esFam = (typeof esRolFamiliaActual === "function" && esRolFamiliaActual());
  const tachado = esEstudianteTachado(est);
  const totFaltas = (est.inasistencias && est.inasistencias.total) || 0;
  const amb = configInformeAlumno.ambito;
  const nombreApp = obtenerEtiquetaAppWA();
  const resumenPorMateria = calcularAsistenciaPorMateriaEstudiante(est);

  const claveEst = normalizarClaveNombreAlumno(est.nombre);
  const notifsEst = (estado.notificacionesCurso || []).filter(n => {
    if (n.nombreAlumno === "CURSO COMPLETO" || n.ordenAlumno === "TODOS") return true;
    if (est.dni && n.dniAlumno && String(est.dni) === String(n.dniAlumno)) return true;
    return normalizarClaveNombreAlumno(n.nombreAlumno) === claveEst;
  });
  const pendientesLectura = notifsEst.filter(n => n.estadoLectura !== "NOTIFICADO");

  let html = "";

  if (pendientesLectura.length > 0) {
    html += `
      <div class="notif-banner-pending">
        <strong style="font-size:14px; color:#b45309; display:block; margin-bottom:6px;">
          🔔 Tenés ${pendientesLectura.length} comunicado(s) o citación(es) oficial(es) pendiente(s) de confirmación
        </strong>
    `;
    pendientesLectura.forEach(n => {
      html += `
        <div class="notif-item-card unread" style="margin-bottom:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
            <strong style="color:#0f172a; font-size:13px;">📌 ${n.asunto}</strong>
            <span class="badge badge-warn">${n.fechaHora}</span>
          </div>
          <p style="font-size:12.5px; color:#1e293b; white-space:pre-wrap; margin:6px 0;">${n.mensaje}</p>
          ${n.fechaCitacion ? `<div style="font-size:12px; font-weight:800; color:#b45309; margin-bottom:6px;">📅 Fecha de Citación en la Escuela: ${n.fechaCitacion} ${n.horaCitacion ? 'a las ' + n.horaCitacion + ' hs' : ''}</div>` : ''}
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-top:6px;">
            <small style="color:#64748b; font-weight:700;">Emitido por: ${n.emitidoPor}</small>
            <button type="button" class="btn-main btn-w4b" style="padding:7px 14px; font-size:12px;" onclick="confirmarLecturaNotificacionUI('${n.id}')">
              ✅ Confirmar Recepción y Lectura
            </button>
          </div>
        </div>
      `;
    });
    html += `</div>`;
  }

  html += `
    <div class="student-admin-bar">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <div>
          <div class="stu-name ${tachado ? 'tachado-text' : ''}" style="font-size:15.5px;">${est.orden}. ${est.nombre}</div>
          <div style="font-size:12px; color:#475569; margin-top:3px;">
            <strong>Curso:</strong> ${(estado.cursoActual || "").replace(/_/g, " ")} &nbsp;|&nbsp;
            <strong>DNI:</strong> ${est.dni || "Sin cargar"} &nbsp;|&nbsp;
            <strong>Grupo:</strong> ${est.grupo} &nbsp;|&nbsp;
            <strong>Faltas Acumuladas:</strong> <b style="color:#b91c1c;">${totFaltas}</b>
          </div>
        </div>
        ${!esFam ? `
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button type="button" class="btn-outline" onclick="prepararActaDesdeAlumno(${est.filaHoja}, 'INASISTENCIAS')">📄 Labrar Acta (10/20/28)</button>
          <button type="button" class="btn-outline" onclick="prepararActaDesdeAlumno(${est.filaHoja}, 'INCOMPARECENCIA')">📄 Acta Incomparecencia</button>
          <button type="button" class="btn-outline" onclick="editarDatosEstudiante(${est.filaHoja})">✏️ Editar Orden / Nombre</button>
          ${tachado ? `<button type="button" class="btn-success-outline" onclick="alternarEstadoTachado(${est.filaHoja})">✅ Activar</button>` : `<button type="button" class="btn-danger-outline" onclick="alternarEstadoTachado(${est.filaHoja})">🚫 Tachar</button>`}
        </div>` : ''}
      </div>
    </div>
  `;

  html += construirSeccionGraficosAsistenciaHTML(est, resumenPorMateria);
  html += construirSeccionPendientesAlumnoHTML(est, esFam);

  if (!esFam) {
    html += `
      <div class="panel" style="background:#f8fafc; border:1px solid #93c5fd; margin-bottom:14px;">
        <div class="panel-title">
          <span>Datos de Familia y Acceso</span>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label>DNI del Estudiante (Usuario y Clave Familiar)</label>
            <input type="text" id="famInputDni" placeholder="Solo números, ej: 48123456" value="${est.dni || ''}">
          </div>
          <div class="form-group">
            <label>Adulto Responsable (Apellido y Nombre)</label>
            <input type="text" id="famInputAdulto" placeholder="Ej: GÓMEZ MARÍA" value="${est.adultoResponsable || ''}">
          </div>
          <div class="form-group">
            <label>Email de la Familia (Recibe avisos de @abc.gob.ar)</label>
            <input type="email" id="famInputEmail" placeholder="familia@email.com" value="${est.emailFamilia || ''}">
          </div>
          <div class="form-group">
            <label>Teléfono / WhatsApp Familiar</label>
            <input type="tel" id="famInputTel" placeholder="Ej: 1123456789" value="${est.telefonoFamilia || ''}">
          </div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-top:10px;">
          <label style="font-size:12px; color:#334155; font-weight:700; display:flex; align-items:center; gap:6px; cursor:pointer;">
            <input type="checkbox" id="famChkResetClave">
            Restablecer contraseña de la familia igual al N° de DNI
          </label>
          <button type="button" class="btn-main btn-print-blue" style="padding:8px 14px; font-size:12.5px;" onclick="guardarDatosFamiliaUI(${est.filaHoja})">
            💾 Guardar DNI / Email y Habilitar Acceso Familiar
          </button>
        </div>
      </div>

      <div class="panel" style="background:#eff6ff; border:1px solid #bfdbfe; margin-bottom:14px;">
        <div class="panel-title">
          <span>Notificaciones y Citaciones</span>
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px;">
          <button type="button" class="btn-outline" onclick="aplicarPlantillaNotificacionAlumno('10_FALTAS', ${est.filaHoja})">🔔 Plantilla 10 Faltas</button>
          <button type="button" class="btn-outline" onclick="aplicarPlantillaNotificacionAlumno('20_FALTAS', ${est.filaHoja})">⚠️ Plantilla 20 Faltas</button>
          <button type="button" class="btn-outline" onclick="aplicarPlantillaNotificacionAlumno('28_FALTAS', ${est.filaHoja})">🚨 Plantilla 28 Faltas (75%)</button>
          <button type="button" class="btn-outline" onclick="aplicarPlantillaNotificacionAlumno('CITACION_GRAL', ${est.filaHoja})">📅 Citación de Familia</button>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label>Tipo de Aviso</label>
            <select id="notifInputTipo">
              <option value="COMUNICADO">Comunicado Institucional</option>
              <option value="CITACION_10">1° Citación (10 Inasistencias)</option>
              <option value="CITACION_20">2° Citación (20 Inasistencias)</option>
              <option value="CITACION_28">3° Citación (28 Inasistencias - 75%)</option>
              <option value="CITACION_FAMILIA">Citación Presencial de Familia</option>
            </select>
          </div>
          <div class="form-group">
            <label>Email Destino Familiar</label>
            <input type="email" id="notifInputEmailDest" value="${est.emailFamilia || ''}" placeholder="Cargá el email arriba o acá">
          </div>
          <div class="form-group">
            <label>Fecha de Citación (Si aplica)</label>
            <input type="date" id="notifInputFechaCit">
          </div>
          <div class="form-group">
            <label>Hora de Citación (Si aplica)</label>
            <input type="time" id="notifInputHoraCit" value="14:00">
          </div>
        </div>
        <div class="form-group" style="margin-top:8px;">
          <label>Asunto de la Notificación</label>
          <input type="text" id="notifInputAsunto" placeholder="Ej: Citación por Inasistencias Acumuladas">
        </div>
        <div class="form-group" style="margin-top:8px;">
          <label>Mensaje Oficial</label>
          <textarea id="notifInputMensaje" rows="4" placeholder="Escribí el mensaje o tocá una de las plantillas rápidas de arriba..."></textarea>
        </div>
        <div style="display:flex; justify-content:flex-end; margin-top:10px;">
          <button type="button" class="btn-main btn-print-blue" style="padding:9px 16px; font-size:13px;" onclick="enviarNotificacionFamiliaUI(${est.filaHoja})">
            📧 Enviar Correo Oficial y Publicar en Portal de la Familia
          </button>
        </div>
      </div>

      <div class="report-config-card">
        <strong style="font-size:13.5px; color:#15803d;">Comunicado Individual (WhatsApp / Cuaderno)</strong>
        <div class="scope-pill-bar">
          <button type="button" class="scope-pill ${amb === 'TODO' ? 'active-TODO' : ''}" onclick="cambiarAmbitoInformeAlumno('TODO')">📋 Todo</button>
          <button type="button" class="scope-pill ${amb === 'TALLER' ? 'active-TALLER' : ''}" onclick="cambiarAmbitoInformeAlumno('TALLER')">🔧 Solo Taller</button>
          <button type="button" class="scope-pill ${amb === 'TEORIA' ? 'active-TEORIA' : ''}" onclick="cambiarAmbitoInformeAlumno('TEORIA')">📘 Solo Teoría</button>
        </div>
        <div class="form-grid">
          <div class="form-group"><label>WhatsApp Familiar</label><input type="tel" id="infTelefonoPadre" placeholder="Ej: 1123456789" value="${configInformeAlumno.telefonoPadre || est.telefonoFamilia || ""}" oninput="actualizarConfigInformeDesdeInputs()"></div>
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
            <button type="button" class="btn-main btn-w4b" onclick="enviarInformeAlumnoImagenWhatsApp()">🖼️ Enviar Imagen por WhatsApp</button>
            <button type="button" class="btn-main btn-print-blue" onclick="imprimirComunicadoAlumnoActual()">🖨️ Imprimir / PDF</button>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" id="btnEnviarWAAlumno" class="btn-outline" style="flex:1;" onclick="enviarInformeAlumnoWhatsApp()">💬 Enviar texto por ${nombreApp}</button>
            <button type="button" class="btn-outline" style="flex:1;" onclick="copiarInformeAlumnoPortapapeles()">📋 Copiar Texto</button>
            <button type="button" class="btn-outline" style="flex:1;" onclick="imprimirComunicadosCursoCompleto()">🖨️ Lote Todo el Curso</button>
          </div>
        </div>
        <div class="wa-preview-box" id="waAlumnoPreviewBox">${construirMensajeWhatsAppAlumno(est)}</div>
      </div>
    `;
  }

  html += `
    <div class="panel" style="margin-bottom:14px;">
      <div class="panel-title">
        <span>Historial de Comunicados (${notifsEst.length})</span>
      </div>
  `;
  if (notifsEst.length === 0) {
    html += `<p style="font-size:12px; color:#64748b;">No hay notificaciones registradas para este estudiante.</p>`;
  } else {
    notifsEst.forEach(n => {
      const leido = n.estadoLectura === "NOTIFICADO";
      html += `
        <div class="notif-item-card ${leido ? '' : 'unread'}">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
            <div>
              <span class="badge ${leido ? 'badge-ok' : 'badge-warn'}">${leido ? '✅ NOTIFICADO: ' + n.fechaLectura : '⏳ PENDIENTE DE LECTURA'}</span>
              <strong style="font-size:13px; margin-left:6px;">${n.asunto}</strong>
            </div>
            <small style="color:#64748b; font-weight:700;">${n.fechaHora} | Email: ${n.emailEnviado}</small>
          </div>
          <p style="font-size:12px; color:#1e293b; white-space:pre-wrap; margin:6px 0;">${n.mensaje}</p>
          ${n.fechaCitacion ? `<div style="font-size:11.5px; font-weight:800; color:#b45309;">📅 Citación: ${n.fechaCitacion} ${n.horaCitacion || ''}</div>` : ''}
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px; flex-wrap:wrap; gap:6px;">
            <small style="color:#64748b;">Emitido por: ${n.emitidoPor}</small>
            <div style="display:flex; gap:6px;">
              ${!leido ? `<button type="button" class="btn-success-outline" onclick="confirmarLecturaNotificacionUI('${n.id}')">✅ Confirmar Recepción</button>` : ''}
              ${!esFam && n.fechaCitacion ? `<button type="button" class="btn-outline" style="padding:4px 8px; font-size:11px;" onclick="prepararActaDesdeAlumno(${est.filaHoja}, 'INCOMPARECENCIA', '${n.fechaCitacion}', '${n.horaCitacion || ''}')">📄 Acta Incomparecencia</button>` : ''}
              ${!esFam ? `<button type="button" class="btn-danger-outline" style="padding:4px 8px; font-size:11px;" onclick="eliminarNotificacionUI('${n.id}')">🗑️</button>` : ''}
            </div>
          </div>
        </div>
      `;
    });
  }
  html += `</div>`;

  html += construirBannerMigracionDicFebHTML();
  const materiasOrdenadas = obtenerMateriasOrdenadasVisualmente();
  let mostroBannerTeoria = false;
  let mostroBannerTaller = false;

  materiasOrdenadas.forEach(mat => {
    const esTal = esMateriaDeTaller(mat);
    if (amb === "TALLER" && !esTal) return;
    if (amb === "TEORIA" && esTal) return;

    if (!esTal && !mostroBannerTeoria) {
      html += `<div class="section-divider-banner divider-teoria">📘 Calificaciones — Materias de Teoría</div>`;
      mostroBannerTeoria = true;
    }
    if (esTal && !mostroBannerTaller) {
      html += `<div class="section-divider-banner divider-taller">🔧 Calificaciones — Materias de Taller</div>`;
      mostroBannerTaller = true;
    }

    const notasMat = (est.notas && est.notas[mat.indice]) || {};
    const esResumenTaller = Boolean(mat.esResumenTallerCB);

    html += `<div class="grade-card ${esResumenTaller ? 'resumen-taller-card' : ''}">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; flex-wrap:wrap;">
        <strong style="font-size:13px; color:#1e3a8a;">${mat.nombre} ${esResumenTaller ? ' 🔧 (Promedio)' : ''}</strong>
        <span class="tag-tipo-mat ${esTal ? 'tag-tipo-taller' : 'tag-tipo-teoria'}" ${!esFam ? `title="Tocá para cambiar entre Teoría y Taller" onclick="alternarTipoMateriaTallerTeoria(${mat.indice})"` : ''}>${esTal ? '🔧 Taller' : '📘 Teoría'}</span>
      </div>
      <div class="grade-inputs-grid">`;
    SUB_CAMPOS.forEach(sc => {
      const colHoja = obtenerColumnaHojaSubCampo(mat, sc);
      const etiquetaCampo = (sc.key === "final") ? `${sc.label} (Auto)` : sc.label;
      html += `<div class="mini-field"><label>${etiquetaCampo}</label><div>${crearSelectorNotaHTML(est.filaHoja, colHoja, notasMat[sc.key], sc.tipo, sc.key, esResumenTaller, notasMat)}</div></div>`;
    });
    html += `</div></div>`;
  });

  cont.innerHTML = html;
}

let estadoGeneradorActa = {
  filaHojaAlumno: 0,         // Número de fila del alumno o "BLANCO" para plantilla vacía a mano
  tipoActa: "INASISTENCIAS", // INASISTENCIAS | INCOMPARECENCIA
  escalonForzado: "AUTO",    // AUTO | 10 | 20 | 28
  fechaActa: "",
  horaActa: "14:00",
  fechaCitacionPrevia: "",
  horaCitacionPrevia: "",
  adultoResponsable: "",
  dniAdulto: "",
  autoridades: "",
  cuerpoEditable: ""
};

function esModoActaEnBlanco() {
  return String(estadoGeneradorActa.filaHojaAlumno) === "BLANCO";
}

function inicializarValoresGeneradorActa() {
  const hoy = new Date();
  const dd = String(hoy.getDate()).padStart(2, "0");
  const mm = String(hoy.getMonth() + 1).padStart(2, "0");
  const yyyy = hoy.getFullYear();
  if (!estadoGeneradorActa.fechaActa) {
    estadoGeneradorActa.fechaActa = `${dd}/${mm}/${yyyy}`;
  }
  if (!estadoGeneradorActa.autoridades) {
    const prec = document.getElementById("asistPreceptor")?.value.trim() || "Preceptoría";
    estadoGeneradorActa.autoridades = `Equipo de Conducción, E.O.E. y Preceptor/a ${prec}`;
  }
}

function activarActaEnBlancoParaImprimir() {
  inicializarValoresGeneradorActa();
  estadoGeneradorActa.filaHojaAlumno = "BLANCO";
  regenerarTextoBaseActa();
  renderVistaActas();
  mostrarToast("📝 Modo Acta en Blanco activado (listo para imprimir y completar a mano)");
}

function prepararActaDesdeAlumno(filaHoja, tipoActa = "INASISTENCIAS", fechaCit = "", horaCit = "") {
  inicializarValoresGeneradorActa();
  estadoGeneradorActa.filaHojaAlumno = Number(filaHoja);
  estadoGeneradorActa.tipoActa = tipoActa;
  estadoGeneradorActa.escalonForzado = "AUTO";

  const est = (estado.estudiantes || []).find(e => e.filaHoja === Number(filaHoja));
  if (est) {
    estadoGeneradorActa.adultoResponsable = est.adultoResponsable || "";
    if (fechaCit) {
      estadoGeneradorActa.fechaCitacionPrevia = fechaCit;
      estadoGeneradorActa.horaCitacionPrevia = horaCit || "14:00";
    } else {
      const claveEst = normalizarClaveNombreAlumno(est.nombre);
      const ultCit = (estado.notificacionesCurso || []).find(
        n => normalizarClaveNombreAlumno(n.nombreAlumno) === claveEst && n.fechaCitacion
      );
      if (ultCit) {
        estadoGeneradorActa.fechaCitacionPrevia = ultCit.fechaCitacion;
        estadoGeneradorActa.horaCitacionPrevia = ultCit.horaCitacion || "14:00";
      } else {
        estadoGeneradorActa.fechaCitacionPrevia = estadoGeneradorActa.fechaActa;
        estadoGeneradorActa.horaCitacionPrevia = "13:30";
      }
    }
  }

  regenerarTextoBaseActa();
  mostrarVista("actas");
}

function determinarEscalonInasistencias(totFaltas) {
  if (estadoGeneradorActa.escalonForzado !== "AUTO") {
    return Number(estadoGeneradorActa.escalonForzado);
  }
  if (esModoActaEnBlanco()) return 10;
  if (totFaltas >= 28) return 28;
  if (totFaltas >= 20) return 20;
  return 10;
}

function regenerarTextoBaseActa() {
  inicializarValoresGeneradorActa();

  // 1. MODO PLANTILLA EN BLANCO (PARA COMPLETAR A MANO EN CUALQUIER CURSO O ESTUDIANTE)
  if (esModoActaEnBlanco()) {
    const escalonBlanco = determinarEscalonInasistencias(0);

    if (estadoGeneradorActa.tipoActa === "INCOMPARECENCIA") {
      estadoGeneradorActa.cuerpoEditable =
        `En la ciudad de San Fernando, a los ______ días del mes de ________________ de 202___, siendo las ____:____ hs., reunidos en la sede de la E.E.S.T. N° 2, las autoridades intervinientes: ________________________________________________________________________, se procede a labrar la presente ACTA DE INCOMPARECENCIA en el marco del Decreto N° 2299/11 y la Resolución N° 1650/24.\n\n` +
        `MOTIVO: Dejar constancia formal de la incomparecencia del adulto responsable a la citación cursada por el registro de inasistencias acumuladas del/de la estudiante.\n\n` +
        `DESARROLLO: En el día de la fecha, se deja constancia de que el/la Sr./Sra. ________________________________________, adulto responsable del/de la estudiante ________________________________________ (DNI N° ____________________) de ______ Año ______ División (Grupo ________), no se ha presentado en el establecimiento. Se verifica que la familia había sido debidamente notificada de esta reunión a través del Cuaderno de Comunicados enviado con fecha ____/____/202___, registrando a la fecha un total de ________ inasistencias institucionales.\n\n` +
        `CONCLUSIONES Y ACUERDOS INSTITUCIONALES:\n` +
        `1. Se labra la presente acta para respaldar el accionar institucional y se archiva en el Legajo del estudiante.\n` +
        `2. Se procede a realizar una nueva citación formal a la familia mediante el Cuaderno de Comunicados para garantizar la firma del compromiso de asistencia a clases, dando intervención al Equipo de Orientación Escolar (E.O.E.).\n\n` +
        `Sin más temas que tratar, se da por finalizada el acta a las ____:____ hs. Se labran dos (2) ejemplares de un mismo tenor, firmas y aclaración de las mismas.`;
      return;
    }

    if (escalonBlanco === 10 || escalonBlanco === 20) {
      const txtUmbral = estadoGeneradorActa.escalonForzado === "AUTO"
        ? "______ (10 / 20)"
        : String(escalonBlanco);
      estadoGeneradorActa.cuerpoEditable =
        `En la ciudad de San Fernando, a los ______ días del mes de ________________ de 202___, siendo las ____:____ hs., reunidos en la sede de la E.E.S.T. N° 2, las autoridades intervinientes: ________________________________________________________________________, y el/la Sr./Sra. ________________________________________ (DNI N° ____________________), adulto responsable del/de la estudiante ________________________________________ de ______ Año ______ División (Grupo ________), se procede a labrar la presente Acta en el marco del Decreto N° 2299/11 y la Resolución N° 1650/24.\n\n` +
        `MOTIVO: Notificación por haber alcanzado las ${txtUmbral} inasistencias acumuladas y firma del compromiso de asistencia a clases.\n\n` +
        `DESARROLLO: En el día de la fecha se hace presente el adulto responsable en respuesta a la citación enviada a través del Cuaderno de Comunicados. Se informa a la familia que el/la estudiante registra a la fecha un total de ________ inasistencias institucionales. Cedida la palabra al familiar, manifiesta que:\n` +
        `________________________________________________________________________________________________________________________\n` +
        `________________________________________________________________________________________________________________________\n` +
        `________________________________________________________________________________________________________________________\n` +
        `Se deja constancia de que toda documentación entregada por la familia se incorpora al Legajo del estudiante.\n\n` +
        `CONCLUSIONES Y ACUERDOS INSTITUCIONALES:\n` +
        `1. El adulto responsable se notifica de las inasistencias registradas y se compromete a garantizar la asistencia regular y puntual del/de la estudiante a clases, recordando que el límite anual es de 28 inasistencias.\n` +
        `2. La familia se compromete a mantener comunicación mediante el Cuaderno de Comunicados y presentar en Preceptoría las constancias correspondientes en caso de inasistencia.\n` +
        `3. Observaciones: ______________________________________________________________________________________________________\n\n` +
        `Sin más temas que tratar, se da por finalizada el acta a las ____:____ hs. Se labran dos (2) ejemplares de un mismo tenor, firmas y aclaración de las mismas.`;
      return;
    }

    // Plantilla en blanco para 28 inasistencias (75% por materia)
    estadoGeneradorActa.cuerpoEditable =
      `En la ciudad de San Fernando, a los ______ días del mes de ________________ de 202___, siendo las ____:____ hs., reunidos en la sede de la E.E.S.T. N° 2, las autoridades intervinientes: ________________________________________________________________________, y el/la Sr./Sra. ________________________________________ (DNI N° ____________________), adulto responsable del/de la estudiante ________________________________________ de ______ Año ______ División (Grupo ________), se procede a labrar la presente Acta en el marco del Decreto N° 2299/11 y la Resolución N° 1650/24.\n\n` +
      `MOTIVO: Notificación por haber alcanzado el límite de 28 inasistencias institucionales (Total registrado: ________) y aplicación del 75% de asistencia por materia.\n\n` +
      `DESARROLLO: En el día de la fecha se hace presente el adulto responsable en respuesta a la citación enviada a través del Cuaderno de Comunicados. Se informa a la familia que el/la estudiante continúa como alumno/a regular, pero al haber alcanzado las 28 inasistencias pasa a contabilizarse el 75% de asistencia sobre las clases efectivamente dictadas en cada materia. En aquellas materias donde no alcance el 75% de asistencia, deberá concurrir a las instancias de intensificación correspondientes. Cedida la palabra al familiar, manifiesta que:\n` +
      `________________________________________________________________________________________________________________________\n` +
      `________________________________________________________________________________________________________________________\n\n` +
      `MATERIAS OBSERVADAS / ESTADO DE ASISTENCIA POR MATERIA:\n` +
      `________________________________________________________________________________________________________________________\n` +
      `________________________________________________________________________________________________________________________\n\n` +
      `CONCLUSIONES Y ACUERDOS INSTITUCIONALES:\n` +
      `1. Se acuerda un Plan de Continuidad Pedagógica Personalizado con seguimiento de Preceptoría y del Equipo de Orientación Escolar (E.O.E.).\n` +
      `2. La familia se notifica mediante la presente acta y el Cuaderno de Comunicados, comprometiéndose a sostener la asistencia del/de la estudiante durante el resto del ciclo lectivo.\n\n` +
      `Sin más temas que tratar, se da por finalizada el acta a las ____:____ hs. Se labran dos (2) ejemplares de un mismo tenor, firmas y aclaración de las mismas.`;
    return;
  }

  // 2. MODO AUTOMÁTICO CON DATOS DEL ESTUDIANTE SELECCIONADO
  const listaEst = estado.estudiantes || [];
  let est = listaEst.find(e => e.filaHoja === Number(estadoGeneradorActa.filaHojaAlumno));
  if (!est && listaEst.length > 0) {
    est = listaEst[0];
    estadoGeneradorActa.filaHojaAlumno = est.filaHoja;
  }
  if (!est) return;

  const cursoLimpio = (estado.cursoActual || "").replace(/_/g, " ");
  const totFaltas = (est.inasistencias && est.inasistencias.total) || 0;
  const adulto = estadoGeneradorActa.adultoResponsable || est.adultoResponsable || "___________________________";
  const dniAlu = est.dni || "___________";
  const resumenMeses = obtenerResumenMensualAbreviado(est) || "Sin detalle mensual";

  if (estadoGeneradorActa.tipoActa === "INCOMPARECENCIA") {
    const fCit = estadoGeneradorActa.fechaCitacionPrevia || estadoGeneradorActa.fechaActa;
    const hCit = estadoGeneradorActa.horaCitacionPrevia || "14:00";
    estadoGeneradorActa.cuerpoEditable =
      `En la ciudad de San Fernando, a los ${estadoGeneradorActa.fechaActa}, siendo las ${estadoGeneradorActa.horaActa} hs., reunidos en la sede de la E.E.S.T. N° 2, las autoridades intervinientes (${estadoGeneradorActa.autoridades}), se procede a labrar la presente ACTA DE INCOMPARECENCIA en el marco del Decreto N° 2299/11 y la Resolución N° 1650/24.\n\n` +
      `MOTIVO: Dejar constancia formal de la incomparecencia del adulto responsable a la citación cursada por el registro de inasistencias acumuladas del/de la estudiante.\n\n` +
      `DESARROLLO: En el día de la fecha, se deja constancia de que el/la Sr./Sra. ${adulto}, adulto responsable del/de la estudiante ${est.nombre} (DNI N° ${dniAlu}) de ${cursoLimpio} (${est.grupo}), no se ha presentado en el establecimiento a la reunión citada para el día ${fCit} a las ${hCit} hs. Se verifica que la familia había sido debidamente notificada de esta reunión a través del Cuaderno de Comunicados, registrando a la fecha un total de ${totFaltas} inasistencias institucionales.\n\n` +
      `CONCLUSIONES Y ACUERDOS INSTITUCIONALES:\n` +
      `1. Se labra la presente acta para respaldar el accionar institucional y se archiva en el Legajo del estudiante.\n` +
      `2. Se procede a realizar una nueva citación formal a la familia mediante el Cuaderno de Comunicados para garantizar la firma del compromiso de asistencia a clases, dando intervención al Equipo de Orientación Escolar (E.O.E.).\n\n` +
      `Sin más temas que tratar, se da por finalizada el acta en el lugar y fecha indicados. Se labran dos (2) ejemplares de un mismo tenor, firmas y aclaración de las mismas.`;
    return;
  }

  // ACTA DE NOTIFICACIÓN DE INASISTENCIAS ACUMULADAS (10, 20 y 28)
  const escalon = determinarEscalonInasistencias(totFaltas);
  if (escalon === 10 || escalon === 20) {
    estadoGeneradorActa.cuerpoEditable =
      `En la ciudad de San Fernando, a los ${estadoGeneradorActa.fechaActa}, siendo las ${estadoGeneradorActa.horaActa} hs., reunidos en la sede de la E.E.S.T. N° 2, las autoridades intervinientes (${estadoGeneradorActa.autoridades}) y el/la Sr./Sra. ${adulto}, adulto responsable del/de la estudiante ${est.nombre} (DNI N° ${dniAlu}) de ${cursoLimpio} (${est.grupo}), se procede a labrar la presente Acta en el marco del Decreto N° 2299/11 y la Resolución N° 1650/24.\n\n` +
      `MOTIVO: Notificación por haber alcanzado las ${escalon} inasistencias acumuladas y firma del compromiso de asistencia a clases.\n\n` +
      `DESARROLLO: En el día de la fecha se hace presente el adulto responsable en respuesta a la citación enviada a través del Cuaderno de Comunicados. Se informa a la familia que el/la estudiante registra a la fecha un total de ${totFaltas} inasistencias institucionales acumuladas (Detalle por mes: ${resumenMeses}). Se conversa sobre los motivos de las ausencias y se recuerda la importancia de sostener la asistencia regular tanto en Teoría como en Taller, teniendo en cuenta que el límite anual es de 28 inasistencias. Toda constancia o documentación entregada por la familia se incorpora al Legajo del estudiante.\n\n` +
      `CONCLUSIONES Y ACUERDOS INSTITUCIONALES:\n` +
      `1. El adulto responsable se notifica de las inasistencias registradas y se compromete a garantizar la asistencia regular y puntual del/de la estudiante a clases.\n` +
      `2. La familia se compromete a mantener comunicación mediante el Cuaderno de Comunicados y presentar en Preceptoría las constancias correspondientes en caso de inasistencia.\n` +
      `3. Se realizará el seguimiento de asistencia desde Preceptoría y el Equipo de Orientación Escolar (E.O.E.).\n\n` +
      `Sin más temas que tratar, se da por finalizada el acta en el lugar y fecha indicados. Se labran dos (2) ejemplares de un mismo tenor, firmas y aclaración de las mismas.`;
  } else {
    // Escalón 28 inasistencias: Rige el 75% de asistencia por materia sobre clases efectivamente dictadas
    const resumen75 = calcularAsistenciaPorMateriaEstudiante(est);
    const lineasMat = resumen75.map(r =>
      `• ${r.nombre}: ${r.asistidasEfectivas}/${r.clasesDictadas} clases asistidas (${r.porcentaje}%) — ${r.enRegla75 ? 'Cumple >=75%' : 'Debe intensificar (<75%)'}`
    ).join("\n");

    estadoGeneradorActa.cuerpoEditable =
      `En la ciudad de San Fernando, a los ${estadoGeneradorActa.fechaActa}, siendo las ${estadoGeneradorActa.horaActa} hs., reunidos en la sede de la E.E.S.T. N° 2, las autoridades intervinientes (${estadoGeneradorActa.autoridades}) y el/la Sr./Sra. ${adulto}, adulto responsable del/de la estudiante ${est.nombre} (DNI N° ${dniAlu}) de ${cursoLimpio} (${est.grupo}), se procede a labrar la presente Acta en el marco del Decreto N° 2299/11 y la Resolución N° 1650/24.\n\n` +
      `MOTIVO: Notificación por haber alcanzado el límite de 28 inasistencias institucionales (Total registrado: ${totFaltas}) y aplicación del 75% de asistencia por materia.\n\n` +
      `DESARROLLO: En el día de la fecha se hace presente el adulto responsable en respuesta a la citación enviada a través del Cuaderno de Comunicados. Se informa a la familia que, al haber alcanzado el límite de 28 inasistencias anuales, el/la estudiante continúa como alumno/a regular debiendo asistir normalmente a clases, pero a partir de esta instancia pasa a contabilizarse el 75% de asistencia sobre las clases efectivamente dictadas en cada materia. En aquellas materias donde no alcance el 75% de asistencia, deberá concurrir a las instancias de intensificación correspondientes.\n\n` +
      `REGISTRO ACTUAL DE ASISTENCIA POR MATERIA:\n${lineasMat || 'Sin partes registrados.'}\n\n` +
      `CONCLUSIONES Y ACUERDOS INSTITUCIONALES:\n` +
      `1. Se acuerda un Plan de Continuidad Pedagógica Personalizado con seguimiento de Preceptoría y del Equipo de Orientación Escolar (E.O.E.).\n` +
      `2. La familia se notifica mediante la presente acta y a través del Cuaderno de Comunicados de las materias que requieren recuperar asistencia, comprometiéndose a sostener la concurrencia del/de la estudiante durante el resto del ciclo lectivo.\n\n` +
      `Sin más temas que tratar, se da por finalizada el acta en el lugar y fecha indicados. Se labran dos (2) ejemplares de un mismo tenor, firmas y aclaración de las mismas.`;
  }
}

function alCambiarSelectorAlumnoActa(nuevoValor) {
  if (nuevoValor === "BLANCO") {
    estadoGeneradorActa.filaHojaAlumno = "BLANCO";
    estadoGeneradorActa.adultoResponsable = "";
  } else {
    estadoGeneradorActa.filaHojaAlumno = Number(nuevoValor);
    const est = (estado.estudiantes || []).find(e => e.filaHoja === Number(nuevoValor));
    if (est) {
      estadoGeneradorActa.adultoResponsable = est.adultoResponsable || "";
    }
  }
  regenerarTextoBaseActa();
  renderVistaActas();
}

function alCambiarTipoOEscalonActa() {
  estadoGeneradorActa.tipoActa = document.getElementById("actaSelectTipo")?.value || "INASISTENCIAS";
  estadoGeneradorActa.escalonForzado = document.getElementById("actaSelectEscalon")?.value || "AUTO";
  regenerarTextoBaseActa();
  renderVistaActas();
}

function sincronizarCamposActaDesdeDOM() {
  estadoGeneradorActa.fechaActa = document.getElementById("actaInputFecha")?.value.trim() || estadoGeneradorActa.fechaActa;
  estadoGeneradorActa.horaActa = document.getElementById("actaInputHora")?.value.trim() || estadoGeneradorActa.horaActa;
  estadoGeneradorActa.adultoResponsable = document.getElementById("actaInputAdulto")?.value.trim() || "";
  estadoGeneradorActa.autoridades = document.getElementById("actaInputAutoridades")?.value.trim() || "";
  estadoGeneradorActa.cuerpoEditable = document.getElementById("actaTextareaCuerpo")?.value || "";

  const preview = document.getElementById("actaPreviewSheetContainer");
  if (preview) preview.innerHTML = construirDocumentoActaOficialHTML();
}

function construirDocumentoActaOficialHTML() {
  const enBlanco = esModoActaEnBlanco();
  const est = !enBlanco
    ? ((estado.estudiantes || []).find(e => e.filaHoja === Number(estadoGeneradorActa.filaHojaAlumno)) || (estado.estudiantes || [])[0])
    : null;

  const cursoLimpio = enBlanco ? "____________________" : (estado.cursoActual || "").replace(/_/g, " ");
  const totFaltas = (!enBlanco && est && est.inasistencias) ? est.inasistencias.total : "________";
  const escalon = determinarEscalonInasistencias(Number(totFaltas) || 0);

  let tituloActa = "";
  if (estadoGeneradorActa.tipoActa === "INCOMPARECENCIA") {
    tituloActa = "ACTA DE INCOMPARECENCIA DE ADULTO RESPONSABLE";
  } else if (enBlanco && estadoGeneradorActa.escalonForzado === "AUTO") {
    tituloActa = "ACTA DE NOTIFICACIÓN DE INASISTENCIAS ACUMULADAS";
  } else {
    tituloActa = `ACTA DE NOTIFICACIÓN DE INASISTENCIAS ACUMULADAS (${escalon === 28 ? '28 INASISTENCIAS — RIGE 75% POR MATERIA' : escalon + ' INASISTENCIAS'})`;
  }

  const fechaMostrar = enBlanco ? "____/____/202___" : estadoGeneradorActa.fechaActa;
  const horaMostrar = enBlanco ? "____:____" : estadoGeneradorActa.horaActa;

  const tiraEstudianteHTML = enBlanco
    ? `
      <div style="border:1px solid #000; padding:8px 10px; margin-bottom:14px; font-size:12px; background:#f8fafc; line-height:1.8;">
        <strong>ESTUDIANTE:</strong> ________________________________________________ &nbsp;|&nbsp;
        <strong>DNI N°:</strong> ________________________<br>
        <strong>CURSO / GRUPO:</strong> ________________________ &nbsp;|&nbsp;
        <strong>INASISTENCIAS ACUMULADAS:</strong> ____________ &nbsp;|&nbsp;
        <strong>ACTA N°:</strong> ________
      </div>
    `
    : `
      <div style="border:1px solid #000; padding:6px 10px; margin-bottom:12px; font-size:12px; background:#f8fafc;">
        <strong>ESTUDIANTE:</strong> ${est ? (est.orden + '. ' + est.nombre) : ''} &nbsp;|&nbsp;
        <strong>DNI:</strong> ${(est && est.dni) ? est.dni : "___________"} &nbsp;|&nbsp;
        <strong>CURSO / GRUPO:</strong> ${cursoLimpio} (${(est && est.grupo) ? est.grupo : "-"}) &nbsp;|&nbsp;
        <strong>INASISTENCIAS ACUMULADAS:</strong> ${totFaltas}
      </div>
    `;

  // BLOQUE DE FIRMAS SEGÚN TIPO DE ACTA (SIN FIRMA DEL ESTUDIANTE EN NINGÚN CASO)
  let firmasHTML = "";
  if (estadoGeneradorActa.tipoActa === "INCOMPARECENCIA") {
    // En Incomparecencia el adulto responsable no asistió: solo firman las autoridades de la institución
    firmasHTML = `
      <div class="acta-sign-grid" style="grid-template-columns: repeat(2, 1fr);">
        <div>
          <div class="acta-sign-line">
            Firma y Aclaración — Preceptor/a Interviniente<br>
            <small>E.E.S.T. N° 2 San Fernando</small>
          </div>
        </div>
        <div>
          <div class="acta-sign-line">
            Firma y Aclaración — Equipo Directivo / Jefe de Preceptores / E.O.E.<br>
            <small>E.E.S.T. N° 2 San Fernando</small>
          </div>
        </div>
      </div>
    `;
  } else {
    // En Notificación de Inasistencias firman el Adulto Responsable y las Autoridades (sin firma del alumno)
    const aclaracionAdulto = enBlanco
      ? "Aclaración y DNI N°: ___________________________"
      : (estadoGeneradorActa.adultoResponsable ? `${estadoGeneradorActa.adultoResponsable} — DNI: _______________` : "Aclaración y DNI N°: ___________________________");

    firmasHTML = `
      <div class="acta-sign-grid" style="grid-template-columns: repeat(3, 1fr);">
        <div>
          <div class="acta-sign-line">
            Firma del Adulto Responsable<br>
            <small>${aclaracionAdulto}</small>
          </div>
        </div>
        <div>
          <div class="acta-sign-line">
            Firma y Aclaración — Preceptor/a<br>
            <small>E.E.S.T. N° 2 San Fernando</small>
          </div>
        </div>
        <div>
          <div class="acta-sign-line">
            Firma y Aclaración — Equipo Directivo / E.O.E.<br>
            <small>E.E.S.T. N° 2 San Fernando</small>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="acta-preview-sheet">
      <div class="acta-header-oficial">
        <div>
          <div style="font-size:14px; font-weight:bold; text-transform:uppercase;">Dirección General de Cultura y Educación — Provincia de Buenos Aires</div>
          <div style="font-size:15px; font-weight:900;">E.E.S.T. N° 2 "Pbro. Dr. Manuel de San Ginés" — Distrito San Fernando</div>
          <div style="font-size:11.5px;">Estados Administrativos Escolares — Registro de Actas Institucionales</div>
        </div>
        <div style="text-align:right; font-size:12px; font-weight:bold;">
          Fecha: ${fechaMostrar}<br>
          Hora: ${horaMostrar} hs.<br>
          Curso: ${cursoLimpio}
        </div>
      </div>

      <h3 style="text-align:center; font-size:14px; text-decoration:underline; margin:10px 0 14px 0; text-transform:uppercase;">
        ${tituloActa}
      </h3>

      ${tiraEstudianteHTML}

      <div style="white-space:pre-wrap; text-align:justify; font-size:12.5px; line-height:1.6;">${estadoGeneradorActa.cuerpoEditable}</div>

      ${firmasHTML}
    </div>
  `;
}

function renderVistaActas() {
  const cont = document.getElementById("contenedorGeneradorActas");
  const contHist = document.getElementById("tablaHistorialActasCurso");
  if (!cont) return;

  inicializarValoresGeneradorActa();
  const listaEst = estado.estudiantes || [];

  if (!esModoActaEnBlanco()) {
    if (listaEst.length === 0) {
      estadoGeneradorActa.filaHojaAlumno = "BLANCO";
      regenerarTextoBaseActa();
    } else if (!estadoGeneradorActa.filaHojaAlumno || !listaEst.some(e => e.filaHoja === Number(estadoGeneradorActa.filaHojaAlumno))) {
      estadoGeneradorActa.filaHojaAlumno = listaEst[0].filaHoja;
      estadoGeneradorActa.adultoResponsable = listaEst[0].adultoResponsable || "";
      regenerarTextoBaseActa();
    } else if (!estadoGeneradorActa.cuerpoEditable) {
      regenerarTextoBaseActa();
    }
  } else if (!estadoGeneradorActa.cuerpoEditable) {
    regenerarTextoBaseActa();
  }

  const enBlanco = esModoActaEnBlanco();
  const estActual = !enBlanco
    ? (listaEst.find(e => e.filaHoja === Number(estadoGeneradorActa.filaHojaAlumno)) || listaEst[0])
    : null;
  const totFaltas = (estActual && estActual.inasistencias) ? (estActual.inasistencias.total || 0) : 0;

  let optsAlumnos = `<option value="BLANCO" ${enBlanco ? 'selected' : ''}>📝 ACTA EN BLANCO (Para completar a mano — Cualquier curso/alumno)</option>`;
  listaEst.forEach(e => {
    const f = (e.inasistencias && e.inasistencias.total) || 0;
    const sel = (!enBlanco && estActual && e.filaHoja === estActual.filaHoja) ? "selected" : "";
    optsAlumnos += `<option value="${e.filaHoja}" ${sel}>${e.orden}. ${e.nombre} (Acum: ${f} faltas)</option>`;
  });

  cont.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px; background:#eff6ff; border:1px solid #bfdbfe; padding:10px 12px; border-radius:8px;">
      <div style="font-size:12.5px; color:#1e3a8a; font-weight:700;">
        Seleccioná un estudiante o usá el formato en blanco para completar a mano.
      </div>
      <button type="button" class="btn-outline" style="border-color:#1e3a8a; color:#1e3a8a;" onclick="activarActaEnBlancoParaImprimir()">
        📝 Poner Acta en Blanco (Para llenar a mano)
      </button>
    </div>

    <div class="form-grid" style="background:#f8fafc; padding:12px; border:1px solid #cbd5e1; border-radius:8px; margin-bottom:12px;">
      <div class="form-group">
        <label>Estudiante o Formato en Blanco</label>
        <select id="actaSelectAlumno" onchange="alCambiarSelectorAlumnoActa(this.value)">${optsAlumnos}</select>
      </div>
      <div class="form-group">
        <label>Tipo de Acta Institucional</label>
        <select id="actaSelectTipo" onchange="alCambiarTipoOEscalonActa()">
          <option value="INASISTENCIAS" ${estadoGeneradorActa.tipoActa === "INASISTENCIAS" ? "selected" : ""}>📊 Acta de Notificación de Inasistencias Acumuladas</option>
          <option value="INCOMPARECENCIA" ${estadoGeneradorActa.tipoActa === "INCOMPARECENCIA" ? "selected" : ""}>🚫 Acta de Incomparecencia (Familiar citado no asiste)</option>
        </select>
      </div>
      <div class="form-group" style="${estadoGeneradorActa.tipoActa === 'INCOMPARECENCIA' ? 'display:none;' : ''}">
        <label>Escalón Normativo (Res. 1650/24)</label>
        <select id="actaSelectEscalon" onchange="alCambiarTipoOEscalonActa()">
          <option value="AUTO" ${estadoGeneradorActa.escalonForzado === "AUTO" ? "selected" : ""}>${enBlanco ? 'Genérico 10 / 20 Inasistencias (A completar)' : `Automático según faltas (${totFaltas} -> Escalón ${determinarEscalonInasistencias(totFaltas)})`}</option>
          <option value="10" ${estadoGeneradorActa.escalonForzado === "10" ? "selected" : ""}>1° Citación: 10 Inasistencias</option>
          <option value="20" ${estadoGeneradorActa.escalonForzado === "20" ? "selected" : ""}>2° Citación: 20 Inasistencias</option>
          <option value="28" ${estadoGeneradorActa.escalonForzado === "28" ? "selected" : ""}>3° Citación: 28 Inasistencias (75% por materia)</option>
        </select>
      </div>
      <div class="form-group">
        <label>Fecha del Acta</label>
        <input type="text" id="actaInputFecha" value="${estadoGeneradorActa.fechaActa}" ${enBlanco ? 'disabled title="En modo en blanco se imprime con línea para escribir a mano"' : ''} oninput="sincronizarCamposActaDesdeDOM()">
      </div>
      <div class="form-group">
        <label>Hora</label>
        <input type="text" id="actaInputHora" value="${estadoGeneradorActa.horaActa}" ${enBlanco ? 'disabled title="En modo en blanco se imprime con línea para escribir a mano"' : ''} oninput="sincronizarCamposActaDesdeDOM()">
      </div>
      <div class="form-group">
        <label>Adulto Responsable (Citado / Presente)</label>
        <input type="text" id="actaInputAdulto" value="${estadoGeneradorActa.adultoResponsable || ''}" placeholder="Apellido y Nombre del Familiar" ${enBlanco ? 'disabled' : ''} oninput="sincronizarCamposActaDesdeDOM()">
      </div>
      <div class="form-group" style="grid-column: 1 / -1;">
        <label>Autoridades Presentes / Intervinientes</label>
        <input type="text" id="actaInputAutoridades" value="${estadoGeneradorActa.autoridades}" oninput="sincronizarCamposActaDesdeDOM()">
      </div>
      <div class="form-group" style="grid-column: 1 / -1;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <label>Texto del Acta (Podés editar o agregar observaciones antes de imprimir y guardar)</label>
          <button type="button" class="btn-outline" style="padding:3px 8px; font-size:11px;" onclick="regenerarTextoBaseActa(); renderVistaActas();">🔄 Restaurar redacción automática</button>
        </div>
        <textarea id="actaTextareaCuerpo" rows="9" oninput="sincronizarCamposActaDesdeDOM()">${estadoGeneradorActa.cuerpoEditable}</textarea>
      </div>
    </div>

    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
      <button type="button" class="btn-main btn-print-blue" style="flex:1;" onclick="imprimirActaActualA4()">
        🖨️ Imprimir Acta Oficial A4 / Guardar PDF
      </button>
      ${!enBlanco ? `
      <button type="button" class="btn-main btn-w4b" style="flex:1;" onclick="guardarActaActualEnSheet()">
        💾 Registrar Acta en Google Sheets (Libro Digital)
      </button>` : ''}
    </div>

    <div id="actaPreviewSheetContainer">${construirDocumentoActaOficialHTML()}</div>
  `;

  if (contHist) {
    const listaActas = estado.actasCurso || [];
    if (listaActas.length === 0) {
      contHist.innerHTML = `<p style="padding:10px; color:#64748b;">Aún no hay actas registradas en este curso.</p>`;
    } else {
      let h = `<table class="app-table"><thead><tr><th>Fecha</th><th>Estudiante</th><th>Tipo de Acta</th><th>Faltas</th><th>Adulto Responsable</th><th>Labrada Por</th><th>Acciones</th></tr></thead><tbody>`;
      listaActas.forEach((ac, idx) => {
        h += `
          <tr>
            <td><strong>${ac.fecha}</strong> <small>${ac.hora}</small></td>
            <td class="td-left">${ac.ordenAlumno}. ${ac.nombreAlumno}</td>
            <td><span class="badge badge-grp">${ac.tipoActa} (${ac.escalon})</span></td>
            <td><strong>${ac.totalFaltas}</strong></td>
            <td>${ac.adultoResponsable || "-"}</td>
            <td>${ac.labradaPor || "-"}</td>
            <td>
              <button type="button" class="btn-outline" style="padding:3px 7px; font-size:11px;" onclick="cargarActaGuardadaDesdeHistorial(${idx})">👁️ Ver / Imprimir</button>
              <button type="button" class="btn-danger-outline" style="padding:3px 7px; font-size:11px;" onclick="eliminarActaGuardadaUI('${ac.id}')">🗑️</button>
            </td>
          </tr>
        `;
      });
      h += `</tbody></table>`;
      contHist.innerHTML = h;
    }
  }
}

function imprimirActaActualA4() {
  sincronizarCamposActaDesdeDOM();
  const root = document.getElementById("printActasRoot");
  if (!root) return;
  root.innerHTML = construirDocumentoActaOficialHTML();
  document.body.classList.remove("print-mode-comunicado");
  document.body.classList.add("print-mode-acta");
  window.print();
  setTimeout(() => document.body.classList.remove("print-mode-acta"), 600);
}

async function guardarActaActualEnSheet() {
  if (esModoActaEnBlanco()) {
    mostrarToast("ℹ️ El acta en blanco es para imprimir y llenar a mano.");
    return;
  }
  sincronizarCamposActaDesdeDOM();
  const est = (estado.estudiantes || []).find(e => e.filaHoja === Number(estadoGeneradorActa.filaHojaAlumno));
  if (!est) return;

  const totFaltas = (est.inasistencias && est.inasistencias.total) || 0;
  const escalon = estadoGeneradorActa.tipoActa === "INCOMPARECENCIA"
    ? "INCOMPARECENCIA"
    : `UMBRAL_${determinarEscalonInasistencias(totFaltas)}`;

  try {
    mostrarToast("⏳ Guardando acta en Registro_Actas...");
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "guardarActa",
        curso: estado.cursoActual,
        acta: {
          fecha: estadoGeneradorActa.fechaActa,
          hora: estadoGeneradorActa.horaActa,
          ordenAlumno: est.orden,
          nombreAlumno: est.nombre,
          dniAlumno: est.dni || "",
          tipoActa: estadoGeneradorActa.tipoActa,
          escalon: escalon,
          totalFaltas: totFaltas,
          adultoResponsable: estadoGeneradorActa.adultoResponsable,
          autoridades: estadoGeneradorActa.autoridades,
          cuerpoTexto: estadoGeneradorActa.cuerpoEditable
        }
      })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);

    aplicarDatosRecibidos(json.data, true);
    mostrarToast("✅ Acta registrada en Google Sheets");
  } catch (err) {
    mostrarToast("⚠️ Error: " + err.message, 4000);
  }
}

function cargarActaGuardadaDesdeHistorial(idx) {
  const ac = (estado.actasCurso || [])[idx];
  if (!ac) return;
  const est = (estado.estudiantes || []).find(
    e => normalizarClaveNombreAlumno(e.nombre) === normalizarClaveNombreAlumno(ac.nombreAlumno)
  );
  if (est) estadoGeneradorActa.filaHojaAlumno = est.filaHoja;
  estadoGeneradorActa.tipoActa = ac.tipoActa || "INASISTENCIAS";
  estadoGeneradorActa.fechaActa = ac.fecha || estadoGeneradorActa.fechaActa;
  estadoGeneradorActa.horaActa = ac.hora || "14:00";
  estadoGeneradorActa.adultoResponsable = ac.adultoResponsable || "";
  estadoGeneradorActa.autoridades = ac.autoridades || "";
  estadoGeneradorActa.cuerpoEditable = ac.cuerpoTexto || "";

  renderVistaActas();
  window.scrollTo({ top: 0, behavior: "smooth" });
  mostrarToast("📄 Acta cargada en el editor");
}

async function eliminarActaGuardadaUI(idActa) {
  if (!confirm("¿Eliminar este registro de acta del historial?")) return;
  try {
    const resp = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        accion: "eliminarActa",
        curso: estado.cursoActual,
        idActa: idActa
      })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);
    aplicarDatosRecibidos(json.data, true);
    mostrarToast("🗑️ Acta eliminada");
  } catch (err) {
    mostrarToast("⚠️ Error: " + err.message, 4000);
  }
}

function renderTablaCompleta() {
  const cont = document.getElementById("contenedorTablaCompleta");
  if (!cont) return;
  const mostrarTachados = document.getElementById("chkMostrarTachadosPlanilla")?.checked;
  const mats = obtenerMateriasOrdenadasVisualmente();

  let html = construirBannerMigracionDicFebHTML() + `<table class="app-table"><thead><tr>
    <th rowspan="2">Ord</th><th rowspan="2">Estudiante</th><th rowspan="2">Grp</th><th rowspan="2">Acción</th>`;
  mats.forEach(m => {
    const esTal = esMateriaDeTaller(m);
    const bgHeader = esTal ? "background:#e8f0fe; color:#0d47a1;" : "background:#f1f5f9; color:#1e293b;";
    html += `<th colspan="8" style="${bgHeader}">${esTal ? '🔧 ' : '📘 '}${m.nombre}</th>`;
  });
  html += `</tr><tr>`;
  mats.forEach(() => { html += `<th>1°V</th><th>1°C</th><th>2°V</th><th>2°C</th><th>Int1</th><th>Dic</th><th>Feb</th><th>Fin</th>`; });
  html += `</tr></thead><tbody>`;

  (estado.estudiantes || []).forEach(est => {
    const tachado = esEstudianteTachado(est);
    if (tachado && !mostrarTachados) return;

    html += `<tr class="${tachado ? 'fila-tachada' : ''}">
      <td style="cursor:pointer; font-weight:800; color:#1e3a8a; text-decoration:underline;" title="Tocá para cambiar el N° de Orden" onclick="editarDatosEstudiante(${est.filaHoja})">${est.orden}</td>
      <td class="td-left">${est.nombre}</td>
      <td>${est.grupo}</td>
      <td>
        <div style="display:flex; gap:3px; justify-content:center;">
          <button type="button" class="btn-outline" style="padding:2px 5px; font-size:10px;" title="Editar Orden / Nombre / Grupo" onclick="editarDatosEstudiante(${est.filaHoja})">✏️</button>
          <button type="button" class="${tachado ? 'btn-success-outline' : 'btn-danger-outline'}" style="padding:2px 5px; font-size:10px;" onclick="alternarEstadoTachado(${est.filaHoja})">${tachado ? '✅' : '🚫'}</button>
        </div>
      </td>`;

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

const colaGuardadoCeldas = [];
let procesandoColaCeldas = false;

window.addEventListener("beforeunload", (e) => {
  if (procesandoColaCeldas || colaGuardadoCeldas.length > 0) {
    e.preventDefault();
    e.returnValue = "";
  }
});

function guardarCeldaRemota(filaHoja, columnaHoja, selectElem) {
  if (typeof esRolFamiliaActual === "function" && esRolFamiliaActual()) return;
  const val = selectElem.value;
  const cursoTarea = estado.cursoActual;
  const numFila = Number(filaHoja);
  const numCol = Number(columnaHoja);

  selectElem.className = obtenerClaseColorNota(val);

  const aluLocal = (estado.estudiantes || []).find(e => e.filaHoja === numFila);
  let matTocada = null;
  let scTocado = null;

  if (aluLocal && aluLocal.notas) {
    (estado.materias || []).forEach(m => {
      SUB_CAMPOS.forEach(sc => {
        if (obtenerColumnaHojaSubCampo(m, sc) === numCol) {
          if (!aluLocal.notas[m.indice]) aluLocal.notas[m.indice] = {};
          aluLocal.notas[m.indice][sc.key] = val;
          matTocada = m;
          scTocado = sc;
        }
      });
    });

    if (matTocada && scTocado) {
      recalcularNotasEstudianteLocal(aluLocal, matTocada, scTocado.key);
    }

    renderVistaMateria();
    renderVistaAlumno();
    renderTablaCompleta();
  }

  // Si ya hay un cambio pendiente en cola para esta misma celda, actualizamos su valor
  const idxExistente = colaGuardadoCeldas.findIndex(
    t => t.curso === cursoTarea && t.filaHoja === numFila && t.columnaHoja === numCol
  );
  if (idxExistente !== -1) {
    colaGuardadoCeldas[idxExistente].valor = val;
  } else {
    colaGuardadoCeldas.push({
      curso: cursoTarea,
      filaHoja: numFila,
      columnaHoja: numCol,
      valor: val
    });
  }

  const pendientes = colaGuardadoCeldas.length + (procesandoColaCeldas ? 1 : 0);
  mostrarToast(
    pendientes > 1 ? `⏳ Guardando (${pendientes} cambios en cola)...` : "⏳ Guardando...",
    4000
  );

  procesarColaGuardadoCeldas();
}

async function procesarColaGuardadoCeldas() {
  if (procesandoColaCeldas) return;
  procesandoColaCeldas = true;

  let huboError = false;

  while (colaGuardadoCeldas.length > 0) {
    const tarea = colaGuardadoCeldas.shift();

    try {
      const resp = await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          accion: "actualizarCelda",
          curso: tarea.curso,
          filaHoja: tarea.filaHoja,
          columnaHoja: tarea.columnaHoja,
          valor: tarea.valor
        })
      });
      const json = await resp.json();
      if (!json.ok) throw new Error(json.error);

      // Solo aplicamos la respuesta de Sheets si NO quedan otros cambios en cola para esta misma fila
      const quedanPendientesMismaFila = colaGuardadoCeldas.some(
        t => t.curso === tarea.curso && t.filaHoja === tarea.filaHoja
      );

      if (
        !quedanPendientesMismaFila &&
        estado.cursoActual === tarea.curso &&
        json.resultado &&
        json.resultado.notasActualizadasFila
      ) {
        const aluLocal = (estado.estudiantes || []).find(e => e.filaHoja === tarea.filaHoja);
        if (aluLocal) {
          aluLocal.notas = json.resultado.notasActualizadasFila;
          renderVistaMateria();
          renderVistaAlumno();
          renderTablaCompleta();
        }
      }

      if (colaGuardadoCeldas.length > 0) {
        mostrarToast(
          `⏳ Guardando (${colaGuardadoCeldas.length} pendiente${colaGuardadoCeldas.length > 1 ? "s" : ""})...`,
          4000
        );
      }
    } catch (err) {
      huboError = true;
      mostrarToast("⚠️ Error al guardar: " + err.message, 4500);
    }
  }

  procesandoColaCeldas = false;
  if (!huboError) {
    mostrarToast("✅ Guardado");
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

  const ok = confirm(`⚠️ ¿Seguro que querés ELIMINAR la materia "${mat.nombre}" y todas sus columnas de calificaciones en Google Sheets?\n\nEsta acción no se puede deshacer.`);
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
  const nombreRaw = prompt("Apellido y Nombre:");
  if (!nombreRaw || !nombreRaw.trim()) return;
  const nombreLimpio = nombreRaw.replace(/^\d+[\.\-\)]\s*/, "").trim().toUpperCase();
  const grupo = prompt("Grupo:", "Grupo 1");
  if (grupo === null) return;

  const claveNombre = normalizarClaveNombreAlumno(nombreLimpio);
  const existente = (estado.estudiantes || []).find(
    e => normalizarClaveNombreAlumno(e.nombre) === claveNombre
  );

  if (existente) {
    const ordenPropuesto = prompt(
      `ℹ️ "${existente.nombre}" ya está en la lista (Orden N° ${existente.orden}).\nSe actualizarán sus datos sin duplicarlo.\n\nN° de Orden:`,
      existente.orden
    );
    if (ordenPropuesto === null) return;
    const ordFinal = parseInt(ordenPropuesto, 10) || existente.orden;

    try {
      mostrarToast("⏳ Reescribiendo datos del estudiante existente...");
      await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ accion: "actualizarCelda", curso: estado.cursoActual, filaHoja: existente.filaHoja, columnaHoja: 1, valor: ordFinal })
      });
      await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ accion: "actualizarCelda", curso: estado.cursoActual, filaHoja: existente.filaHoja, columnaHoja: 2, valor: nombreLimpio })
      });
      await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ accion: "actualizarCelda", curso: estado.cursoActual, filaHoja: existente.filaHoja, columnaHoja: 3, valor: (grupo || "Grupo 1").trim() })
      });
      await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ accion: "actualizarCelda", curso: estado.cursoActual, filaHoja: existente.filaHoja, columnaHoja: 4, valor: "Activo" })
      });

      existente.orden = ordFinal;
      existente.nombre = nombreLimpio;
      existente.grupo = (grupo || "Grupo 1").trim();
      existente.estado = "Activo";
      ordenarEstudiantesPorNumero(estado.estudiantes);
      aplicarDatosRecibidos(estado, true);
      mostrarToast(`✅ Estudiante actualizado sin duplicar (${existente.orden}. ${existente.nombre})`);
    } catch (err) {
      mostrarToast("⚠️ Error: " + err.message, 4000);
    }
    return;
  }

  const sigOrden = obtenerSiguienteNumeroOrden();
  const ordenInput = prompt("N° de Orden en la lista:", String(sigOrden));
  if (ordenInput === null) return;
  const ordenFinal = parseInt(ordenInput, 10) || sigOrden;

  const resp = await fetch(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      accion: "agregarEstudiante",
      curso: estado.cursoActual,
      datosAlumno: {
        orden: ordenFinal,
        nombre: nombreLimpio,
        grupo: (grupo || "Grupo 1").trim(),
        estado: "Activo"
      }
    })
  });
  const json = await resp.json();
  if (json.ok) {
    aplicarDatosRecibidos(json.data);
    mostrarToast(`✅ Estudiante agregado (Orden N° ${ordenFinal})`);
  }
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