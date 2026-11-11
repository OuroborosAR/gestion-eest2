/**
 * API BACKEND EEST N°2 - GESTIÓN ACADÉMICA, ASISTENCIA, PARTE DIARIO Y USUARIOS (RBAC)
 * Incluye autenticación por roles (ADMIN, DIRECTIVO, PRECEPTOR), expansión automática
 * de columnas y cálculo automático de Taller en Ciclo Básico (1° a 3°).
 */

const HOJA_HISTORIAL_ASISTENCIA = 'Asistencias_Historico';
const HOJA_HORARIOS_PARTE = 'Config_Horarios_Parte';
const HOJA_USUARIOS = 'Usuarios_Sistema';

const MESES_NOMBRES = [
  'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
  'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    const usuario = params.usuario || '';
    const clave = params.clave || '';
    const cursoParam = params.curso || '';

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const userObj = autenticarUsuario(ss, usuario, clave);
    const data = obtenerDatosCurso(cursoParam, userObj);

    return respuestaJson({ ok: true, data: data });
  } catch (err) {
    return respuestaJson({ ok: false, error: err.message, requiereLogin: true });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const accion = payload.accion;
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Validar credenciales en cada petición POST
    const userObj = autenticarUsuario(ss, payload.authUsuario, payload.authClave);

    if (accion === 'login') {
      const data = obtenerDatosCurso(payload.curso || '', userObj);
      return respuestaJson({ ok: true, data: data });
    }

    if (accion === 'cambiarMiClave') {
      const res = cambiarClavePropia(ss, userObj, payload.nuevaClave);
      return respuestaJson({ ok: true, resultado: res });
    }

    if (accion === 'guardarUsuario') {
       exigirRolAdminODirectivo(userObj);
      const lista = guardarUsuarioSistema(ss, payload.datosUsuario);
      return respuestaJson({ ok: true, usuarios: lista, cursosTotales: obtenerTodosLosCursos(ss) });
    }

    if (accion === 'eliminarUsuario') {
      exigirRolAdminODirectivo(userObj);
      const lista = eliminarUsuarioSistema(ss, payload.usuarioEliminar, userObj.usuario);
      return respuestaJson({ ok: true, usuarios: lista, cursosTotales: obtenerTodosLosCursos(ss) });
    }

    if (accion === 'crearCurso') {
      exigirRolAdminODirectivo(userObj);
      const data = crearNuevoCurso(
        payload.nombreCurso,
        payload.materias,
        payload.preceptores,
        payload.bloquesHorario,
        payload.estudiantesIniciales,
        payload.esCicloBasico,
        userObj
      );
      return respuestaJson({ ok: true, data: data });
    }

    // Acciones que operan sobre un curso específico: verificar permiso de acceso al curso
    const cursoObjetivo = payload.curso || '';
    verificarPermisoCurso(userObj, cursoObjetivo);

    if (accion === 'actualizarCelda') {
      const res = actualizarCelda(cursoObjetivo, payload.filaHoja, payload.columnaHoja, payload.valor);
      return respuestaJson({ ok: true, resultado: res });
    }

    if (accion === 'registrarAsistencia') {
      if (!payload.preceptor) payload.preceptor = userObj.nombre;
      const data = registrarAsistenciaDiaria(payload, userObj);
      return respuestaJson({ ok: true, data: data });
    }

    if (accion === 'actualizarNombreMateria') {
      const res = actualizarNombreMateria(cursoObjetivo, payload.columnaInicio, payload.nuevoNombre);
      return respuestaJson({ ok: true, resultado: res });
    }

    if (accion === 'agregarEstudiante') {
      const data = agregarEstudiante(cursoObjetivo, payload.datosAlumno, userObj);
      return respuestaJson({ ok: true, data: data });
    }

    if (accion === 'agregarEstudiantesLote') {
      const data = agregarEstudiantesLote(cursoObjetivo, payload.estudiantes, userObj);
      return respuestaJson({ ok: true, data: data });
    }

    if (accion === 'agregarMateria') {
      const data = agregarMateria(cursoObjetivo, payload.nombreMateria, userObj);
      return respuestaJson({ ok: true, data: data });
    }

    if (accion === 'guardarHorarioParte') {
      const data = guardarHorarioParteCurso(
        cursoObjetivo,
        payload.preceptores,
        payload.bloques,
        payload.sincronizarMateriasPlanilla,
        userObj
      );
      return respuestaJson({ ok: true, data: data });
    }

    if (accion === 'agregarBloqueHorario') {
      const data = agregarBloqueHorarioCurso(cursoObjetivo, payload.bloque, payload.preceptores, userObj);
      return respuestaJson({ ok: true, data: data });
    }

    if (accion === 'eliminarBloqueHorario') {
      const data = eliminarBloqueHorarioCurso(cursoObjetivo, payload.filaConfig, userObj);
      return respuestaJson({ ok: true, data: data });
    }
    if (accion === 'eliminarCurso') {
      exigirRolAdminODirectivo(userObj);
      const data = eliminarCursoCompleto(payload.nombreCurso, userObj);
      return respuestaJson({ ok: true, data: data });
    }
    if (accion === 'eliminarMateria') {
      const data = eliminarMateriaCurso(cursoObjetivo, payload.columnaInicio, userObj);
      return respuestaJson({ ok: true, data: data });
    }
    throw new Error('Acción no reconocida: ' + accion);
  } catch (err) {
    return respuestaJson({ ok: false, error: err.message });
  }
}

