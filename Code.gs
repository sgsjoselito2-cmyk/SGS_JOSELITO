
/**
 * BACKEND - JOSELITO PRODUCTION
 * Motor de Persistencia y Sincronización v3.2 - PUNTO DE RESTAURACIÓN
 */

const TAB_ACTIVE = 'REGISTROS_ACTIVOS';
const TAB_DB = 'HISTORICO_BBDD';
const HEADERS = ['ID', 'Operario', 'Tarea', 'Tipo Tarea', 'H. Inicio', 'H. Fin', 'Duracion', 'Tipo Vent', 'Num Orden', 'Completado', 'Comentarios'];

function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Joselito Production Tracker')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}

function getSS() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("No se pudo detectar la hoja de cálculo activa.");
  return ss;
}

function getAppData() {
  try {
    const ss = getSS();
    let activeSheet = ss.getSheetByName(TAB_ACTIVE) || ss.insertSheet(TAB_ACTIVE);
    let dbSheet = ss.getSheetByName(TAB_DB) || ss.insertSheet(TAB_DB);
    
    if (activeSheet.getLastRow() === 0) {
      activeSheet.appendRow(HEADERS);
      activeSheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#f1f5f9");
    }

    const activeData = activeSheet.getDataRange().getValues();
    const historyData = dbSheet.getLastRow() > 1 ? dbSheet.getDataRange().getValues() : [];

    return {
      activities: sheetToObjects(activeData),
      history: historyData.length > 1 ? sheetToObjects(historyData) : [],
      success: true
    };
  } catch (e) {
    return { activities: [], history: [], success: false, error: e.message };
  }
}

function sheetToObjects(rows) {
  if (!rows || rows.length <= 1) return [];
  const headers = rows[0];
  const tz = Session.getScriptTimeZone();
  
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, i) => {
      let val = row[i];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, tz, (header.toLowerCase().includes('fecha')) ? "yyyy-MM-dd" : "HH:mm");
      }
      const h = String(header || "").toLowerCase().trim();
      let key = h.replace(/\s+/g, '');
      
      if (h === 'id') key = 'id';
      else if (h.includes('operario')) key = 'operario';
      else if (h === 'tarea') key = 'tarea';
      else if (h.includes('tipo tarea')) key = 'tipoTarea';
      else if (h.includes('inicio')) key = 'horaInicio';
      else if (h.includes('fin')) key = 'horaFin';
      else if (h.includes('duracion') || h === 'min') key = 'duracionMin';
      else if (h.includes('vent')) key = 'tipoVentilador';
      else if (h.includes('orden')) key = 'numOrden';
      else if (h.includes('completado') || h === 'cantidad') key = 'cantidad';
      else if (h === 'comentarios') key = 'comentarios';
      else if (h === 'fecha') key = 'fecha';
      else if (h === 'turno') key = 'turno';
      
      obj[key] = (val === undefined || val === null) ? "" : val;
    });
    return obj;
  });
}

function apiSaveActivity(activity) {
  try {
    const ss = getSS();
    const sheet = ss.getSheetByName(TAB_ACTIVE);
    const tz = Session.getScriptTimeZone();
    const now = new Date();
    const timeStr = Utilities.formatDate(now, tz, "HH:mm");
    const data = sheet.getDataRange().getValues();
    const opName = String(activity.operario || "").trim();

    if (!opName) throw new Error("Operario no especificado");

    // Cerrar tareas previas
    for (let i = data.length - 1; i >= 1; i--) {
      const rowOp = String(data[i][1]).trim();
      const rowFin = String(data[i][5]).trim();
      if (rowOp.toLowerCase() === opName.toLowerCase() && !rowFin) {
        const startTimeStr = String(data[i][4]);
        let durationMin = 0.1;
        if (startTimeStr.includes(":")) {
          const parts = startTimeStr.split(":");
          const startDateTime = new Date(now.getTime());
          startDateTime.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
          let diffMs = now.getTime() - startDateTime.getTime();
          if (diffMs < 0) diffMs += 86400000;
          durationMin = Math.max(0.1, Number((diffMs / 60000).toFixed(1)));
        }
        sheet.getRange(i + 1, 6).setValue(timeStr);
        sheet.getRange(i + 1, 7).setValue(durationMin);
        if (activity.cantidadCierre !== undefined) sheet.getRange(i + 1, 10).setValue(activity.cantidadCierre);
        if (activity.comentariosCierre !== undefined) sheet.getRange(i + 1, 11).setValue(activity.comentariosCierre);
      }
    }

    // Iniciar nueva tarea
    if (activity.id) {
      SpreadsheetApp.flush();
      sheet.appendRow([activity.id, opName, activity.tarea, activity.tipoTarea, timeStr, "", "", activity.tipoVentilador || "", activity.numOrden || "", "", ""]);
    }
    SpreadsheetApp.flush();
    return getAppData();
  } catch (e) { 
    throw new Error("ERROR SERVIDOR: " + e.message); 
  }
}

