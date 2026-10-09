import type { DetectionMethod, DetectionResult, Platform, Reader, RunResult, Runner } from './types'

// Every probe is one fixed command with no user-controlled arguments.
export const DETECTION_BUDGET_MS = 2000

export const DARWIN_ARGV: readonly string[] = ['pgrep', '-x', 'VoiceOver']

const POWERSHELL = ['powershell', '-NoProfile', '-NonInteractive', '-Command'] as const

export const WINDOWS_PROCESS_LIST_ARGV: readonly string[] = [
  ...POWERSHELL,
  'Get-Process nvda,jfw -ErrorAction SilentlyContinue | Select-Object -ExpandProperty ProcessName',
]

// SPI_GETSCREENREADER (70) is the flag NVDA and JAWS set while they run, even
// when their process name is not one of the two above.
export const WINDOWS_SPI_ARGV: readonly string[] = [
  ...POWERSHELL,
  'Add-Type -Namespace A11y -Name Native -MemberDefinition ' +
    "'[DllImport(\"user32.dll\")] public static extern bool SystemParametersInfo(uint a, uint b, ref bool c, uint d);'; " +
    '$on = $false; [void][A11y.Native]::SystemParametersInfo(70, 0, [ref]$on, 0); $on',
]

export function platformFromEnv(osVar: string | undefined, uname: string | undefined): Platform {
  if (osVar === 'Windows_NT') return 'win32'
  if (uname?.trim() === 'Darwin') return 'darwin'
  return 'other'
}

export function parsePgrep(result: RunResult): boolean {
  return result.exitCode === 0 && /\d/.test(result.stdout)
}

export function parseProcessList(stdout: string): Reader | null {
  const names = new Set(
    stdout
      .split(/\r?\n/)
      .map((line) => line.trim().toLowerCase())
      .filter((line) => line.length > 0),
  )
  if (names.has('nvda')) return 'nvda'
  if (names.has('jfw')) return 'jaws'
  return null
}

export function parseSpiFlag(stdout: string): boolean {
  return stdout.trim().toLowerCase() === 'true'
}

export async function detect(args: { platform: Platform; run: Runner; now: () => number }): Promise<DetectionResult> {
  const started = args.now()
  const probe = (argv: readonly string[]) => args.run(argv, { timeoutMs: DETECTION_BUDGET_MS })
  let reader: Reader | null = null
  let method: DetectionMethod = 'none'
  let error: string | undefined
  try {
    if (args.platform === 'darwin') {
      method = 'pgrep'
      reader = parsePgrep(await probe(DARWIN_ARGV)) ? 'voiceover' : null
    } else if (args.platform === 'win32') {
      method = 'process-list'
      reader = parseProcessList((await probe(WINDOWS_PROCESS_LIST_ARGV)).stdout)
      if (reader === null) {
        method = 'spi-flag'
        reader = parseSpiFlag((await probe(WINDOWS_SPI_ARGV)).stdout) ? 'unknown' : null
      }
    }
  } catch (caught) {
    reader = null
    method = 'none'
    error = caught instanceof Error ? caught.message : String(caught)
  }
  const result: DetectionResult = { platform: args.platform, reader, method, durationMs: args.now() - started }
  if (error !== undefined) result.error = error
  return result
}