function respuestaJson(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// MÓDULO DE SEGURIDAD Y GESTIÓN DE USUARIOS (ADMIN / DIRECTIVO / PRECEPTOR)
// ============================================================================

function obtenerOCrearHojaUsuarios(ss) {
  let hoja = ss.getSheetByName(HOJA_USUARIOS);
  if (!hoja) {
    hoja = ss.insertSheet(HOJA_USUARIOS);
    hoja.getRange(1, 1, 1, 6).setValues([[
      'Usuario', 'Clave', 'Nombre_Completo', 'Rol', 'Cursos_Permitidos', 'Activo'
    ]])
      .setBackground('#0f172a')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    hoja.setFrozenRows(1);

    // Usuarios iniciales por defecto
    const usuariosSemilla = [
      ['admin', '1234', 'VENANCIO MARCELO', 'ADMIN', 'TODOS', 'SI'],
      ['directivo', '1234', 'EQUIPO DIRECTIVO', 'DIRECTIVO', 'TODOS', 'SI'],
      ['silvana', '1234', 'LAREU SILVANA', 'PRECEPTOR', '1ro_8va', 'SI']
    ];
    hoja.getRange(2, 1, usuariosSemilla.length, 6).setValues(usuariosSemilla);
  }
  return hoja;
}

function esAdminODirectivo(userObj) {
  if (!userObj) return false;
  const r = String(userObj.rol || '').toUpperCase();
  return r === 'ADMIN' || r === 'DIRECTIVO';
}

function exigirRolAdminODirectivo(userObj) {
  if (!esAdminODirectivo(userObj)) {
    throw new Error('Permiso denegado: esta acción requiere rol de Administrador o Directivo.');
  }
}

function autenticarUsuario(ss, usuarioInput, claveInput) {
  const uLimpio = String(usuarioInput || '').trim().toLowerCase();
  const cLimpia = String(claveInput || '').trim();

  if (!uLimpio || !cLimpia) {
    throw new Error('Debés iniciar sesión con tu usuario y contraseña.');
  }

  const hoja = obtenerOCrearHojaUsuarios(ss);
  const datos = hoja.getDataRange().getValues();

  for (let r = 1; r < datos.length; r++) {
    const f = datos[r];
    const userHoja = String(f[0] || '').trim().toLowerCase();
    const claveHoja = String(f[1] || '').trim();
    const nombreHoja = String(f[2] || '').trim();
    const rolHoja = String(f[3] || 'PRECEPTOR').trim().toUpperCase();
    const cursosRaw = String(f[4] || 'TODOS').trim();
    const activoHoja = String(f[5] || 'SI').trim().toUpperCase();

    if (userHoja === uLimpio) {
      if (activoHoja === 'NO' || activoHoja === 'FALSE') {
        throw new Error('Esta cuenta de usuario se encuentra deshabilitada.');
      }
      if (claveHoja !== cLimpia) {
        throw new Error('Contraseña o PIN incorrecto.');
      }

      const esTotal = (rolHoja === 'ADMIN' || rolHoja === 'DIRECTIVO' || cursosRaw.toUpperCase() === 'TODOS');
      const listaPermitidos = esTotal
        ? ['TODOS']
        : cursosRaw.split(',').map(c => c.trim()).filter(Boolean);

      return {
        filaUsuario: r + 1,
        usuario: userHoja,
        nombre: nombreHoja || userHoja.toUpperCase(),
        rol: rolHoja,
        accesoTotal: esTotal,
        cursosPermitidos: listaPermitidos
      };
    }
  }

  throw new Error('El usuario "' + usuarioInput + '" no existe.');
}

function verificarPermisoCurso(userObj, nombreCurso) {
  if (!userObj) throw new Error('Sesión inválida.');
  if (userObj.accesoTotal || esAdminODirectivo(userObj)) return true;

  const cursoNorm = String(nombreCurso || '').trim().toLowerCase();
  const permitidosLower = (userObj.cursosPermitidos || []).map(c => c.toLowerCase());

  if (permitidosLower.indexOf('todos') !== -1 || permitidosLower.indexOf(cursoNorm) !== -1) {
    return true;
  }
  throw new Error('No tenés permisos asignados para acceder o modificar el curso: ' + nombreCurso);
}

function listarUsuariosSistema(ss) {
  const hoja = obtenerOCrearHojaUsuarios(ss);
  const datos = hoja.getDataRange().getValues();
  const lista = [];

  for (let r = 1; r < datos.length; r++) {
    const f = datos[r];
    const u = String(f[0] || '').trim();
    if (!u) continue;
    lista.push({
      usuario: u,
      clave: String(f[1] || '').trim(),
      nombre: String(f[2] || '').trim(),
      rol: String(f[3] || 'PRECEPTOR').trim().toUpperCase(),
      cursosPermitidos: String(f[4] || 'TODOS').trim(),
      activo: String(f[5] || 'SI').trim().toUpperCase() !== 'NO'
    });
  }
  return lista;
}

function guardarUsuarioSistema(ss, datosUsuario) {
  if (!datosUsuario) throw new Error('Faltan los datos del usuario.');
  const uNorm = String(datosUsuario.usuario || '').trim().toLowerCase().replace(/\s+/g, '');
  const clave = String(datosUsuario.clave || '').trim();
  const nombre = String(datosUsuario.nombre || uNorm).trim().toUpperCase();
  const rol = String(datosUsuario.rol || 'PRECEPTOR').trim().toUpperCase();
  const activo = (datosUsuario.activo === false || String(datosUsuario.activo).toUpperCase() === 'NO') ? 'NO' : 'SI';

  if (!uNorm) throw new Error('El nombre de usuario no puede estar vacío.');
  if (!clave) throw new Error('Debés asignar una clave o PIN al usuario.');
  if (['ADMIN', 'DIRECTIVO', 'PRECEPTOR'].indexOf(rol) === -1) {
    throw new Error('El rol debe ser ADMIN, DIRECTIVO o PRECEPTOR.');
  }

  let cursosStr = 'TODOS';
  if (rol === 'PRECEPTOR' && datosUsuario.cursosPermitidos) {
    if (Array.isArray(datosUsuario.cursosPermitidos)) {
      cursosStr = datosUsuario.cursosPermitidos.length > 0 ? datosUsuario.cursosPermitidos.join(', ') : 'TODOS';
    } else {
      cursosStr = String(datosUsuario.cursosPermitidos).trim() || 'TODOS';
    }
  }

  const hoja = obtenerOCrearHojaUsuarios(ss);
  const datos = hoja.getDataRange().getValues();
  let filaExistente = -1;

  for (let r = 1; r < datos.length; r++) {
    if (String(datos[r][0] || '').trim().toLowerCase() === uNorm) {
      filaExistente = r + 1;
      break;
    }
  }

  const filaValores = ["'" + uNorm, "'" + clave, nombre, rol, cursosStr, activo];
  if (filaExistente !== -1) {
    hoja.getRange(filaExistente, 1, 1, 6).setValues([filaValores]);
  } else {
    hoja.appendRow(filaValores);
  }

  return listarUsuariosSistema(ss);
}

function eliminarUsuarioSistema(ss, usuarioAEliminar, usuarioSolicitante) {
  const uBorrar = String(usuarioAEliminar || '').trim().toLowerCase();
  if (!uBorrar) throw new Error('Usuario inválido.');
  if (uBorrar === String(usuarioSolicitante || '').trim().toLowerCase()) {
    throw new Error('No podés eliminar tu propio usuario en uso.');
  }

  const hoja = obtenerOCrearHojaUsuarios(ss);
  const datos = hoja.getDataRange().getValues();

  for (let r = 1; r < datos.length; r++) {
    if (String(datos[r][0] || '').trim().toLowerCase() === uBorrar) {
      hoja.deleteRow(r + 1);
      return listarUsuariosSistema(ss);
    }
  }
  throw new Error('No se encontró el usuario: ' + usuarioAEliminar);
}

function cambiarClavePropia(ss, userObj, nuevaClave) {
  const limpia = String(nuevaClave || '').trim();
  if (!limpia || limpia.length < 3) {
    throw new Error('La nueva clave debe tener al menos 3 caracteres.');
  }
  const hoja = obtenerOCrearHojaUsuarios(ss);
  hoja.getRange(userObj.filaUsuario, 2).setValue("'" + limpia);
  return { ok: true };
}

// ============================================================================
// FUNCIONES ACADÉMICAS, CICLO BÁSICO, HORARIOS Y ASISTENCIA
// ============================================================================

function asegurarColumnasSuficientes(sheet, columnasRequeridas) {
  const maxActual = sheet.getMaxColumns();
  if (maxActual < columnasRequeridas) {
    sheet.insertColumnsAfter(maxActual, columnasRequeridas - maxActual);
  }
}

function esCursoCicloBasico(nombreCurso) {
  const limp = String(nombreCurso || '').trim().toLowerCase();
  return /^(1|2|3)(ro|do|er|°|\b|_)/i.test(limp);
}

function esModuloSubTallerCB(nombreMat) {
  const n = String(nombreMat || '').toLowerCase();
  return (
    n.indexOf('procedimientos t') !== -1 ||
    n.indexOf('lenguajes tecnol') !== -1 ||
    n.indexOf('lenguaje tecnol') !== -1 ||
    n.indexOf('sistemas tecnol') !== -1
  );
}

function esColumnaResumenTallerCB(nombreMat) {
  const n = String(nombreMat || '').toLowerCase();
  return (
    n === 'taller' ||
    n.indexOf('taller (calif') !== -1 ||
    n.indexOf('taller (promedio') !== -1 ||
    n.indexOf('taller general') !== -1
  );
}

function calcularValorResumenTallerCB(valoresTresModulos, esValoracion) {
  const limpios = (valoresTresModulos || [])
    .map(v => String(v === undefined || v === null ? '' : v).trim().toUpperCase())
    .filter(Boolean);

  if (limpios.length === 0) return '';

  if (esValoracion) {
    if (limpios.indexOf('TED') !== -1) return 'TED';
    if (limpios.indexOf('TEP') !== -1) return 'TEP';
    if (limpios.length === 3 && limpios.every(v => v === 'TEA')) return 'TEA';
    if (limpios.every(v => v === 'TEA')) return 'TEA';
    return '';
  }

  const numeros = [];
  let tieneAus = false;

  limpios.forEach(v => {
    if (v === 'AUS') {
      tieneAus = true;
    } else {
      const n = parseFloat(v.replace(',', '.'));
      if (!isNaN(n) && n >= 1 && n <= 10) {
        numeros.push(n);
      }
    }
  });

  const desaprobadas = numeros.filter(n => n < 7);
  if (desaprobadas.length > 0) {
    return Math.max.apply(null, desaprobadas);
  }

  if (tieneAus) {
    return 'AUS';
  }

  if (numeros.length === 3 && numeros.every(n => n >= 7)) {
    const suma = numeros[0] + numeros[1] + numeros[2];
    return Math.round(suma / 3);
  }

  return '';
}

function recalcularPromedioTallerFilaSiCorresponde(sheet, infoCurso, filaHoja, offsetSubColumna) {
  const materias = infoCurso.materias || [];
  const modulosSub = materias.filter(m => esModuloSubTallerCB(m.nombre));
  const colResumen = materias.find(m => esColumnaResumenTallerCB(m.nombre));

  if (modulosSub.length < 3 || !colResumen) return null;

  const valoresModulos = modulosSub.slice(0, 3).map(m => {
    const col = m.columnaInicio + offsetSubColumna;
    return sheet.getRange(Number(filaHoja), col).getValue();
  });

  const esVal = (offsetSubColumna === 0 || offsetSubColumna === 2);
  const nuevoResumen = calcularValorResumenTallerCB(valoresModulos, esVal);
  const colDestino = colResumen.columnaInicio + offsetSubColumna;

  sheet.getRange(Number(filaHoja), colDestino).setValue(nuevoResumen);
  return {
    columnaResumen: colDestino,
    indiceMateriaResumen: colResumen.indice,
    valorResumen: String(nuevoResumen)
  };
}

function formatearFechaCelda(valor) {
  if (!valor) return '';
  if (Object.prototype.toString.call(valor) === '[object Date]' && !isNaN(valor.getTime())) {
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }
  const str = String(valor).trim();
  const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const d = ('0' + match[1]).slice(-2);
    const m = ('0' + match[2]).slice(-2);
    return d + '/' + m + '/' + match[3];
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }
  return str;
}

