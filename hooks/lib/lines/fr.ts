import type { ModeSource, ToolLabel, ToolNarrationMode } from '../types'
import { nameOf, SETTINGS_FILE } from './types'
import type { Messages } from './types'

const FALLBACK = 'un lecteur d’écran'

// French takes the singular for 0 and 1.
const secondes = (n: number) => `${n} ${n <= 1 ? 'seconde' : 'secondes'}`
const lignes = (n: number) => `${n} ${n <= 1 ? 'ligne' : 'lignes'}`

const SOURCE: Record<ModeSource, string> = {
  env: 'la variable CLAUDE_AX_SCREEN_READER',
  'settings-user': 'votre fichier de réglages',
  'settings-other': 'les réglages du projet ou gérés',
  off: 'rien',
}

const TOOLS: Record<ToolNarrationMode, string> = { off: 'désactivée', brief: 'brève', full: 'complète' }

const LABELS: Record<ToolLabel, string> = {
  tool: 'outil',
  'tool error': 'erreur d’outil',
  'tool running': 'outil en cours',
  'tool interrupted': 'outil interrompu',
}

function detected(reader: Parameters<Messages['question']>[0]): string {
  return reader === 'unknown' ? 'Un lecteur d’écran a été détecté.' : `${nameOf(reader, FALLBACK)} détecté.`
}

