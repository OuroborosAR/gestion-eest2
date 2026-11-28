// ============================================================================
// MÓDULO DE GUÍAS INTERACTIVAS POR ROL + MARCO NORMATIVO DGCyE (ayuda.js)
// E.E.S.T. N° 2 "Pbro. Dr. Manuel de San Ginés" — San Fernando
// Respaldo normativo: Res. 1650/24 (Anexos 4, 5 y 8), Disp. 40/26,
// Adecuaciones del RA, Decreto 2299/11 y Res. 736/12.
// ============================================================================

const INFO_NORMATIVA_RA = {
  asistencia_computo: {
    titulo: "Cómputo de Inasistencias (Res. 1650/24 — Anexo 4)",
    norma: "Res. 1650/24 (Anexo 4, Arts. 7 a 12) • Dec. 2299/11 (Art. 195)",
    html: `
      <ul>
        <li><b>Turno único:</b> equivale a <b>1,00 inasistencia</b>.</li>
        <li><b>Doble turno o turno + contraturno (Teoría + Taller / Ed. Física):</b> equivale a <b>0,50 inasistencia</b> por cada turno. <i>(En triple turno en el mismo día, la app permite 0,33).</i></li>
        <li><b>Llegada tarde (T):</b> retraso de hasta 20 minutos computa <b>0,25 inasistencia</b>.</li>
        <li><b>Ausente Justificado (J):</b> se registra con certificado médico o nota firmada por adulto responsable (enfermedad, maternidad/paternidad, deporte federado, violencia por razones de género, citación judicial, etc.).</li>
        <li><b>Días sin actividad (Feriado, Asueto, Paro, Suspensión, Jornada docente):</b> según el Art. 195 del Dec. 2299/11 son suspensión de actividades: <b>no computan inasistencia (0,00)</b> ni suman como clase dictada.</li>
      </ul>
    `
  },
  asistencia_75: {
    titulo: "Límite de 28 Inasistencias y 75% por Materia",
    norma: "Res. 1650/24 (Anexo 4, Arts. 7, 10, 11 y 23 a 27) • Res. 736/12",
    html: `
      <ul>
        <li><b>Alertas tempranas obligatorias:</b> contacto con la familia a las <b>3 inasistencias consecutivas</b> (Res. 736/12) y citación formal con firma de acta a las <b>10</b>, <b>20</b> y <b>28 inasistencias</b>.</li>
        <li><b>¿Se queda libre al llegar a 28? NO.</b> El estudiante <b>continúa cursando como alumno regular</b> con las mismas obligaciones escolares y se acuerda un Plan de Continuidad Pedagógica Personalizado junto al EOE y la familia.</li>
        <li><b>Regla del 75% por materia:</b> al exceder las 28 inasistencias institucionales, se computa al cierre del ciclo la asistencia por materia. Debe alcanzar al menos el <b>75% de las clases efectivamente dictadas</b> (descontando feriados, paros y ausencias docentes).</li>
        <li>En las materias donde <b>no alcance el 75%</b>, el estudiante deberá participar de los <b>períodos de intensificación</b> de esa materia.</li>
      </ul>
    `
  },
  calificaciones_ra: {
    titulo: "Valoraciones, Calificaciones e Intensificación",
    norma: "Res. 1650/24 (Anexo 5) • Disp. 40/26",
    html: `
      <ul>
        <li><b>Valoraciones Preliminares (mayo y octubre):</b>
          <br>• <span class="badge val-TEA">TEA</span> Trayectoria Educativa Avanzada (alcanzó los aprendizajes y sostiene buena vinculación).
          <br>• <span class="badge val-TEP">TEP</span> En Proceso (aún no alcanzó todos los aprendizajes, pero mantiene vinculación pedagógica).
          <br>• <span class="badge val-TED">TED</span> Discontinua (no alcanzó los aprendizajes y tuvo escasa vinculación).
        </li>
        <li><b>Aprobación por materia (no por año):</b> cada cuatrimestre se aprueba con <b>7 o más</b> (escala 1 a 10). Las materias aprobadas y acreditadas <b>no se recursan</b>.</li>
        <li><b>Calificación Final:</b> si aprobó ambos cuatrimestres (7 a 10), es el <b>promedio</b> de ambos. Si desaprobó alguno, intensifica en <b>Diciembre y/o Febrero</b> y aprueba con <b>4 o más</b>.</li>
        <li><b>CI (Continúa Intensificando):</b> se consigna cuando la materia aún no se aprobó en esa instancia de intensificación y sigue en la siguiente.</li>
      </ul>
    `
  },
  pendientes_etp: {
    titulo: "Materias Pendientes, Comisiones Evaluadoras y EDTE (ETP)",
    norma: "Res. 1650/24 (Anexo 5 y Anexo 8 ETP) • Adecuaciones RA",
    html: `
      <ul>
        <li><b>Tope en Escuela Técnica (ETP):</b> hasta <b>5 materias pendientes</b> de aprobación y acreditación (en Ciclo Básico: hasta 4 de Formación General y 1 de Formación Técnico Específica; en Ciclo Superior: hasta 4 de Formación General/Científico-Tecnológica y hasta 1 de Formación Técnico Específica).</li>
        <li><b>Con 6 o más materias pendientes (ETP):</b> interviene el <b>EDTE</b> (Equipo de Definición de Trayectorias Educativas) junto a la familia y el estudiante para definir qué materias se recursan y las estrategias de acompañamiento (en la transición 2027 define el EDTE; desde 2028 se recursan todas las no acreditadas).</li>
        <li><b>Comisiones Evaluadoras Institucionales:</b> las materias pendientes de años anteriores se acreditan con calificación de <b>4 a 10</b> en <b>Agosto</b> (tras el receso invernal), <b>Diciembre</b> (tras la cursada) y <b>Marzo</b> (tras febrero), con instancias previas de acompañamiento y enseñanza.</li>
      </ul>
    `
  }
};