function formatearTimestampCelda(valor) {
  if (!valor) return '';
  if (Object.prototype.toString.call(valor) === '[object Date]' && !isNaN(valor.getTime())) {
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
  }
  return String(valor).trim();
}

function extraerOrdenesDesdeNomina(textoNomina) {
  if (!textoNomina) return [];
  const limpio = String(textoNomina)
    .split('| Obs:')[0]
    .split('[ValAus:')[0]
    .trim();

  if (!limpio || limpio.toLowerCase().indexOf('sin ') === 0) return [];

  const partes = limpio.split('|');
  const ordenes = [];
  partes.forEach(p => {
    const m = p.trim().match(/^(\d+)\./);
    if (m) {
      ordenes.push(Number(m[1]));
    }
  });
  return ordenes;
}

function extraerValorAusenciaPrevio(textoColumnaL) {
  const str = String(textoColumnaL || '');
  const m = str.match(/\[ValAus:([0-9.]+)\]/);
  if (m && !isNaN(parseFloat(m[1]))) {
    return parseFloat(m[1]);
  }
  return 0.5;
}

function obtenerTodosLosCursos(ss) {
  return ss.getSheets()
    .map(s => s.getName())
    .filter(nombre =>
      nombre !== HOJA_HISTORIAL_ASISTENCIA &&
      nombre !== HOJA_HORARIOS_PARTE &&
      nombre !== HOJA_USUARIOS
    );
}

function obtenerListaCursos(ss, userObj) {
  const todos = obtenerTodosLosCursos(ss);
  if (!userObj || userObj.accesoTotal || esAdminODirectivo(userObj)) {
    return todos;
  }
  const permitidosLower = (userObj.cursosPermitidos || []).map(c => c.toLowerCase());
  if (permitidosLower.indexOf('todos') !== -1) return todos;

  return todos.filter(c => permitidosLower.indexOf(c.toLowerCase()) !== -1);
}

function obtenerOCrearHojaHorarios(ss) {
  let hoja = ss.getSheetByName(HOJA_HORARIOS_PARTE);
  if (!hoja) {
    hoja = ss.insertSheet(HOJA_HORARIOS_PARTE);
    hoja.getRange(1, 1, 1, 11).setValues([[
      'Curso', 'Día', 'Horario', 'Turno', 'Grupo',
      'Materia', 'Profesor/a', 'Modalidad',
      'Preceptor TM', 'Preceptor TT', 'Preceptor TV'
    ]])
      .setBackground('#0f172a')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    hoja.setFrozenRows(1);
  }
  return hoja;
}

