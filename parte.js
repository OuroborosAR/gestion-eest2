// --- SILABEADOR EN ESPAÑOL PARA EL PARTE DIARIO ---
function silabearPalabraEspanol(palabra) {
  if (!palabra || palabra.length < 6) return palabra;
  const m = palabra.match(/^([^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]*)([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)([^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]*)$/);
  if (!m) return palabra;

  const pref = m[1];
  const core = m[2];
  const suf = m[3];
  if (core.length < 6) return palabra;

  const esVocal = c => /^[AEIOUÁÉÍÓÚÜaeiouáéíóúü]$/.test(c);
  const esGrupoInseparable = (c1, c2) => {
    const par = (c1 + c2).toLowerCase();
    return ["bl", "br", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "pl", "pr", "tl", "tr", "ch", "ll", "rr", "qu", "gu"].includes(par);
  };

  const cortes = [];
  let i = 0;
  while (i < core.length) {
    if (esVocal(core[i])) {
      let j = i + 1;
      while (j < core.length && !esVocal(core[j])) j++;
      if (j < core.length) {
        const numCons = j - (i + 1);
        let posCorte = -1;
        if (numCons === 1) {
          posCorte = i + 1;
        } else if (numCons === 2) {
          posCorte = esGrupoInseparable(core[i + 1], core[i + 2]) ? (i + 1) : (i + 2);
        } else if (numCons >= 3) {
          posCorte = esGrupoInseparable(core[j - 2], core[j - 1]) ? (j - 2) : (j - 1);
        }
        if (posCorte >= 2 && (core.length - posCorte) >= 2) {
          cortes.push(posCorte);
        }
      }
      i = j;
    } else {
      i++;
    }
  }

  if (cortes.length === 0) return palabra;
  let res = "";
  let prev = 0;
  cortes.forEach(c => {
    res += core.slice(prev, c) + "\u00AD";
    prev = c;
  });
  res += core.slice(prev);
  return pref + res + suf;
}

function silabearTextoEspanol(texto) {
  if (!texto) return "";
  return String(texto)
    .split(/(\s+)/)
    .map(token => /\s+/.test(token) ? token : silabearPalabraEspanol(token))
    .join("");
}

// --- PARTE DIARIO DINÁMICO MENSUAL (5 SEMANAS EN 4 PÁGINAS / 2 HOJAS A4) ---
const pdMonthNames = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

function construirDatosParteDinamico() {
  const hp = estado.horarioParte || {};
  const bloquesOrigen = (hp.bloques && hp.bloques.length > 0) ? hp.bloques : [];
  const definicionDias = [
    { dayName: "LUNES", dayIndex: 1, sheetGroup: 1, p2Height: "88mm" },
    { dayName: "MARTES", dayIndex: 2, sheetGroup: 1, p2Height: "84mm" },
    { dayName: "MIÉRCOLES", dayIndex: 3, sheetGroup: 1, p2Height: "88mm" },
    { dayName: "JUEVES", dayIndex: 4, sheetGroup: 2, p2Height: "131mm" },
    { dayName: "VIERNES", dayIndex: 5, sheetGroup: 2, p2Height: "131mm" }
  ];

  return definicionDias.map(def => {
    const bloquesDia = bloquesOrigen.filter(b => String(b.dia || "").trim().toUpperCase() === def.dayName);
    const subjects = bloquesDia.map(b => {
      const esTal = String(b.modalidad || "").toUpperCase() === "TALLER" || Boolean(b.esTaller);
      return {
        hour: b.horario || "",
        shift: b.turno || (esTal ? "Taller" : "Teoría"),
        name: b.materia || "",
        prof: b.profesor || "",
        isTaller: esTal,
        grupo: b.grupo || (esTal ? "Taller" : "Teo")
      };
    });

    if (subjects.length === 0) {
      subjects.push({ hour: "—", shift: "Teoría", name: "SIN CARGAR", prof: "—", isTaller: false, grupo: "Teo" });
    }

    const patShifts = [];
    const absentMap = new Map();
    const firmasSet = new Set();

    bloquesDia.forEach(b => {
      const esTal = String(b.modalidad || "").toUpperCase() === "TALLER" || Boolean(b.esTaller);
      const turnoCorto = (b.turno || "TT").split("-")[0].trim() || "TT";
      const grp = (b.grupo || (esTal ? "Tal" : "Teo")).trim();
      const patLabel = `${turnoCorto}(${grp})`;

      if (!patShifts.includes(patLabel)) patShifts.push(patLabel);
      if (turnoCorto.indexOf("TM") !== -1) firmasSet.add("Firma PR TM:");
      if (turnoCorto.indexOf("TT") !== -1) firmasSet.add("Firma PR TT:");
      if (turnoCorto.indexOf("TV") !== -1) firmasSet.add("Firma PR TV:");

      const claveAus = `${turnoCorto}_${grp}_${esTal ? "TAL" : "TEO"}`;
      if (!absentMap.has(claveAus)) {
        absentMap.set(claveAus, {
          code: `${turnoCorto} ${esTal ? "Taller" : "Teoría"} ${grp}`,
          lines: esTal ? 8 : 14,
          isTaller: esTal,
          weight: esTal ? 4 : 7
        });
      }
    });

    if (patShifts.length === 0) patShifts.push("TM/TT");
    if (absentMap.size === 0) absentMap.set("DEFAULT", { code: "Teoría / Taller", lines: 14, isTaller: false, weight: 7 });
    if (firmasSet.size === 0) { firmasSet.add("Firma PR TM:"); firmasSet.add("Firma PR TT:"); }

    const absentShifts = Array.from(absentMap.values());
    if (def.sheetGroup === 2 && absentShifts.length <= 3) {
      absentShifts.forEach(s => {
        s.lines = s.isTaller ? 10 : 18;
        s.weight = s.isTaller ? 5 : 9;
      });
    }

    return {
      dayName: def.dayName,
      dayIndex: def.dayIndex,
      sheetGroup: def.sheetGroup,
      p1Flex: Math.max(3.5, subjects.length + 0.6),
      p2Height: def.p2Height,
      patShifts: patShifts,
      absentShifts: absentShifts,
      signatures: Array.from(firmasSet),
      subjects: subjects
    };
  });
}

function pdGetMonthWeeksGrid(year, month) {
  const weeks = [];
  const firstDayOfMonth = new Date(year, month, 1);
  let currentMonday = new Date(firstDayOfMonth);
  const dayOfWeek = currentMonday.getDay();
  if (dayOfWeek === 6) currentMonday.setDate(currentMonday.getDate() + 2);
  else if (dayOfWeek === 0) currentMonday.setDate(currentMonday.getDate() + 1);
  else currentMonday.setDate(currentMonday.getDate() - (dayOfWeek - 1));

  for (let w = 0; w < 5; w++) {
    const weekDays = {};
    let hasAnyDayInMonth = false;
    for (let d = 1; d <= 5; d++) {
      const cellDate = new Date(currentMonday);
      cellDate.setDate(currentMonday.getDate() + (w * 7) + (d - 1));
      if (cellDate.getMonth() === month) {
        weekDays[d] = `${String(cellDate.getDate()).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}`;
        hasAnyDayInMonth = true;
      } else {
        weekDays[d] = null;
      }
    }
    weeks.push({ days: weekDays, active: hasAnyDayInMonth });
  }
  return weeks;
}

function pdBuildSheetPair(daysSubset, weeksList, periodTitle, sheetTitle, includeExtraNotes, isFirstPage) {
  const fragment = document.createDocumentFragment();
  const numWeeks = weeksList.length;
  const weekColWidthP1 = (74 / numWeeks).toFixed(2) + "%";
  const weekColWidthP2 = (100 / numWeeks).toFixed(2) + "%";
  const cursoLimpio = (estado.cursoActual || "").replace(/_/g, " ");
  const precObj = (estado.horarioParte && estado.horarioParte.preceptores)
    ? estado.horarioParte.preceptores
    : { tm: "___________", tt: "VENANCIO MARCELO", tv: "___________" };

  const frontPage = document.createElement("div");
  frontPage.className = isFirstPage ? "pd-page" : "pd-page pd-page-break";
  frontPage.innerHTML = `
    <div class="pd-doc-header" contenteditable="true">
      <div><span class="pd-sheet-indicator">${sheetTitle} - FRENTE (FIRMAS)</span><br>MES: <span>${periodTitle}</span> | CURSO: ${cursoLimpio}</div>
      <div>PR. TM: ${precObj.tm} | PR. TT: ${precObj.tt}<br>PR. TV: ${precObj.tv}</div>
      <div style="text-align: right;">E.E.S.T. N° 2 - SAN FERNANDO<br><span style="font-size:8.2px;">NEGRO: TEORÍA | <span class="pd-badge-ref">AZUL: TALLER</span></span></div>
    </div>
  `;

  const p1Container = document.createElement("div");
  p1Container.className = "pd-days-wrapper-p1";

  daysSubset.forEach(dayObj => {
    const table = document.createElement("table");
    table.className = "pd-day-block-p1";
    table.style.flex = dayObj.p1Flex;
    table.setAttribute("contenteditable", "true");

    let headerHTML = `<tr class="pd-day-header-row"><th class="pd-col-h">HORARIO</th><th class="pd-col-mat">MATERIA</th><th class="pd-col-prof">PROFESOR/A</th>`;
    for (let w = 0; w < numWeeks; w++) {
      headerHTML += `<th style="width:${weekColWidthP1};">${dayObj.dayName} ${weeksList[w][dayObj.dayIndex] || "—"}</th>`;
    }
    headerHTML += `</tr>`;

    let subjectsHTML = "";
    dayObj.subjects.forEach(sub => {
      const nombreSilabeado = silabearTextoEspanol(sub.name);
      const profSilabeado = silabearTextoEspanol(sub.prof);
      subjectsHTML += `<tr class="${sub.isTaller ? 'pd-taller-row' : 'pd-teoria-row'}">
        <td class="pd-col-h">${sub.hour}<span class="pd-shift-tag">${sub.shift}</span></td>
        <td class="pd-col-mat">${nombreSilabeado}</td>
        <td class="pd-col-prof">${profSilabeado}</td>`;
      for (let w = 0; w < numWeeks; w++) {
        subjectsHTML += `<td class="${weeksList[w][dayObj.dayIndex] !== null ? '' : 'pd-disabled-cell'}"></td>`;
      }
      subjectsHTML += `</tr>`;
    });

    let patHTML = `<tr class="pd-asist-row"><td colspan="3"><div class="pd-obs-box"><div><strong>Observaciones:</strong> <span style="color:var(--pd-taller-color); font-weight:bold;">(Azul: Taller)</span></div><div class="pd-obs-lines"></div><div class="pd-obs-lines"></div><div class="pd-obs-lines"></div></div></td>`;
    for (let w = 0; w < numWeeks; w++) {
      if (weeksList[w][dayObj.dayIndex] === null) {
        patHTML += `<td class="pd-disabled-cell"></td>`;
      } else {
        let subTable = `<table class="pd-pat-subtable"><tr><th class="pd-pat-label"></th>`;
        dayObj.patShifts.forEach(sh => subTable += `<th>${sh}</th>`);
        subTable += `</tr>`;
        ["P", "A", "T"].forEach(letter => {
          subTable += `<tr><td class="pd-pat-label">${letter}</td>`;
          dayObj.patShifts.forEach(() => subTable += `<td></td>`);
          subTable += `</tr>`;
        });
        subTable += `</table>`;
        patHTML += `<td>${subTable}</td>`;
      }
    }
    patHTML += `</tr>`;

    table.innerHTML = headerHTML + subjectsHTML + patHTML;
    p1Container.appendChild(table);
  });

  if (includeExtraNotes) {
    const notesBox = document.createElement("div");
    notesBox.className = "pd-general-notes-box";
    notesBox.setAttribute("contenteditable", "true");
    notesBox.innerHTML = `
      <div class="pd-general-notes-title">OBSERVACIONES GENERALES DEL MES (PAROS, FERIADOS, CAMBIOS DE HORARIO, SALIDAS EDUCATIVAS)</div>
      <div class="pd-general-note-line">1.</div>
      <div class="pd-general-note-line">2.</div>
      <div class="pd-general-note-line">3.</div>
      <div class="pd-general-note-line">4.</div>
    `;
    p1Container.appendChild(notesBox);
  }

  frontPage.appendChild(p1Container);
  fragment.appendChild(frontPage);

  const backPage = document.createElement("div");
  backPage.className = "pd-page pd-page-break";
  backPage.innerHTML = `
    <div class="pd-doc-header" contenteditable="true">
      <div><span class="pd-sheet-indicator">${sheetTitle} - DORSO (AUSENTES / PRESENTES)</span><br>CURSO: ${cursoLimpio}</div>
      <div style="text-align: center;">PERÍODO: <span>${periodTitle}</span></div>
      <div style="text-align: right; font-size: 8.3px;">Marcar según corresponda:<br><strong>[X] Aus.</strong> (Ausentes) &nbsp;|&nbsp; <strong>[X] Pres.</strong> (Presentes)</div>
    </div>
  `;

  const p2Container = document.createElement("div");
  p2Container.className = "pd-days-wrapper-p2";

  daysSubset.forEach(dayObj => {
    const table = document.createElement("table");
    table.className = "pd-day-block-p2";

    let headerHTML = `<thead><tr>`;
    for (let w = 0; w < numWeeks; w++) {
      headerHTML += `<th style="width:${weekColWidthP2};">${dayObj.dayName} ${weeksList[w][dayObj.dayIndex] || "—"}</th>`;
    }
    headerHTML += `</tr></thead>`;

    let bodyHTML = `<tbody><tr>`;
    for (let w = 0; w < numWeeks; w++) {
      if (weeksList[w][dayObj.dayIndex] === null) {
        bodyHTML += `<td class="pd-disabled-cell" style="height: ${dayObj.p2Height}; width:${weekColWidthP2};"></td>`;
      } else {
        let sectionsHTML = `<div class="pd-absent-box"><div class="pd-shifts-container">`;
        dayObj.absentShifts.forEach(sh => {
          sectionsHTML += `<div class="pd-shift-section" style="flex: ${sh.weight};">
            <div class="${sh.isTaller ? 'pd-shift-title pd-taller-title' : 'pd-shift-title'}">
              <span>${sh.code}</span>
              <span class="pd-chk-group"><span class="pd-chk-item"><span class="pd-chk-box"></span>Aus.</span><span class="pd-chk-item"><span class="pd-chk-box"></span>Pres.</span></span>
            </div>
            <div class="pd-lines-grid">`;
          for (let i = 1; i <= sh.lines; i++) sectionsHTML += `<div class="pd-student-line">${i}.</div>`;
          sectionsHTML += `</div></div>`;
        });
        sectionsHTML += `</div><div class="pd-signatures-bar" style="grid-template-columns: repeat(${dayObj.signatures.length}, 1fr);">`;
        dayObj.signatures.forEach(sig => sectionsHTML += `<div class="pd-sig-cell">${sig}</div>`);
        sectionsHTML += `</div></div>`;

        bodyHTML += `<td style="height: ${dayObj.p2Height}; width:${weekColWidthP2};">${sectionsHTML}</td>`;
      }
    }
    bodyHTML += `</tr></tbody>`;
    table.innerHTML = headerHTML + bodyHTML;
    p2Container.appendChild(table);
  });

  backPage.appendChild(p2Container);
  fragment.appendChild(backPage);
  return fragment;
}

function pdCreateMonthlyFourPagesBlock(year, month, isFirstBlock) {
  const allWeeks = pdGetMonthWeeksGrid(year, month);
  const weeksList = allWeeks.map(w => w.days);
  const periodTitle = `${pdMonthNames[month]} ${year}`;

  const scheduleDataDinamico = construirDatosParteDinamico();
  const daysGroup1 = scheduleDataDinamico.filter(d => d.sheetGroup === 1);
  const daysGroup2 = scheduleDataDinamico.filter(d => d.sheetGroup === 2);

  const blockFragment = document.createDocumentFragment();
  blockFragment.appendChild(
    pdBuildSheetPair(daysGroup1, weeksList, periodTitle, "HOJA 1 (LUNES A MIÉRCOLES)", false, isFirstBlock)
  );
  blockFragment.appendChild(
    pdBuildSheetPair(daysGroup2, weeksList, periodTitle, "HOJA 2 (JUEVES Y VIERNES)", true, false)
  );
  return blockFragment;
}

function pdRenderCurrentSelection() {
  const monthEl = document.getElementById("pdMonthSelect");
  const yearEl = document.getElementById("pdYearInput");
  if (!monthEl || !yearEl) return;

  const month = parseInt(monthEl.value, 10);
  const year = parseInt(yearEl.value, 10);

  const root = document.getElementById("pdDocumentRoot");
  if (!root) return;
  root.innerHTML = "";

  root.appendChild(pdCreateMonthlyFourPagesBlock(year, month, true));
  document.getElementById("pdModeBadge").textContent = `Mensual: ${pdMonthNames[month]} (5 semanas en 4 págs. / 2 hojas)`;
}

function pdRenderFullYear() {
  const year = parseInt(document.getElementById("pdYearInput").value, 10);
  const root = document.getElementById("pdDocumentRoot");
  root.innerHTML = "";
  let isFirst = true;

  for (let m = 2; m <= 11; m++) {
    root.appendChild(pdCreateMonthlyFourPagesBlock(year, m, isFirst));
    isFirst = false;
  }
  document.getElementById("pdModeBadge").textContent = `Ciclo Lectivo ${year} (Mar-Dic: 40 págs. / 20 hojas)`;
}

function imprimirParteDiarioA4() {
  document.body.classList.remove("print-mode-comunicado");
  window.print();
}