function mostrarInfoNormativa(clave) {
  const info = INFO_NORMATIVA_RA[clave];
  if (!info) return;
  const modal = document.getElementById("modalInfoNormativa");
  if (!modal) return;
  document.getElementById("infoNormTitulo").textContent = info.titulo;
  document.getElementById("infoNormSub").textContent = info.norma;
  document.getElementById("infoNormBody").innerHTML = info.html;
  modal.classList.add("open");
}

function cerrarInfoNormativa() {
  const modal = document.getElementById("modalInfoNormativa");
  if (modal) modal.classList.remove("open");
}

let tabAyudaActual = "RA";

function obtenerTabsAyudaPermitidas() {
  const esFam = typeof esRolFamiliaActual === "function" && esRolFamiliaActual();
  if (esFam) {
    return [
      { id: "FAMILIA", label: "👨‍👩‍👧 Guía Familias" },
      { id: "RA", label: "⚖️ Régimen Académico" }
    ];
  }

  const roles = typeof obtenerRolesActuales === "function" ? obtenerRolesActuales() : [];
  const esJefe = typeof tieneAlgunRolActual === "function" && tieneAlgunRolActual(["ADMIN", "DIRECTIVO", "JEFE_PR"]);
  const tabs = [];

  if (esJefe || roles.includes("PRECEPTOR")) {
    tabs.push({ id: "PR", label: "📋 Preceptores" });
  }
  if (esJefe || roles.includes("DOCENTE") || roles.includes("PRECEPTOR")) {
    tabs.push({ id: "DOCENTE", label: "📚 Docentes" });
  }
  if (esJefe || roles.includes("EOE") || roles.includes("SECRETARIA")) {
    tabs.push({ id: "GESTION", label: "🏛️ EOE / Sec. / Dir." });
  }
  tabs.push({ id: "FAMILIA", label: "👨‍👩‍👧 Familias" });
  tabs.push({ id: "RA", label: "⚖️ Régimen Académico" });
  return tabs;
}