function obtenerSemillaHorario5to6ta() {
  return [
    { dia: 'LUNES', horario: '07:40 A 11:50', turno: 'TM - Taller', grupo: 'Gr.E', materia: 'MAQ. ELEC. Y AUT.', profesor: 'OLIVERA (GR E)', modalidad: 'TALLER' },
    { dia: 'LUNES', horario: '13:00 A 15:00', turno: 'TT - Teoría', grupo: 'Teo', materia: 'ANÁLISIS MAT.', profesor: 'FERRARO S.', modalidad: 'TEORIA' },
    { dia: 'LUNES', horario: '15:10 A 17:10', turno: 'TT - Teoría', grupo: 'Teo', materia: 'INGLÉS', profesor: 'ALVELO C.', modalidad: 'TEORIA' },
    { dia: 'LUNES', horario: '18:20 A 22:20', turno: 'TV - Taller', grupo: 'Gr.F', materia: 'MAQ. ELEC. Y AUT.', profesor: 'UMAÑO (GR F)', modalidad: 'TALLER' },
    { dia: 'MARTES', horario: '13:00 A 15:00', turno: 'TT - Teoría', grupo: 'Teo', materia: 'GEOGRAFÍA', profesor: 'EUSEBIO', modalidad: 'TEORIA' },
    { dia: 'MARTES', horario: '15:10 A 18:15', turno: 'TT - Teoría', grupo: 'Teo', materia: 'MEC. Y MEC.', profesor: 'AQUINO L.', modalidad: 'TEORIA' },
    { dia: 'MARTES', horario: '18:20 A 20:20', turno: 'TV - Taller', grupo: 'Gr.F', materia: 'MAQ. ELEC. Y AUT.', profesor: 'UMAÑO (GR F)', modalidad: 'TALLER' },
    { dia: 'MIÉRCOLES', horario: '13:00 A 15:00', turno: 'TT - Teoría', grupo: 'Teo', materia: 'HISTORIA', profesor: 'MANZIONE', modalidad: 'TEORIA' },
    { dia: 'MIÉRCOLES', horario: '15:10 A 19:10', turno: 'TT/TV - Taller', grupo: 'Gr.E', materia: 'DISE. Y PRC. MEC.', profesor: 'ARNEDO (GR E)', modalidad: 'TALLER' },
    { dia: 'MIÉRCOLES', horario: '17:30 A 21:30', turno: 'TV - Taller', grupo: 'Gr.F', materia: 'DISE. Y PRC. MEC.', profesor: 'LAVIA (GR F)', modalidad: 'TALLER' },
    { dia: 'JUEVES', horario: '07:40 A 11:40', turno: 'TM - Taller', grupo: 'Gr.F', materia: 'INST. Y AP. ENERG.', profesor: 'FANTINI (GR F)', modalidad: 'TALLER' },
    { dia: 'JUEVES', horario: '13:00 A 15:00', turno: 'TT - Teoría', grupo: 'Teo', materia: 'LITERATURA', profesor: 'SANTONI D.', modalidad: 'TEORIA' },
    { dia: 'JUEVES', horario: '15:10 A 17:10', turno: 'TT - Teoría', grupo: 'Teo', materia: 'POL. Y CIUD.', profesor: 'DE LUCCA', modalidad: 'TEORIA' },
    { dia: 'JUEVES', horario: '18:00 A 20:00', turno: 'TV - Taller', grupo: 'Gr.E', materia: 'INST. Y AP. ENERG.', profesor: 'SUPL. ÁLVAREZ H. (E)', modalidad: 'TALLER' },
    { dia: 'VIERNES', horario: '08:30 A 11:40', turno: 'TM - Teoría', grupo: 'Teo', materia: 'RES. Y ENS. MAT.', profesor: 'MOAURO', modalidad: 'TEORIA' },
    { dia: 'VIERNES', horario: '13:00 A 15:00', turno: 'TT - Teoría', grupo: 'Teo', materia: 'ELECTROTECNIA', profesor: 'ALBARRACÍN J.', modalidad: 'TEORIA' },
    { dia: 'VIERNES', horario: '15:10 A 17:10', turno: 'TT - Teoría', grupo: 'Teo', materia: 'ANÁLISIS MAT.', profesor: 'FERRARO S.', modalidad: 'TEORIA' },
    { dia: 'VIERNES', horario: '17:15 A 18:15', turno: 'TT - Teoría', grupo: 'Teo', materia: 'ELECTROTECNIA', profesor: 'ALBARRACÍN J.', modalidad: 'TEORIA' },
    { dia: 'VIERNES', horario: '18:20 A 20:20', turno: 'TV - Taller', grupo: 'Gr.E', materia: 'INST. Y AP. ENERG.', profesor: 'SUPL. ÁLVAREZ H. (E)', modalidad: 'TALLER' }
  ];
}

function obtenerHorarioParteCurso(ss, nombreCurso) {
  const hoja = obtenerOCrearHojaHorarios(ss);
  let datos = hoja.getDataRange().getValues();

  const cursoNorm = String(nombreCurso || '').trim();
  let tieneFilasCurso = false;

  for (let i = 1; i < datos.length; i++) {
    if (String(datos[i][0] || '').trim() === cursoNorm) {
      tieneFilasCurso = true;
      break;
    }
  }

  if (!tieneFilasCurso && (cursoNorm === '5to_6ta' || cursoNorm.toLowerCase() === '5to 6ta')) {
    const semilla = obtenerSemillaHorario5to6ta();
    const filasNuevas = semilla.map(b => [
      cursoNorm, b.dia, b.horario, b.turno, b.grupo,
      b.materia, b.profesor, b.modalidad,
      '___________', 'VENANCIO MARCELO', '___________'
    ]);
    const filaInicio = hoja.getLastRow() + 1;
    hoja.getRange(filaInicio, 1, filasNuevas.length, 11).setValues(filasNuevas);
    datos = hoja.getDataRange().getValues();
  }

  const bloques = [];
  let preceptores = {
    tm: '___________',
    tt: 'VENANCIO MARCELO',
    tv: '___________'
  };

  for (let r = 1; r < datos.length; r++) {
    const f = datos[r];
    if (String(f[0] || '').trim() !== cursoNorm) continue;

    const dia = String(f[1] || '').trim().toUpperCase();
    const horario = String(f[2] || '').trim();
    const turno = String(f[3] || '').trim();
    const grupo = String(f[4] || '').trim();
    const materia = String(f[5] || '').trim();
    const profesor = String(f[6] || '').trim();
    const modalidad = String(f[7] || 'TEORIA').trim().toUpperCase();

    if (f[8] && String(f[8]).trim()) preceptores.tm = String(f[8]).trim();
    if (f[9] && String(f[9]).trim()) preceptores.tt = String(f[9]).trim();
    if (f[10] && String(f[10]).trim()) preceptores.tv = String(f[10]).trim();

    if (dia && (materia || horario)) {
      bloques.push({
        filaConfig: r + 1,
        dia: dia,
        horario: horario,
        turno: turno,
        grupo: grupo || (modalidad === 'TALLER' ? 'Taller' : 'Teo'),
        materia: materia,
        profesor: profesor,
        modalidad: modalidad,
        esTaller: modalidad === 'TALLER' || turno.toLowerCase().indexOf('taller') !== -1
      });
    }
  }

  return {
    preceptores: preceptores,
    bloques: bloques
  };
}