export const fr: Messages = {
  readerFallback: FALLBACK,
  question: (reader) => `${detected(reader)} Activer le mode lecteur d’écran de Claude Code au prochain démarrage ? Appuyez sur o ou n.`,
  enabled: () => 'Earshot activé. Vos réglages précédents sont enregistrés. À partir du prochain démarrage, le mode lecteur d’écran est activé et les astuces sont masquées. Redémarrez Claude Code maintenant.',
  declined: () => 'Entendu. Le mode lecteur d’écran reste désactivé. Lancez /earshot-on à tout moment pour l’activer.',
  withdrawn: () => 'Pas de réponse. Le mode lecteur d’écran reste désactivé pour cette session.',
  answered: () => 'Répondu.',
  answerReady: () => 'Réponse prête.',
  offDone: () => 'Earshot désactivé. Les réglages modifiés sont rétablis à partir du prochain démarrage.',
  offAlready: () => 'Earshot est déjà désactivé. Rien n’a changé.',
  offElsewhere: () => 'Le mode lecteur d’écran reste activé : il est défini dans les réglages du projet ou gérés, ou par la variable CLAUDE_AX_SCREEN_READER.',
  status({ active, detection, mode, consent }) {
    const parts: string[] = [active ? 'Earshot activé.' : 'Earshot désactivé.']
    if (detection === undefined) parts.push('La détection n’a pas encore eu lieu.')
    else if (detection.reader !== null) parts.push(detected(detection.reader))
    else if (detection.error !== undefined) parts.push(`La détection a échoué : ${detection.error}.`)
    else parts.push('Aucun lecteur d’écran détecté.')
    if (mode === undefined) parts.push('État du mode lecteur d’écran inconnu.')
    else if (mode.on) parts.push(`Mode lecteur d’écran activé par ${SOURCE[mode.source]}.`)
    else if (mode.source === 'env') {
      parts.push('Mode lecteur d’écran désactivé par la variable CLAUDE_AX_SCREEN_READER. Tant qu’elle est définie, le mod ne modifie pas les réglages.')
    } else if (mode.userSetting === false) parts.push('Mode lecteur d’écran désactivé, réglé sur false dans votre fichier de réglages.')
    else parts.push('Mode lecteur d’écran désactivé.')
    if (consent === undefined) parts.push('Aucun refus enregistré.')
    else parts.push(`Refus enregistré le ${consent.declinedAt.slice(0, 10)}, version du mod ${consent.modVersion}.`)
    return parts.join(' ')
  },
  streamReport({ mode, source }) {
    const state = mode === 'buffered' ? 'activées' : 'désactivées'
    const why = source === 'override' ? 'forcé' : mode === 'buffered' ? 'mode lecteur d’écran' : 'le mode lecteur d’écran est désactivé'
    return `Réponses entières ${state} (${why}).`
  },
  streamSet: (mode) =>
    mode === 'buffered'
      ? 'Réponses entières activées (forcé). Chaque réponse apparaît d’un bloc, la réflexion est masquée.'
      : 'Réponses entières désactivées (forcé). Les réponses s’affichent au fil de l’eau.',
  streamAuto: () => 'Forçage supprimé.',
  streamInvalid: () => 'Utilisation : /earshot-stream, /earshot-stream on, /earshot-stream off ou /earshot-stream auto.',
  toolsReport({ mode, source }) {
    const why = source === 'override' ? 'forcé' : mode === 'off' ? 'réponses entières' : 'les réponses entières sont désactivées'
    return `Narration des outils ${TOOLS[mode]} (${why}).`
  },
  toolsSet(mode) {
    switch (mode) {
      case 'off':
        return 'Narration des outils désactivée (forcé). Les appels d’outils et leurs résultats ne sont pas affichés. /earshot-last affiche toujours un résultat récent.'
      case 'brief':
        return 'Narration des outils brève (forcé). Une ligne par appel et un nombre de lignes par résultat.'
      case 'full':
        return 'Narration des outils complète (forcé). Claude Code dessine lui-même les lignes des outils.'
    }
  },
  toolsAuto: () => 'Forçage supprimé.',
  toolsInvalid: () => 'Utilisation : /earshot-tools, /earshot-tools off, /earshot-tools brief, /earshot-tools full ou /earshot-tools auto.',
  toolLabel: (label) => LABELS[label],
  resultLine: (isErrored, lines) => `${isErrored ? 'erreur' : 'résultat'} : ${lignes(lines)}`,
  heartbeat: (n) => `Toujours au travail, ${secondes(n)}.`,
  heartbeatReport: (n) =>
    n === 0
      ? 'Signal de travail désactivé.'
      : `Signal de travail toutes les ${secondes(n)} de silence pendant la préparation d’une réponse, en mode lecteur d’écran.`,
  heartbeatSet: (n) => (n === 0 ? 'Signal de travail désactivé.' : `Signal de travail réglé sur toutes les ${secondes(n)} de silence.`),
  heartbeatInvalid: () => 'Utilisation : /earshot-heartbeat, /earshot-heartbeat <secondes> (de 5 à 600) ou /earshot-heartbeat off.',
  logReport: (on) =>
    on
      ? 'Journal de rendu activé. Chaque élément dessiné est écrit dans le journal de débogage d’une session lancée avec claude --debug.'
      : 'Journal de rendu désactivé.',
  logInvalid: () => 'Utilisation : /earshot-log, /earshot-log on ou /earshot-log off.',
  lastHeader: (summary) => `Résultat de : ${summary}`,
  lastNone: () => 'Aucun résultat d’outil enregistré pour l’instant.',
  lastOutOfRange: (kept) =>
    kept === 1 ? 'Un seul résultat est conservé. Demandez le 1.' : `Seuls ${kept} résultats sont conservés. Demandez de 1 à ${kept}.`,
  lastInvalid: () => 'Utilisation : /earshot-last ou /earshot-last <n>.',
  error(kind, path) {
    const fallback = `Ajoutez à la main "axScreenReader": true dans ${path ?? SETTINGS_FILE}, ou définissez CLAUDE_AX_SCREEN_READER=1 dans votre profil de shell.`
    switch (kind) {
      case 'no-home':
        return `Dossier personnel introuvable, le fichier de réglages n’a pas pu être modifié. ${fallback}`
      case 'invalid-json':
        return `Impossible de modifier le fichier de réglages : ce n’est pas du JSON valide. Le fichier n’a pas été modifié. ${fallback}`
      case 'not-an-object':
        return `Impossible de modifier le fichier de réglages : son niveau supérieur n’est pas un objet. Le fichier n’a pas été modifié. ${fallback}`
      case 'write-failed':
        return `Impossible d’écrire le fichier de réglages. ${fallback}`
      case 'verify-mismatch':
        return `Le fichier de réglages ne se relit pas tel qu’il a été écrit. Vérifiez-le à la main. ${fallback}`
    }
  },
  commandDescriptions: {
    'earshot-on': 'Activer Earshot : enregistrer vos réglages, activer le mode lecteur d’écran et masquer les astuces au prochain démarrage',
    'earshot-off': 'Désactiver Earshot et rétablir les réglages modifiés',
    'earshot-status': 'Indiquer le lecteur d’écran détecté et l’état du mode lecteur d’écran',
    'earshot-stream': 'Réponses entières : afficher chaque réponse d’un bloc au lieu du fil de l’eau',
    'earshot-tools': 'Narration des outils : masquer les lignes, une ligne par appel, ou les laisser à Claude Code',
    'earshot-last': 'Afficher le texte complet d’un résultat d’outil récent',
    'earshot-log': 'Journal de rendu : écrire chaque élément dessiné dans le journal de débogage',
    'earshot-heartbeat': 'Dire toutes les N secondes de silence que le travail continue',
  },
}