function elegirTabAyudaPorDefecto() {
  const esFam = typeof esRolFamiliaActual === "function" && esRolFamiliaActual();
  if (esFam) return "FAMILIA";
  const roles = typeof obtenerRolesActuales === "function" ? obtenerRolesActuales() : [];
  if (roles.includes("PRECEPTOR") || roles.includes("JEFE_PR")) return "PR";
  if (roles.includes("DOCENTE")) return "DOCENTE";
  if (roles.includes("EOE") || roles.includes("SECRETARIA") || roles.includes("DIRECTIVO") || roles.includes("ADMIN")) return "GESTION";
  return "RA";
}

function abrirModalAyuda(tabOpcional) {
  const modal = document.getElementById("modalAyudaSistema");
  if (!modal) return;
  const tabs = obtenerTabsAyudaPermitidas();
  const buscada = tabOpcional && tabs.some(t => t.id === tabOpcional) ? tabOpcional : elegirTabAyudaPorDefecto();
  tabAyudaActual = buscada;
  renderContenidoModalAyuda();
  modal.classList.add("open");
}

function cerrarModalAyuda() {
  const modal = document.getElementById("modalAyudaSistema");
  if (modal) modal.classList.remove("open");
}

function cambiarTabAyuda(tabId) {
  tabAyudaActual = tabId;
  renderContenidoModalAyuda();
}

function renderContenidoModalAyuda() {
  const bar = document.getElementById("ayudaTabsBar");
  const cont = document.getElementById("ayudaBodyContent");
  if (!bar || !cont) return;

  const tabs = obtenerTabsAyudaPermitidas();
  bar.innerHTML = tabs.map(t =>
    `<button type="button" class="ayuda-tab-btn ${t.id === tabAyudaActual ? 'active' : ''}" onclick="cambiarTabAyuda('${t.id}')">${t.label}</button>`
  ).join("");

  cont.innerHTML = obtenerHTMLGuiaPorTab(tabAyudaActual);
}

function imprimirGuiaAyudaActual() {
  const root = document.getElementById("printAyudaRoot");
  if (!root) return;
  const tabs = obtenerTabsAyudaPermitidas();
  const tabObj = tabs.find(t => t.id === tabAyudaActual) || { label: "Guía Institucional" };

  root.innerHTML = `
    <div style="border-bottom:2px solid #1e3a8a; padding-bottom:8px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <div style="font-size:15px; font-weight:900; color:#1e3a8a;">E.E.S.T. N° 2 "Pbro. Dr. Manuel de San Ginés" — San Fernando</div>
        <div style="font-size:12px; font-weight:700; color:#334155;">Intranet Escolar — ${tabObj.label}</div>
      </div>
      <div style="font-size:10.5px; color:#64748b; text-align:right;">Respaldo Normativo DGCyE<br>Res. 1650/24 • Disp. 40/26 • Dec. 2299/11</div>
    </div>
    ${obtenerHTMLGuiaPorTab(tabAyudaActual)}
  `;

  document.body.classList.remove("print-mode-comunicado", "print-mode-acta");
  document.body.classList.add("print-mode-ayuda");
  window.print();
  setTimeout(() => document.body.classList.remove("print-mode-ayuda"), 600);
}