function guardarHorarioParteCurso(nombreCurso, preceptores, bloques, sincronizarMateriasPlanilla, userObj) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = obtenerOCrearHojaHorarios(ss);
  const cursoNorm = String(nombreCurso || '').trim();
  if (!cursoNorm) throw new Error('Nombre de curso inválido.');

  const datos = hoja.getDataRange().getValues();
  for (let r = datos.length - 1; r >= 1; r--) {
    if (String(datos[r][0] || '').trim() === cursoNorm) {
      hoja.deleteRow(r + 1);
    }
  }

  const precTM = (preceptores && preceptores.tm) ? String(preceptores.tm).trim() : '___________';
  const precTT = (preceptores && preceptores.tt) ? String(preceptores.tt).trim() : '___________';
  const precTV = (preceptores && preceptores.tv) ? String(preceptores.tv).trim() : '___________';

  const listaBloques = Array.isArray(bloques) ? bloques : [];
  if (listaBloques.length > 0) {
    const filasInsertar = listaBloques.map(b => {
      const mod = (b.modalidad || (b.esTaller ? 'TALLER' : 'TEORIA')).toString().trim().toUpperCase();
      return [
        cursoNorm,
        String(b.dia || 'LUNES').trim().toUpperCase(),
        String(b.horario || '').trim(),
        String(b.turno || 'TT - Teoría').trim(),
        String(b.grupo || (mod === 'TALLER' ? 'Gr.1' : 'Teo')).trim(),
        String(b.materia || '').trim().toUpperCase(),
        String(b.profesor || '').trim().toUpperCase(),
        mod,
        precTM,
        precTT,
        precTV
      ];
    });
    const filaInicio = hoja.getLastRow() + 1;
    hoja.getRange(filaInicio, 1, filasInsertar.length, 11).setValues(filasInsertar);
  } else {
    hoja.appendRow([cursoNorm, '', '', '', '', '', '', 'TEORIA', precTM, precTT, precTV]);
  }

  if (sincronizarMateriasPlanilla && listaBloques.length > 0) {
    sincronizarMateriasDesdeHorario(cursoNorm, listaBloques, userObj);
  }

  return obtenerDatosCurso(cursoNorm, userObj);
}

function agregarBloqueHorarioCurso(nombreCurso, bloque, preceptores, userObj) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = obtenerOCrearHojaHorarios(ss);
  const cursoNorm = String(nombreCurso || '').trim();
  if (!cursoNorm || !bloque) throw new Error('Faltan datos del bloque horario.');

  const actual = obtenerHorarioParteCurso(ss, cursoNorm);
  const precTM = (preceptores && preceptores.tm) ? preceptores.tm : actual.preceptores.tm;
  const precTT = (preceptores && preceptores.tt) ? preceptores.tt : actual.preceptores.tt;
  const precTV = (preceptores && preceptores.tv) ? preceptores.tv : actual.preceptores.tv;

  const mod = (bloque.modalidad || (bloque.esTaller ? 'TALLER' : 'TEORIA')).toString().trim().toUpperCase();

  hoja.appendRow([
    cursoNorm,
    String(bloque.dia || 'LUNES').trim().toUpperCase(),
    String(bloque.horario || '').trim(),
    String(bloque.turno || 'TT - Teoría').trim(),
    String(bloque.grupo || (mod === 'TALLER' ? 'Gr.1' : 'Teo')).trim(),
    String(bloque.materia || '').trim().toUpperCase(),
    String(bloque.profesor || '').trim().toUpperCase(),
    mod,
    precTM,
    precTT,
    precTV
  ]);

  return obtenerDatosCurso(cursoNorm, userObj);
}

function eliminarBloqueHorarioCurso(nombreCurso, filaConfig, userObj) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = obtenerOCrearHojaHorarios(ss);
  const numFila = Number(filaConfig);
  if (numFila > 1 && numFila <= hoja.getLastRow()) {
    hoja.deleteRow(numFila);
  }
  return obtenerDatosCurso(nombreCurso, userObj);
}

function sincronizarMateriasDesdeHorario(nombreCurso, listaBloques, userObj) {
  const info = obtenerDatosCurso(nombreCurso, userObj);
  const existentes = (info.materias || []).map(m =>
    String(m.nombre || '').replace(/^Materia\s*\d+\s*:\s*/i, '').trim().toLowerCase()
  );

  const materiasNuevas = [];
  listaBloques.forEach(b => {
    const nom = String(b.materia || '').trim().replace(/\.+$/, '').trim();
    if (!nom) return;
    const nomLow = nom.toLowerCase();
    if (existentes.indexOf(nomLow) === -1 && materiasNuevas.map(x => x.toLowerCase()).indexOf(nomLow) === -1) {
      materiasNuevas.push(nom);
    }
  });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(nombreCurso);
  let idxGenerica = 0;
  const genericas = (info.materias || []).filter(m => /^Materia\s*\d+$/i.test(String(m.nombre || '').trim()));

  materiasNuevas.forEach(nuevaMat => {
    if (idxGenerica < genericas.length) {
      sheet.getRange(1, genericas[idxGenerica].columnaInicio).setValue(nuevaMat);
      idxGenerica++;
    } else {
      agregarMateria(nombreCurso, nuevaMat, userObj);
    }
  });
}