function apiFinalizeShift(p) {
  try {
    const ss = getSS();
    const activeSheet = ss.getSheetByName(TAB_ACTIVE);
    const dbSheet = ss.getSheetByName(TAB_DB);
    let rows = activeSheet.getDataRange().getValues();
    const tz = Session.getScriptTimeZone();
    const now = new Date();
    const nowTimeStr = Utilities.formatDate(now, tz, "HH:mm");
    
    if (rows.length <= 1) return getAppData();

    if (p.forceClose) {
      for (let i = 1; i < rows.length; i++) {
        if (!rows[i][5] || String(rows[i][5]).trim() === "") {
          const startTimeStr = String(rows[i][4]);
          let durationMin = 0.1;
          
          if (startTimeStr.includes(":")) {
            const parts = startTimeStr.split(":");
            const startDateTime = new Date(now.getTime());
            startDateTime.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
            
            let diffMs = now.getTime() - startDateTime.getTime();
            if (diffMs < 0) diffMs += 86400000; 
            durationMin = Math.max(0.1, Number((diffMs / 60000).toFixed(1)));
          }

          activeSheet.getRange(i + 1, 6).setValue(nowTimeStr);
          activeSheet.getRange(i + 1, 7).setValue(durationMin);
          activeSheet.getRange(i + 1, 10).setValue(0);
          activeSheet.getRange(i + 1, 11).setValue("CIERRE FORZADO");
        }
      }
      SpreadsheetApp.flush();
      rows = activeSheet.getDataRange().getValues();
    }

    const toExport = rows.slice(1).map(row => [...row, p.fecha || "", p.turno || ""]);
    dbSheet.getRange(dbSheet.getLastRow() + 1, 1, toExport.length, toExport[0].length).setValues(toExport);
    
    if (rows.length > 1) {
      activeSheet.deleteRows(2, rows.length - 1);
    }
    
    SpreadsheetApp.flush();
    return getAppData();
  } catch (e) { 
    throw new Error(e.message); 
  }
}

function apiUpdateActivity(activity) {
  try {
    const ss = getSS();
    const sheet = ss.getSheetByName(TAB_ACTIVE);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(activity.id)) {
        sheet.getRange(i + 1, 5).setValue(activity.horaInicio);
        sheet.getRange(i + 1, 6).setValue(activity.horaFin);
        sheet.getRange(i + 1, 7).setValue(activity.duracionMin);
        sheet.getRange(i + 1, 10).setValue(activity.cantidad);
        break;
      }
    }
    SpreadsheetApp.flush();
    return getAppData();
  } catch (e) { throw new Error(e.message); }
}

function apiUpdateHistoryActivity(activity) {
  try {
    const ss = getSS();
    const sheet = ss.getSheetByName(TAB_DB);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(activity.id)) {
        sheet.getRange(i + 1, 5).setValue(activity.horaInicio);
        sheet.getRange(i + 1, 6).setValue(activity.horaFin);
        sheet.getRange(i + 1, 7).setValue(activity.duracionMin);
        sheet.getRange(i + 1, 10).setValue(activity.cantidad);
        sheet.getRange(i + 1, 11).setValue(activity.comentarios);
        sheet.getRange(i + 1, 12).setValue(activity.fecha);
        sheet.getRange(i + 1, 13).setValue(activity.turno);
        break;
      }
    }
    SpreadsheetApp.flush();
    return { success: true, history: sheetToObjects(sheet.getDataRange().getValues()) };
  } catch (e) { throw new Error(e.message); }
}