function obtenerHTMLGuiaPorTab(tabId) {
  if (tabId === "PR") {
    return `
      <div class="ayuda-card">
        <h3>1. Acceso, Cursos y Horarios del Parte</h3>
        <ol>
          <li>Ingresá desde <b>Personal de la Escuela</b> con tu DNI y contraseña (si es tu primera vez, tocá <i>Crear mi cuenta (@abc.gob.ar)</i> con el código de sector).</li>
          <li>Tus cursos se asignan automáticamente según la nómina de preceptores cargada en <b>🗓️ Horarios Parte</b>. Podés revisarlos o sincronizarlos desde <b>🎯 Mis Cargos</b>.</li>
          <li>Usá <b>🏫 Cursos</b> para buscar rápidamente por ciclo, modalidad, año o nombre. En <b>🏷️ Grupos</b> podés dividir los estudiantes por letra de Taller (Grupo A, B, E, F, etc.).</li>
        </ol>
      </div>

      <div class="ayuda-card">
        <h3>2. Toma de Asistencia Diaria (📋 Asistencia)</h3>
        <ol>
          <li>Elegí la <b>Fecha</b> y el <b>Turno / Grupo</b> (la app muestra solo los turnos que tienen clases programadas ese día).</li>
          <li>Marcá cada estudiante como <b>P</b> (Presente), <b>A</b> (Ausente: <b>0,50</b> doble/contraturno, <b>0,33</b> triple, <b>1,00</b> turno único), <b>J</b> (Justificado: no suma falta) o <b>T</b> (Tarde hasta 20 min: <b>0,25</b>).</li>
          <li><b>Días sin clases:</b> si hay Feriado, Asueto, Paro, Suspensión o Jornada docente, cambialo en <b>Estado del Turno / Día</b> para que registre <b>0,00 inasistencias</b> y no perjudique el 75% por materia (Dec. 2299/11 Art. 195).</li>
          <li><b>Ausencia puntual de un profesor:</b> destildá esa materia en <b>Asistencia Docente</b> para que esa fecha no cuente como "clase efectivamente dictada" en el cálculo del 75%.</li>
          <li>Tocá <b>💾 Guardar Asistencia</b>. Para avisar al grupo de WhatsApp, usá <b>🖼️ Enviar Imagen</b> o <b>💬 Enviar texto</b>: por privacidad de menores, el parte siempre identifica por <b>N° de Orden</b> y nunca publica nombres completos.</li>
        </ol>
        <div class="ayuda-norm-badge">⚖️ Res. 1650/24 Anexo 4 (Arts. 6 a 12) • Dec. 2299/11 Art. 74 y 195 • Res. 736/12</div>
      </div>

      <div class="ayuda-card">
        <h3>3. Parte Diario Imprimible, Legajo Familiar y Actas</h3>
        <ul>
          <li><b>🖨️ Parte Imprimible:</b> genera automáticamente el Parte Diario mensual o anual en A4 (Hoja 1: Lun a Mié / Hoja 2: Jue y Vie) a partir de los bloques cargados en <b>🗓️ Horarios Parte</b>.</li>
          <li><b>👤 Por Alumno (Legajo Familiar):</b> cargá el <b>DNI</b> del estudiante, adulto responsable, email y teléfono para habilitar el ingreso al Portal de Familias.</li>
          <li><b>Notificaciones y Citaciones:</b> podés publicar en el Portal y elegir entre <b>✉️ Abrir mi Correo</b> (para mandar desde tu propio @abc.gob.ar) o <b>📧 Envío Automático</b>. Recordá las alertas obligatorias a las <b>3 faltas consecutivas</b> y citaciones a las <b>10, 20 y 28 inasistencias</b>.</li>
          <li><b>📄 Actas:</b> genera en 1 clic Actas de Notificación (10/20/28) y Actas de Incomparecencia (cuando la familia citada no concurre), listas para imprimir en A4 y archivar en el legajo (Dec. 2299/11 Arts. 219-220).</li>
        </ul>
      </div>
    `;
  }

  if (tabId === "DOCENTE") {
    return `
      <div class="ayuda-card">
        <h3>1. Activación de Cuenta (@abc.gob.ar) y Mis Materias</h3>
        <ol>
          <li>En la pantalla de inicio elegí <b>Personal de la Escuela ➔ Crear mi cuenta (@abc.gob.ar)</b>.</li>
          <li>Completá tu DNI (será tu usuario), Apellido y Nombre, tu casilla oficial <b>@abc.gob.ar</b>, una contraseña personal y el <b>Código de Sector Docente</b>.</li>
          <li>Ingresá el código de 6 dígitos que llega a tu casilla @abc.gob.ar para activar la cuenta.</li>
          <li>El sistema cruza automáticamente tu <b>apellido + inicial del nombre</b> con los horarios del Parte Diario. Desde <b>🎯 Mis Cargos</b> podés verificar y tildar tus cursos y materias detectadas (y si tenés doble cargo en la escuela, podés sumar un 2° rol con su código).</li>
        </ol>
      </div>

      <div class="ayuda-card">
        <h3>2. Carga de Valoraciones y Calificaciones (📚 Por Materia)</h3>
        <ol>
          <li>Elegí el <b>Curso</b> arriba y seleccioná tu <b>Materia</b> en el desplegable.</li>
          <li>Cargá las <b>Valoraciones Preliminares</b> (1° y 2° Val.: <b>TEA / TEP / TED</b>) y las <b>Calificaciones Cuatrimestrales</b> (1°C y 2°C: escala <b>1 a 10</b> o <b>AUS</b>).</li>
          <li>Los cambios se <b>guardan automáticamente</b> en Google Sheets agrupados en lote (vas a ver el aviso <i>✅ Guardado</i>).</li>
          <li><b>Intensificación 1°C:</b> se habilita automáticamente solo para estudiantes con 6 o menos en el 1° cuatrimestre (escala 7 a 10).</li>
          <li><b>Intensificación Diciembre y Febrero:</b> se habilitan solo para quienes deban intensificar (1°C o 2°C menor a 7). Se aprueba con <b>4 a 10</b>; si aún no aprueba, consigná <b>CI</b> (Continúa Intensificando).</li>
          <li><b>Calificación Final y Taller de Ciclo Básico:</b> se calculan solos según la normativa (promedio si ambos cuatrimestres son 7 o más; o la nota de acreditación de Diciembre/Febrero).</li>
        </ol>
        <div class="ayuda-norm-badge">⚖️ Res. 1650/24 Anexo 5 (Arts. 3 a 11) • Disp. 40/26 • Proyecto de Evaluación Institucional</div>
      </div>

      <div class="ayuda-card">
        <h3>3. Importante sobre Comunicación Institucional</h3>
        <p style="font-size:12.5px; color:#334155; line-height:1.45;">
          Recordá que la comunicación formal de suspensiones de clases o inasistencias docentes a las familias corresponde exclusivamente al Equipo Directivo a través de Preceptoría (criterios de comunicación institucional). Las calificaciones cargadas aquí alimentan el RITE, la Libreta Digital y los informes de Preceptoría.
        </p>
      </div>
    `;
  }

  if (tabId === "FAMILIA") {
    return `
      <div class="ayuda-card">
        <h3>1. Cómo ingresar al Portal de Familias</h3>
        <ol>
          <li>En la pantalla de inicio, tocá el botón verde <b>👨‍👩‍👧 Portal de Familias</b>.</li>
          <li>Ingresá el <b>DNI del estudiante</b> (sin puntos). En tu primer ingreso, la contraseña inicial es ese mismo DNI.</li>
          <li>Por seguridad de los datos de tu hijo/a, la plataforma te pedirá crear una <b>contraseña personal</b> (mínimo 6 caracteres).</li>
          <li>Por privacidad, cada cuenta familiar accede <b>únicamente</b> al legajo, asistencia y calificaciones de su propio estudiante.</li>
        </ol>
      </div>

      <div class="ayuda-card">
        <h3>2. Cómo leer la Asistencia y las Calificaciones</h3>
        <ul>
          <li><b>Gráfico de Asistencia Anual y Mensual:</b> muestra el porcentaje de asistencia y las faltas acumuladas sobre el tope anual de <b>28 inasistencias</b>.</li>
          <li><b>Tabla del 75% por Materia:</b> si el estudiante llega a 28 faltas, <b>sigue asistiendo a clases normalmente</b> y pasa a contarse el 75% de asistencia sobre las clases efectivamente dictadas en cada materia (Teoría y Taller).</li>
          <li><b>Colores de las notas:</b>
            <span class="badge val-TEA">Azul (TEA / 7 a 10)</span> Aprobado / Avanzado &nbsp;•&nbsp;
            <span class="badge val-TEP">Verde (TEP / 4 a 6)</span> En Proceso / Aprobado en intensificación &nbsp;•&nbsp;
            <span class="badge val-TED">Rojo (TED / 1 a 3 / AUS)</span> Discontinuo / Desaprobado &nbsp;•&nbsp;
            <span class="badge val-CI">Amarillo (CI)</span> Continúa Intensificando.
          </li>
          <li><b>Materias Pendientes de Años Anteriores:</b> muestra si adeuda materias de años previos (en Escuela Técnica hasta 5 para Comisiones Evaluadoras).</li>
        </ul>
      </div>

      <div class="ayuda-card">
        <h3>3. Comunicados y Citaciones Oficiales</h3>
        <p style="font-size:12.5px; color:#334155; line-height:1.45;">
          Cuando Preceptoría o el Equipo Directivo envían una notificación o citación presencial, aparece destacada en la parte superior del Portal. Tocá el botón verde <b>✅ Confirmar Recepción y Lectura</b> para dejar constancia de lectura con fecha y hora.<br><br><b>Importante:</b> se recuerda que esta plataforma es un medio complementario pensado para mantener una comunicación más fluida con las familias y <b>no reemplaza los comunicados ni las notificaciones fehacientes del Cuaderno de Comunicados</b>.
        </p>
        <div class="ayuda-norm-badge">⚖️ Dec. 2299/11 Art. 242 (Medios complementarios) • Res. 1650/24 (Anexos 4, 5 y 8)</div>
      </div>
    `;
  }

  if (tabId === "GESTION") {
    return `
      <div class="ayuda-card">
        <h3>Permisos por Sector Institucional</h3>
        <ul>
          <li><b>🏛️ Directivo / Admin:</b> acceso total a todos los cursos, creación de cursos y ciclos lectivos (<b>📅 Ciclos</b>), pase de año, gestión de usuarios, auditoría y rotación de códigos de autoregistro en <b>👥 Usuarios</b>.</li>
          <li><b>📋 Jefatura de Preceptores (JEFE_PR):</b> visión y gestión operativa de todos los cursos (asistencia, partes diarios, legajos, notas y actas).</li>
          <li><b>🗂️ Secretaría (SECRETARIA):</b> acceso a todos los cursos para matrícula, legajos familiares, DNI, materias pendientes y consulta de planillas (sin modificar asistencia ni notas).</li>
          <li><b>🤝 EOE / Trayectorias (EOE):</b> acceso a todos los cursos en modo consulta (asistencia, gráficos 75%, notas y pendientes) + redacción y archivo de <b>📄 Actas</b>, con opción de tildar <b>🔒 Acta reservada</b> (visible únicamente para EOE y Equipo Directivo).</li>
        </ul>
        <div class="ayuda-norm-badge">⚖️ Dec. 2299/11 • Com. Conjunta N° 1/23 (Resguardo de confidencialidad) • Res. 1650/24</div>
      </div>

      <div class="ayuda-card">
        <h3>Códigos de Autoregistro y Doble Cargo</h3>
        <p style="font-size:12.5px; color:#334155; line-height:1.45;">
          Desde <b>👥 Usuarios</b> el Equipo Directivo puede consultar o rotar los códigos de acceso por sector (hoja <i>Config_Accesos</i>). Cada agente con casilla <b>@abc.gob.ar</b> puede tener hasta <b>2 roles simultáneos</b> (por ejemplo, Preceptor + Docente o EOE + Docente) y la plataforma combina automáticamente los permisos según el curso y la materia.
        </p>
      </div>
    `;
  }

  // TAB "RA" — RÉGIMEN ACADÉMICO DGCyE (Aclaración de puntos que generan confusión)
  return `
    <div class="ayuda-card ayuda-ra-highlight">
      <h3>1. Asistencia: 28 Faltas, Cómputo y Regla del 75%</h3>
      <ul>
        <li><b>Cómputo diario (Res. 1650/24, Anexo 4, Arts. 8 y 9):</b> Turno único = <b>1</b> falta | Doble turno o contraturno (Teoría + Taller / Ed. Física) = <b>0,50</b> por turno | Tardanza de hasta 20 minutos = <b>0,25</b>.</li>
        <li><b>Días sin actividad (Dec. 2299/11, Art. 195):</b> Feriados, asuetos, paros, suspensiones y jornadas solo docentes <b>no computan inasistencia</b> ni cuentan como clase dictada.</li>
        <li><b>Intervenciones obligatorias (Anexo 4, Arts. 23 a 26 y Res. 736/12):</b> Contacto con la familia a las <b>3 faltas consecutivas</b>; reunión con firma de acta a las <b>10</b>, <b>20</b> y <b>28 inasistencias</b> (justificadas o no).</li>
        <li><b>Mito frecuente — "¿Queda libre a las 28 faltas?": NO.</b> El estudiante <b>sigue cursando como alumno regular</b> con todas sus obligaciones. Al superar las 28 faltas institucionales, se evalúa al cierre del ciclo el <b>75% de asistencia por materia sobre clases efectivamente dictadas</b>. Solo debe intensificar las materias donde no alcance ese 75%.</li>
        <li><b>Justificaciones:</b> Enfermedad (certificado médico o nota de adulto responsable si es pasajera), maternidad (30 días + extensiones), paternidad (15 días), lactancia, deporte federado, violencia por razones de género (35 días con estricta reserva) y citación judicial.</li>
      </ul>
      <div class="ayuda-norm-badge">⚖️ Res. 1650/24 Anexo 4 • Res. 736/12 • Dec. 2299/11 Art. 195</div>
    </div>

    <div class="ayuda-card">
      <h3>2. Valoraciones (TEA / TEP / TED) y Calificaciones Cuatrimestrales</h3>
      <ul>
        <li><b>Aprobación por materia, NO por año:</b> las materias aprobadas y acreditadas <b>nunca se recursan</b>.</li>
        <li><b>Valoraciones Preliminares (mayo y octubre):</b> son informes pedagógicos cualitativos en el transcurso del cuatrimestre:
          <br>• <span class="badge val-TEA">TEA</span> <b>Trayectoria Educativa Avanzada:</b> alcanzó los aprendizajes y sostiene buena vinculación.
          <br>• <span class="badge val-TEP">TEP</span> <b>Trayectoria Educativa en Proceso:</b> aún no alcanzó de forma suficiente los aprendizajes, pero sostiene buena vinculación.
          <br>• <span class="badge val-TED">TED</span> <b>Trayectoria Educativa Discontinua:</b> no alcanzó los aprendizajes y tuvo escasa vinculación pedagógica.
        </li>
        <li><b>Cierre de cuatrimestre (julio y noviembre):</b> calificación numérica del <b>1 al 10</b>. Cada cuatrimestre se aprueba con <b>7 o más</b>.</li>
        <li><b>Calificación Final:</b>
          <br>• Si aprobó ambos cuatrimestres (7 a 10): es el <b>promedio</b> de ambos.
          <br>• Si desaprobó uno o ambos (6 o menos): intensifica los saberes pendientes en <b>Diciembre y/o Febrero</b> y aprueba con <b>4 a 10</b>.
          <br>• Mientras no apruebe en un período de intensificación se consigna <b>CI (Continúa Intensificando)</b> hasta el cierre del ciclo lectivo en febrero.
        </li>
      </ul>
      <div class="ayuda-norm-badge">⚖️ Res. 1650/24 Anexo 5 (Arts. 3 a 11) • RITE y Libreta Digital</div>
    </div>

    <div class="ayuda-card">
      <h3>3. Períodos de Profundización e Intensificación</h3>
      <ul>
        <li><b>Profundización vs. Intensificación:</b> quienes ya aprobaron realizan actividades de <b>profundización</b>; quienes obtuvieron TEP/TED o calificación menor a 7 realizan <b>intensificación</b> de la enseñanza y el estudio junto al docente de la materia.</li>
        <li><b>Ciclo Lectivo 2026 (Disposición N° 40/26 — 3 períodos de hasta 1 mes):</b>
          <br>1) <b>Febrero / Marzo:</b> 2° quincena de febrero (cierre ciclo anterior) y 2° quincena de marzo (pendientes de años anteriores).
          <br>2) <b>Junio (opcional) / Julio:</b> 1° quincena de julio (cierre 1°C y pendientes).
          <br>3) <b>Noviembre / Diciembre:</b> 2 semanas previas al cierre del 2°C y 2 semanas posteriores al cierre.
        </li>
        <li><b>Adecuaciones a partir de 2027 (4 instancias para materias en curso/recursadas):</b> 1° quincena de julio (opción 2° de junio), 2° quincena de noviembre, 1° quincena de diciembre y 2° quincena de febrero. Las pendientes de años anteriores ya no se superponen en estos períodos: pasan a <b>Comisiones Evaluadoras Institucionales</b>.</li>
      </ul>
      <div class="ayuda-norm-badge">⚖️ Disp. N° 40/26 • Adecuaciones y Modificaciones del Régimen Académico (DGCyE)</div>
    </div>

    <div class="ayuda-card">
      <h3>4. Materias Pendientes, Comisiones Evaluadoras y EDTE (Escuela Técnica)</h3>
      <ul>
        <li><b>Tope específico de Educación Técnico Profesional (Anexo 8):</b> hasta <b>5 materias pendientes</b> de aprobación y acreditación (en Ciclo Básico: hasta 4 de Formación General + 1 de Formación Técnico Específica; en Ciclo Superior: hasta 4 de Formación General/Científico-Tecnológica + 1 de Formación Técnico Específica).</li>
        <li><b>Qué pasa con 6 o más pendientes en ETP:</b> interviene el <b>EDTE</b> (Equipo de Definición de Trayectorias Educativas: Directivo, EOE, docente y preceptor) junto a la familia para definir las materias a recursar y el trayecto personalizado. <i>(A partir del ciclo 2028, con 6 o más pendientes en ETP se recursan todas las materias no acreditadas).</i></li>
        <li><b>Comisiones Evaluadoras Institucionales:</b> no son mesas examinadoras aisladas, sino instancias con acompañamiento y enseñanza previa (módulos FORTE, docentes del área y perfiles de acompañamiento). Se convocan en:
          <br>• <b>Agosto</b> (primera semana tras el receso invernal)
          <br>• <b>Diciembre</b> (tras la finalización de la cursada)
          <br>• <b>Marzo</b> (tras el período de intensificación de febrero)
          <br>Se acreditan con calificación de <b>4 a 10</b>. Para egresados de 6°/7° año, continúan a partir de abril según Calendario de Actividades Docentes.
        </li>
      </ul>
      <div class="ayuda-norm-badge">⚖️ Res. 1650/24 Anexo 5 y Anexo 8 (ETP) • Adecuaciones del RA</div>
    </div>
  `;
}