function obtenerDatosCurso(nombreCurso, userObj) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cursos = obtenerListaCursos(ss, userObj);
  const todosLosCursos = obtenerTodosLosCursos(ss);

  if (cursos.length === 0) {
    throw new Error('Tu usuario no tiene cursos asignados o aún no hay cursos creados en la planilla.');
  }

  const cursoActual = (nombreCurso && cursos.indexOf(nombreCurso) !== -1) ? nombreCurso : cursos[0];
  const sheet = ss.getSheetByName(cursoActual);
  const valores = sheet.getDataRange().getValues();
  const horarioParte = obtenerHorarioParteCurso(ss, cursoActual);

  const infoUsuarioActual = userObj ? {
    usuario: userObj.usuario,
    nombre: userObj.nombre,
    rol: userObj.rol,
    accesoTotal: userObj.accesoTotal,
    cursosPermitidos: userObj.cursosPermitidos
  } : null;

  const listaUsuariosAdmin = esAdminODirectivo(userObj) ? listarUsuariosSistema(ss) : [];

  if (valores.length < 2) {
    return {
      cursoActual: cursoActual,
      cursos: cursos,
      cursosTotales: todosLosCursos,
      usuarioActual: infoUsuarioActual,
      usuariosSistema: listaUsuariosAdmin,
      esCicloBasico: esCursoCicloBasico(cursoActual),
      materias: [],
      estudiantes: [],
      columnasInasistencias: null,
      historialAsistencias: obtenerHistorialAsistenciasCurso(ss, cursoActual),
      horarioParte: horarioParte
    };
  }

  const filaEncabezado1 = valores[0];
  const filaEncabezado2 = valores[1];

  const materias = [];
  let colInicioInasistencias = -1;

  let col = 4;
  let indiceMat = 0;

  while (col < filaEncabezado1.length) {
    const titulo1 = String(filaEncabezado1[col] || '').trim();
    const titulo2 = String(filaEncabezado2[col] || '').trim();

    if (
      titulo1.toLowerCase().indexOf('inasistencia') !== -1 ||
      titulo2.toLowerCase() === 'marzo'
    ) {
      colInicioInasistencias = col + 1;
      break;
    }

    if (titulo1 !== '') {
      materias.push({
        indice: indiceMat,
        nombre: titulo1,
        columnaInicio: col + 1,
        esSubTallerCB: esModuloSubTallerCB(titulo1),
        esResumenTallerCB: esColumnaResumenTallerCB(titulo1)
      });
      indiceMat++;
      col += 6;
    } else {
      col++;
    }
  }

  let mapaMeses = null;
  if (colInicioInasistencias !== -1) {
    mapaMeses = {};
    for (let m = 0; m < MESES_NOMBRES.length; m++) {
      mapaMeses[MESES_NOMBRES[m]] = colInicioInasistencias + m;
    }
    mapaMeses['Total'] = colInicioInasistencias + 10;
  }

  const clavesSub = ['val1', 'cal1', 'val2', 'cal2', 'int1', 'final'];
  const estudiantes = [];

  for (let r = 2; r < valores.length; r++) {
    const fila = valores[r];
    const nombreAlu = String(fila[1] || '').trim();
    if (!nombreAlu) continue;

    const notasPorMateria = {};
    materias.forEach(mat => {
      const baseIdx = mat.columnaInicio - 1;
      const objNotas = {};
      clavesSub.forEach((k, offset) => {
        objNotas[k] = fila[baseIdx + offset] !== undefined && fila[baseIdx + offset] !== null
          ? String(fila[baseIdx + offset]).trim()
          : '';
      });
      notasPorMateria[mat.indice] = objNotas;
    });

    const inasistencias = { meses: {}, total: 0 };
    if (mapaMeses) {
      let sumaAnual = 0;
      MESES_NOMBRES.forEach(mes => {
        const idxMes = mapaMeses[mes] - 1;
        const valNum = parseFloat(String(fila[idxMes] || '0').replace(',', '.')) || 0;
        inasistencias.meses[mes] = Math.round(valNum * 100) / 100;
        sumaAnual += valNum;
      });
      inasistencias.total = Math.round(sumaAnual * 100) / 100;
    }

    estudiantes.push({
      filaHoja: r + 1,
      orden: fila[0],
      nombre: nombreAlu,
      grupo: String(fila[2] || '').trim(),
      estado: String(fila[3] || 'Activo').trim(),
      notas: notasPorMateria,
      inasistencias: inasistencias
    });
  }

  return {
    cursoActual: cursoActual,
    cursos: cursos,
    cursosTotales: todosLosCursos,
    usuarioActual: infoUsuarioActual,
    usuariosSistema: listaUsuariosAdmin,
    esCicloBasico: esCursoCicloBasico(cursoActual),
    materias: materias,
    estudiantes: estudiantes,
    columnasInasistencias: mapaMeses,
    historialAsistencias: obtenerHistorialAsistenciasCurso(ss, cursoActual),
    horarioParte: horarioParte
  };
}

function obtenerHistorialAsistenciasCurso(ss, nombreCurso) {
  const hojaHist = ss.getSheetByName(HOJA_HISTORIAL_ASISTENCIA);
  if (!hojaHist) return [];

  const datos = hojaHist.getDataRange().getValues();
  if (datos.length <= 1) return [];

  const lista = [];
  for (let i = datos.length - 1; i >= 1; i--) {
    const f = datos[i];
    if (String(f[3] || '').trim() === nombreCurso) {
      const tardanzasLimpia = String(f[11] || '').replace(/\s*\[ValAus:[0-9.]+\]/g, '').trim();
      lista.push({
        filaHistorial: i + 1,
        timestamp: formatearTimestampCelda(f[0]),
        fecha: formatearFechaCelda(f[1]),
        mes: String(f[2] || ''),
        curso: String(f[3] || ''),
        turnoGrupo: String(f[4] || ''),
        preceptor: String(f[5] || ''),
        matricula: Number(f[6] || 0),
        presentes: Number(f[7] || 0),
        ausentes: Number(f[8] || 0),
        tardes: Number(f[9] || 0),
        nominaAusentes: String(f[10] || ''),
        nominaTardes: tardanzasLimpia
      });
      if (lista.length >= 120) break;
    }
  }
  return lista;
}

