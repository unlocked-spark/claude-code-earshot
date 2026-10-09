import { describe, expect, it } from 'vitest'
import {
  DARWIN_ARGV,
  DETECTION_BUDGET_MS,
  detect,
  parsePgrep,
  parseProcessList,
  parseSpiFlag,
  platformFromEnv,
  WINDOWS_PROCESS_LIST_ARGV,
  WINDOWS_SPI_ARGV,
} from '../../hooks/lib/detect'
import type { RunResult, Runner } from '../../hooks/lib/types'

const ok = (stdout: string): RunResult => ({ exitCode: 0, stdout, stderr: '' })
const fail = (code = 1): RunResult => ({ exitCode: code, stdout: '', stderr: '' })

function runner(answers: Record<string, RunResult | Error>, calls: { argv: readonly string[]; timeoutMs?: number }[] = []): Runner {
  return async (argv, init) => {
    calls.push({ argv, timeoutMs: init?.timeoutMs })
    const key = argv[0] ?? ''
    const answer = answers[key]
    if (answer === undefined) throw new Error(`unexpected command ${argv.join(' ')}`)
    if (answer instanceof Error) throw answer
    return answer
  }
}

describe('platformFromEnv (AC-001)', () => {
  it('reads Windows from the OS variable', () => {
    expect(platformFromEnv('Windows_NT', undefined)).toBe('win32')
  })
  it('reads macOS from uname', () => {
    expect(platformFromEnv(undefined, 'Darwin\n')).toBe('darwin')
  })
  it('treats anything else as other', () => {
    expect(platformFromEnv(undefined, 'Linux\n')).toBe('other')
    expect(platformFromEnv(undefined, undefined)).toBe('other')
  })
})

describe('parsePgrep (AC-001)', () => {
  it('is true when pgrep exits 0 with a pid', () => {
    expect(parsePgrep(ok('4242\n'))).toBe(true)
  })
  it('is false when pgrep finds nothing', () => {
    expect(parsePgrep(fail(1))).toBe(false)
  })
  it('is false when exit 0 carries no pid', () => {
    expect(parsePgrep(ok(''))).toBe(false)
  })
})

describe('parseProcessList (AC-001, edge cases)', () => {
  it('finds NVDA', () => {
    expect(parseProcessList('nvda\r\n')).toBe('nvda')
  })
  it('finds JAWS by its process name jfw', () => {
    expect(parseProcessList('jfw\r\n')).toBe('jaws')
  })
  it('prefers NVDA when both run', () => {
    expect(parseProcessList('jfw\r\nnvda\r\n')).toBe('nvda')
  })
  it('ignores garbage and empty output', () => {
    expect(parseProcessList('')).toBeNull()
    expect(parseProcessList('explorer\r\nnvda-helper\r\n')).toBeNull()
  })
})

describe('parseSpiFlag', () => {
  it('reads PowerShell booleans', () => {
    expect(parseSpiFlag('True\r\n')).toBe(true)
    expect(parseSpiFlag('False\r\n')).toBe(false)
    expect(parseSpiFlag('')).toBe(false)
  })
})

describe('detect (AC-001)', () => {
  it('reports VoiceOver on macOS through pgrep', async () => {
    const calls: { argv: readonly string[]; timeoutMs?: number }[] = []
    let t = 1000
    const result = await detect({ platform: 'darwin', run: runner({ pgrep: ok('77\n') }, calls), now: () => (t += 150) })
    expect(result).toMatchObject({ platform: 'darwin', reader: 'voiceover', method: 'pgrep' })
    expect(result.durationMs).toBe(150)
    expect(calls[0]?.argv).toEqual(DARWIN_ARGV)
    expect(calls[0]?.timeoutMs).toBeLessThanOrEqual(DETECTION_BUDGET_MS)
  })

  it('reports no reader when VoiceOver is off', async () => {
    const result = await detect({ platform: 'darwin', run: runner({ pgrep: fail(1) }), now: () => 0 })
    expect(result).toMatchObject({ reader: null, method: 'pgrep' })
  })

  it('reports NVDA on Windows from the process list', async () => {
    const calls: { argv: readonly string[] }[] = []
    const result = await detect({ platform: 'win32', run: runner({ powershell: ok('nvda\r\n') }, calls), now: () => 0 })
    expect(result).toMatchObject({ reader: 'nvda', method: 'process-list' })
    expect(calls[0]?.argv).toEqual(WINDOWS_PROCESS_LIST_ARGV)
    expect(calls).toHaveLength(1)
  })

  it('falls back to the system flag and reports an unknown reader', async () => {
    let n = 0
    const run: Runner = async (argv) => {
      n += 1
      expect(argv).toEqual(n === 1 ? WINDOWS_PROCESS_LIST_ARGV : WINDOWS_SPI_ARGV)
      return n === 1 ? ok('') : ok('True\r\n')
    }
    const result = await detect({ platform: 'win32', run, now: () => 0 })
    expect(result).toMatchObject({ reader: 'unknown', method: 'spi-flag' })
  })

  it('reports nothing when the flag is off', async () => {
    const result = await detect({ platform: 'win32', run: runner({ powershell: ok('False\r\n') }), now: () => 0 })
    expect(result).toMatchObject({ reader: null, method: 'spi-flag' })
  })

  it('does not run anything on other platforms', async () => {
    const calls: { argv: readonly string[] }[] = []
    const result = await detect({ platform: 'other', run: runner({}, calls), now: () => 0 })
    expect(result).toMatchObject({ platform: 'other', reader: null, method: 'none' })
    expect(calls).toHaveLength(0)
  })

  it('records a failed probe as an error and no reader', async () => {
    const result = await detect({ platform: 'darwin', run: runner({ pgrep: new Error('spawn pgrep ENOENT') }), now: () => 0 })
    expect(result).toMatchObject({ reader: null, method: 'none' })
    expect(result.error).toMatch(/ENOENT/)
  })
})
