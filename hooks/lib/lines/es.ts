import type { ModeSource, ToolLabel, ToolNarrationMode } from '../types'
import { nameOf, SETTINGS_FILE } from './types'
import type { Messages } from './types'

const FALLBACK = 'un lector de pantalla'

const segundos = (n: number) => `${n} ${n === 1 ? 'segundo' : 'segundos'}`

const SOURCE: Record<ModeSource, string> = {
  env: 'la variable CLAUDE_AX_SCREEN_READER',
  'settings-user': 'tu archivo de configuración',
  'settings-other': 'la configuración del proyecto o administrada',
  off: 'nada',
}

const TOOLS: Record<ToolNarrationMode, string> = { off: 'desactivada', brief: 'breve', full: 'completa' }

const LABELS: Record<ToolLabel, string> = {
  tool: 'herramienta',
  'tool error': 'error de herramienta',
  'tool running': 'herramienta en curso',
  'tool interrupted': 'herramienta interrumpida',
}

function detected(reader: Parameters<Messages['question']>[0]): string {
  return reader === 'unknown' ? 'Se ha detectado un lector de pantalla.' : `${nameOf(reader, FALLBACK)} detectado.`
}

export const es: Messages = {
  readerFallback: FALLBACK,
  question: (reader) => `${detected(reader)} ¿Activar el modo lector de pantalla de Claude Code desde el próximo inicio? Pulsa s o n.`,
  enabled: () => 'Modo lector de pantalla activado desde el próximo inicio. Reinicia Claude Code ahora.',
  declined: () => 'Entendido. El modo lector de pantalla sigue desactivado. Ejecuta /a11y-on cuando quieras activarlo.',
  withdrawn: () => 'Sin respuesta. El modo lector de pantalla sigue desactivado en esta sesión.',
  answered: () => 'Respondido.',
  answerReady: () => 'Respuesta lista.',
  offDone: () => 'Modo lector de pantalla desactivado desde el próximo inicio.',
  offNothing: () => 'El modo lector de pantalla no estaba en tu archivo de configuración. No ha cambiado nada.',
  offElsewhere: () =>
    'El modo lector de pantalla está en la configuración del proyecto o administrada, no en tu archivo de configuración. No ha cambiado nada.',
  status({ detection, mode, consent }) {
    const parts: string[] = []
    if (detection === undefined) parts.push('La detección aún no se ha ejecutado.')
    else if (detection.reader !== null) parts.push(detected(detection.reader))
    else if (detection.error !== undefined) parts.push(`La detección ha fallado: ${detection.error}.`)
    else parts.push('No se ha detectado ningún lector de pantalla.')
    if (mode === undefined) parts.push('Estado del modo lector de pantalla desconocido.')
    else if (mode.on) parts.push(`Modo lector de pantalla activado por ${SOURCE[mode.source]}.`)
    else if (mode.source === 'env') {
      parts.push('Modo lector de pantalla desactivado por la variable CLAUDE_AX_SCREEN_READER. Mientras esté definida, el mod no cambia la configuración.')
    } else if (mode.userSetting === false) parts.push('Modo lector de pantalla desactivado, con valor false en tu archivo de configuración.')
    else parts.push('Modo lector de pantalla desactivado.')
    if (consent === undefined) parts.push('No hay ningún rechazo guardado.')
    else parts.push(`Rechazo guardado el ${consent.declinedAt.slice(0, 10)}, versión del mod ${consent.modVersion}.`)
    return parts.join(' ')
  },
  streamReport({ mode, source }) {
    const state = mode === 'buffered' ? 'activadas' : 'desactivadas'
    const why = source === 'override' ? 'forzado' : mode === 'buffered' ? 'modo lector de pantalla' : 'el modo lector de pantalla está desactivado'
    return `Respuestas completas ${state} (${why}).`
  },
  streamSet: (mode) =>
    mode === 'buffered'
      ? 'Respuestas completas activadas (forzado). Cada respuesta aparece de una vez y el razonamiento queda oculto.'
      : 'Respuestas completas desactivadas (forzado). Las respuestas aparecen sobre la marcha.',
  streamAuto: () => 'Forzado eliminado.',
  streamInvalid: () => 'Uso: /a11y-stream, /a11y-stream on, /a11y-stream off o /a11y-stream auto.',
  toolsReport({ mode, source }) {
    const why = source === 'override' ? 'forzado' : mode === 'off' ? 'respuestas completas' : 'las respuestas completas están desactivadas'
    return `Narración de herramientas ${TOOLS[mode]} (${why}).`
  },
  toolsSet(mode) {
    switch (mode) {
      case 'off':
        return 'Narración de herramientas desactivada (forzado). No se muestran las llamadas ni los resultados. /a11y-last sigue mostrando un resultado reciente.'
      case 'brief':
        return 'Narración de herramientas breve (forzado). Una línea por llamada y un recuento por resultado.'
      case 'full':
        return 'Narración de herramientas completa (forzado). Claude Code dibuja él mismo las filas de herramientas.'
    }
  },
  toolsAuto: () => 'Forzado eliminado.',
  toolsInvalid: () => 'Uso: /a11y-tools, /a11y-tools off, /a11y-tools brief, /a11y-tools full o /a11y-tools auto.',
  toolLabel: (label) => LABELS[label],
  resultLine: (isErrored, lines) => `${isErrored ? 'error' : 'resultado'}: ${lines} ${lines === 1 ? 'línea' : 'líneas'}`,
  heartbeat: (n) => `Sigo trabajando, ${segundos(n)}.`,
  heartbeatReport: (n) =>
    n === 0
      ? 'Señal de trabajo desactivada.'
      : `Señal de trabajo cada ${segundos(n)} de silencio mientras se prepara una respuesta, en modo lector de pantalla.`,
  heartbeatSet: (n) => (n === 0 ? 'Señal de trabajo desactivada.' : `Señal de trabajo cada ${segundos(n)} de silencio.`),
  heartbeatInvalid: () => 'Uso: /a11y-heartbeat, /a11y-heartbeat <segundos> (de 5 a 600) o /a11y-heartbeat off.',
  logReport: (on) =>
    on
      ? 'Registro de dibujo activado. Cada elemento dibujado se escribe en el registro de depuración de una sesión iniciada con claude --debug.'
      : 'Registro de dibujo desactivado.',
  logInvalid: () => 'Uso: /a11y-log, /a11y-log on o /a11y-log off.',
  lastHeader: (summary) => `Resultado de: ${summary}`,
  lastNone: () => 'Todavía no hay ningún resultado de herramienta guardado.',
  lastOutOfRange: (kept) =>
    kept === 1 ? 'Solo se guarda 1 resultado. Pide el 1.' : `Solo se guardan ${kept} resultados. Pide del 1 al ${kept}.`,
  lastInvalid: () => 'Uso: /a11y-last o /a11y-last <n>.',
  error(kind, path) {
    const fallback = `Añade a mano "axScreenReader": true en ${path ?? SETTINGS_FILE}, o define CLAUDE_AX_SCREEN_READER=1 en el perfil de tu shell.`
    switch (kind) {
      case 'no-home':
        return `No se encontró tu carpeta personal, así que no se pudo cambiar el archivo de configuración. ${fallback}`
      case 'invalid-json':
        return `No se pudo cambiar el archivo de configuración: no es JSON válido. El archivo no se ha modificado. ${fallback}`
      case 'not-an-object':
        return `No se pudo cambiar el archivo de configuración: su nivel superior no es un objeto. El archivo no se ha modificado. ${fallback}`
      case 'write-failed':
        return `No se pudo escribir el archivo de configuración. ${fallback}`
      case 'verify-mismatch':
        return `El archivo de configuración no se lee tal como se escribió. Revísalo a mano. ${fallback}`
    }
  },
  commandDescriptions: {
    'a11y-on': 'Activar el modo lector de pantalla de Claude Code desde el próximo inicio',
    'a11y-off': 'Desactivar el modo lector de pantalla de Claude Code desde el próximo inicio',
    'a11y-status': 'Indicar el lector de pantalla detectado y el estado del modo lector de pantalla',
    'a11y-stream': 'Respuestas completas: mostrar cada respuesta de una vez en lugar de sobre la marcha',
    'a11y-tools': 'Narración de herramientas: ocultar las filas, una línea por llamada o dejarlas a Claude Code',
    'a11y-last': 'Mostrar el texto completo de un resultado de herramienta reciente',
    'a11y-log': 'Registro de dibujo: escribir cada elemento dibujado en el registro de depuración',
    'a11y-heartbeat': 'Decir cada N segundos de silencio que el trabajo sigue',
  },
}