function registrarAsistenciaDiaria(payload, userObj) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const curso = String(payload.curso || '').trim();
  const sheetCurso = ss.getSheetByName(curso);
  if (!sheetCurso) throw new Error('No se encontró la hoja del curso: ' + curso);

  let sheetHist = ss.getSheetByName(HOJA_HISTORIAL_ASISTENCIA);
  if (!sheetHist) {
    sheetHist = ss.insertSheet(HOJA_HISTORIAL_ASISTENCIA);
    sheetHist.appendRow([
      'Marca Temporal', 'Fecha', 'Mes', 'Curso', 'Turno / Grupo', 'Preceptor/a',
      'Matrícula', 'Presentes', 'Ausentes', 'Tardes', 'Nómina de Ausentes', 'Nómina de Tardes / Observaciones'
    ]);
  }

  const fechaTexto = formatearFechaCelda(
    payload.fechaFormateada || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy')
  );
  const mesNombre = String(payload.mes || 'Noviembre').trim();
  const turnoGrupo = String(payload.turnoGrupo || 'TT - Teoría').trim();
  const preceptor = String(payload.preceptor || (userObj ? userObj.nombre : '')).trim();
  const modalidadDia = payload.modalidadDia || 'DOBLE';
  const items = payload.registros || [];

  let valorAusencia = 0.5;
  if (modalidadDia === 'TRIPLE') valorAusencia = 0.33;
  else if (modalidadDia === 'SIMPLE') valorAusencia = 1.0;

  const infoCurso = obtenerDatosCurso(curso, userObj);
  const mapaCols = infoCurso.columnasInasistencias;
  const mapaOrdenAFilaHoja = {};
  (infoCurso.estudiantes || []).forEach(est => {
    mapaOrdenAFilaHoja[Number(est.orden)] = est.filaHoja;
  });

  const datosHist = sheetHist.getDataRange().getValues();
  const filasCoincidentes = [];

  for (let r = 1; r < datosHist.length; r++) {
    const filaH = datosHist[r];
    const fechaH = formatearFechaCelda(filaH[1]);
    const cursoH = String(filaH[3] || '').trim();
    const turnoH = String(filaH[4] || '').trim();

    if (fechaH === fechaTexto && cursoH === curso && turnoH === turnoGrupo) {
      filasCoincidentes.push({
        numeroFila: r + 1,
        mesPrevio: String(filaH[2] || mesNombre).trim(),
        nominaAusPrev: String(filaH[10] || ''),
        nominaTarPrev: String(filaH[11] || '')
      });
    }
  }

  if (filasCoincidentes.length > 0 && mapaCols) {
    filasCoincidentes.forEach(prev => {
      const colMesPrev = mapaCols[prev.mesPrevio] || mapaCols[mesNombre];
      if (!colMesPrev) return;

      const valAusPrev = extraerValorAusenciaPrevio(prev.nominaTarPrev);
      const ordenesAusPrev = extraerOrdenesDesdeNomina(prev.nominaAusPrev);
      const ordenesTarPrev = extraerOrdenesDesdeNomina(prev.nominaTarPrev);

      ordenesAusPrev.forEach(ord => {
        const filaAlu = mapaOrdenAFilaHoja[Number(ord)];
        if (filaAlu) {
          const celda = sheetCurso.getRange(filaAlu, colMesPrev);
          const actual = parseFloat(String(celda.getValue() || '0').replace(',', '.')) || 0;
          const descontado = Math.max(0, Math.round((actual - valAusPrev) * 100) / 100);
          celda.setValue(descontado);
        }
      });

      ordenesTarPrev.forEach(ord => {
        const filaAlu = mapaOrdenAFilaHoja[Number(ord)];
        if (filaAlu) {
          const celda = sheetCurso.getRange(filaAlu, colMesPrev);
          const actual = parseFloat(String(celda.getValue() || '0').replace(',', '.')) || 0;
          const descontado = Math.max(0, Math.round((actual - 0.25) * 100) / 100);
          celda.setValue(descontado);
        }
      });
    });
  }

  let contPresentes = 0;
  let contAusentes = 0;
  let contTardes = 0;
  const listaAusentesTexto = [];
  const listaTardesTexto = [];

  items.forEach(item => {
    if (item.estadoAsistencia === 'P') {
      contPresentes++;
    } else if (item.estadoAsistencia === 'A') {
      contAusentes++;
      listaAusentesTexto.push(item.orden + '. ' + item.nombre + ' (' + item.grupo + ')');
    } else if (item.estadoAsistencia === 'T') {
      contTardes++;
      listaTardesTexto.push(item.orden + '. ' + item.nombre + ' (' + item.grupo + ')');
    }
  });

  const marcaTemporal = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
  const obsExtra = payload.observaciones ? (' | Obs: ' + payload.observaciones) : '';
  const etiquetaValorAus = ' [ValAus:' + valorAusencia + ']';

  const nuevaFilaHistorial = [
    marcaTemporal,
    "'" + fechaTexto,
    mesNombre,
    curso,
    turnoGrupo,
    preceptor,
    items.length,
    contPresentes,
    contAusentes,
    contTardes,
    listaAusentesTexto.length ? listaAusentesTexto.join(' | ') : 'Sin ausentes',
    (listaTardesTexto.length ? listaTardesTexto.join(' | ') : 'Sin tardes') + obsExtra + etiquetaValorAus
  ];

  if (filasCoincidentes.length > 0) {
    const primeraFila = filasCoincidentes[0].numeroFila;
    sheetHist.getRange(primeraFila, 1, 1, nuevaFilaHistorial.length).setValues([nuevaFilaHistorial]);

    for (let k = filasCoincidentes.length - 1; k >= 1; k--) {
      sheetHist.deleteRow(filasCoincidentes[k].numeroFila);
    }
  } else {
    sheetHist.appendRow(nuevaFilaHistorial);
  }

  if (mapaCols && mapaCols[mesNombre]) {
    const colMes = mapaCols[mesNombre];
    const colTotal = mapaCols['Total'];

    items.forEach(item => {
      let incremento = 0;
      if (item.estadoAsistencia === 'A') incremento = valorAusencia;
      else if (item.estadoAsistencia === 'T') incremento = 0.25;

      if (item.filaHoja) {
        if (incremento > 0) {
          const celdaMes = sheetCurso.getRange(item.filaHoja, colMes);
          const actualMes = parseFloat(String(celdaMes.getValue() || '0').replace(',', '.')) || 0;
          const nuevoMes = Math.round((actualMes + incremento) * 100) / 100;
          celdaMes.setValue(nuevoMes);
        }

        const valoresMeses = sheetCurso.getRange(item.filaHoja, mapaCols['Marzo'], 1, 10).getValues()[0];
        let sumaTotal = 0;
        valoresMeses.forEach(v => {
          sumaTotal += parseFloat(String(v || '0').replace(',', '.')) || 0;
        });
        sheetCurso.getRange(item.filaHoja, colTotal).setValue(Math.round(sumaTotal * 100) / 100);
      }
    });
  }

  return obtenerDatosCurso(curso, userObj);
}

function actualizarCelda(nombreCurso, fila, columna, valor) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(nombreCurso);
  if (!sheet) throw new Error('No existe el curso ' + nombreCurso);

  const numFila = Number(fila);
  const numCol = Number(columna);
  asegurarColumnasSuficientes(sheet, numCol);
  sheet.getRange(numFila, numCol).setValue(valor);

  let resumenTallerActualizado = null;
  if (numCol >= 5) {
    const info = obtenerDatosCurso(nombreCurso, null);
    const matTocada = (info.materias || []).find(m =>
      numCol >= m.columnaInicio && numCol < m.columnaInicio + 6
    );
    if (matTocada && esModuloSubTallerCB(matTocada.nombre)) {
      const offset = numCol - matTocada.columnaInicio;
      resumenTallerActualizado = recalcularPromedioTallerFilaSiCorresponde(sheet, info, numFila, offset);
    }
  }

  return {
    fila: numFila,
    columna: numCol,
    valor: valor,
    resumenTaller: resumenTallerActualizado
  };
}

function actualizarNombreMateria(nombreCurso, colInicio, nuevoNombre) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(nombreCurso);
  sheet.getRange(1, Number(colInicio)).setValue(nuevoNombre);
  return { nombre: nuevoNombre };
}

function agregarEstudiante(nombreCurso, datosAlumno, userObj) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(nombreCurso);
  const ultimaFila = Math.max(sheet.getLastRow(), 2) + 1;
  sheet.getRange(ultimaFila, 1, 1, 4).setValues([[
    datosAlumno.orden,
    datosAlumno.nombre,
    datosAlumno.grupo,
    datosAlumno.estado || 'Activo'
  ]]);
  return obtenerDatosCurso(nombreCurso, userObj);
}

function agregarEstudiantesLote(nombreCurso, listaEstudiantes, userObj) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(nombreCurso);
  if (!sheet) throw new Error('No se encontró el curso: ' + nombreCurso);

  const info = obtenerDatosCurso(nombreCurso, userObj);
  let proximoOrden = (info.estudiantes || []).length + 1;
  const filasNuevas = [];

  (listaEstudiantes || []).forEach(est => {
    const nom = String(est.nombre || '').trim().toUpperCase();
    if (!nom) return;
    filasNuevas.push([
      est.orden || proximoOrden++,
      nom,
      String(est.grupo || 'Grupo 1').trim(),
      String(est.estado || 'Activo').trim()
    ]);
  });

  if (filasNuevas.length > 0) {
    const filaInicio = Math.max(sheet.getLastRow(), 2) + 1;
    sheet.getRange(filaInicio, 1, filasNuevas.length, 4).setValues(filasNuevas);
  }

  return obtenerDatosCurso(nombreCurso, userObj);
}

function agregarMateria(nombreCurso, nombreMateria, userObj) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(nombreCurso);
  const info = obtenerDatosCurso(nombreCurso, userObj);
  const ultimaMat = info.materias[info.materias.length - 1];
  const nuevaCol = ultimaMat ? (ultimaMat.columnaInicio + 6) : 5;

  sheet.insertColumnsBefore(nuevaCol, 6);
  const nombreLimpio = String(nombreMateria || '').trim().replace(/\.+$/, '').trim();

  sheet.getRange(1, nuevaCol, 1, 6).merge().setValue(nombreLimpio)
    .setBackground('#1e3a8a')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.getRange(2, nuevaCol, 1, 6).setValues([[
    '1° Val. Preliminar', 'Calificación 1°C', '2° Val. Preliminar',
    'Calificación 2°C', 'Intensificación 1°C', 'Calificación Final'
  ]]).setBackground('#dbeafe').setFontWeight('bold').setHorizontalAlignment('center');

  return obtenerDatosCurso(nombreCurso, userObj);
}

function procesarListaMateriasCurso(listaRaw, esCB) {
  const resultado = [];
  const yaTieneSubModulos = (listaRaw || []).some(m => esModuloSubTallerCB(m));

  (listaRaw || []).forEach(item => {
    const limp = String(item || '').trim().replace(/\.+$/, '').trim();
    if (!limp) return;

    if (esCB && limp.toLowerCase() === 'taller' && !yaTieneSubModulos) {
      resultado.push('Taller: Procedimientos Técnicos');
      resultado.push('Taller: Lenguajes Tecnológicos');
      resultado.push('Taller: Sistemas Tecnológicos');
      resultado.push('TALLER (Calificación General)');
    } else {
      resultado.push(limp);
    }
  });

  if (esCB && yaTieneSubModulos && !resultado.some(m => esColumnaResumenTallerCB(m))) {
    resultado.push('TALLER (Calificación General)');
  }

  return resultado;
}

function crearNuevoCurso(nombreCurso, listaMaterias, preceptores, bloquesHorario, estudiantesIniciales, forzarCicloBasico, userObj) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nombreLimpio = String(nombreCurso || '').trim().replace(/\s+/g, '_');
  if (!nombreLimpio) throw new Error('Debés indicar un nombre para el curso.');

  let sheet = ss.getSheetByName(nombreLimpio);
  if (sheet) {
    if (sheet.getLastRow() <= 2) {
      sheet.clear();
    } else {
      throw new Error('Ya existe el curso "' + nombreLimpio + '" con estudiantes cargados.');
    }
  } else {
    sheet = ss.insertSheet(nombreLimpio);
  }

  const esCB = (forzarCicloBasico !== undefined)
    ? Boolean(forzarCicloBasico)
    : esCursoCicloBasico(nombreLimpio);

  let materiasBase = Array.isArray(listaMaterias) ? listaMaterias.filter(Boolean) : [];
  if (materiasBase.length === 0 && Array.isArray(bloquesHorario) && bloquesHorario.length > 0) {
    bloquesHorario.forEach(b => {
      const m = String(b.materia || '').trim().replace(/\.+$/, '').trim();
      if (m && materiasBase.indexOf(m) === -1) {
        materiasBase.push(m);
      }
    });
  }

  if (materiasBase.length === 0) {
    if (esCB) {
      materiasBase = [
        'Prácticas del Lenguaje', 'Matemática', 'Ciencias Naturales', 'Ciencias Sociales',
        'Inglés', 'Educación Artística', 'Educación Física', 'Construcción de Ciudadanía', 'Taller'
      ];
    } else {
      materiasBase = ['Materia 1', 'Materia 2', 'Materia 3', 'Materia 4', 'Materia 5', 'Materia 6'];
    }
  }

  const materiasFinales = procesarListaMateriasCurso(materiasBase, esCB);

  const columnasTotalesNecesarias = 4 + (materiasFinales.length * 6) + 11;
  asegurarColumnasSuficientes(sheet, columnasTotalesNecesarias);

  sheet.getRange(1, 1, 1, 4).merge().setValue('Info del Alumno')
    .setBackground('#0f172a').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange(2, 1, 1, 4).setValues([['Orden', 'Alumno', 'Grupo', 'Estado']])
    .setBackground('#e2e8f0').setFontWeight('bold').setHorizontalAlignment('center');

  let col = 5;
  materiasFinales.forEach((mat, idx) => {
    let colorFondo = (idx % 2 === 0) ? '#1e3a8a' : '#0f766e';
    if (esModuloSubTallerCB(mat)) colorFondo = '#0d47a1';
    if (esColumnaResumenTallerCB(mat)) colorFondo = '#4338ca';

    sheet.getRange(1, col, 1, 6).merge().setValue(mat)
      .setBackground(colorFondo)
      .setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
    sheet.getRange(2, col, 1, 6).setValues([[
      '1° Val. Preliminar', 'Calificación 1°C', '2° Val. Preliminar',
      'Calificación 2°C', 'Intensificación 1°C', 'Calificación Final'
    ]]).setBackground('#f1f5f9').setFontWeight('bold').setHorizontalAlignment('center');
    col += 6;
  });

  sheet.getRange(1, col, 1, 11).merge().setValue('Registro de Inasistencias (Marzo a Diciembre)')
    .setBackground('#7c2d12').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange(2, col, 1, 11).setValues([[
    'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
    'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre', 'Total'
  ]]).setBackground('#ffedd5').setFontWeight('bold').setHorizontalAlignment('center');

  sheet.setFrozenRows(2);
  sheet.setFrozenColumns(4);

  if (Array.isArray(estudiantesIniciales) && estudiantesIniciales.length > 0) {
    agregarEstudiantesLote(nombreLimpio, estudiantesIniciales, userObj);
  }

  if ((Array.isArray(bloquesHorario) && bloquesHorario.length > 0) || preceptores) {
    guardarHorarioParteCurso(nombreLimpio, preceptores || {}, bloquesHorario || [], false, userObj);
  }

  return obtenerDatosCurso(nombreLimpio, userObj);
}
function eliminarCursoCompleto(nombreCurso, userObj) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(nombreCurso);
  if (!sheet) throw new Error('No se encontró el curso: ' + nombreCurso);
  ss.deleteSheet(sheet);

  const hojaHor = obtenerOCrearHojaHorarios(ss);
  const datosH = hojaHor.getDataRange().getValues();
  for (let r = datosH.length - 1; r >= 1; r--) {
    if (String(datosH[r][0] || '').trim() === nombreCurso) {
      hojaHor.deleteRow(r + 1);
    }
  }
  return obtenerDatosCurso('', userObj);
}

function eliminarMateriaCurso(nombreCurso, colInicio, userObj) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(nombreCurso);
  if (!sheet) throw new Error('No se encontró el curso: ' + nombreCurso);
  sheet.deleteColumns(Number(colInicio), 6);
  return obtenerDatosCurso(nombreCurso, userObj);
}