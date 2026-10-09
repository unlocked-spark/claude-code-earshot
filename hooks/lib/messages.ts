import type { DetectionResult, ModeState, Reader, StoredConsent } from './types'

export function readerName(_reader: Reader): string {
  throw new Error('not implemented')
}

export const messages = {
  question(_reader: Reader): string {
    throw new Error('not implemented')
  },
  enabled(): string {
    throw new Error('not implemented')
  },
  declined(): string {
    throw new Error('not implemented')
  },
  withdrawn(): string {
    throw new Error('not implemented')
  },
  offDone(): string {
    throw new Error('not implemented')
  },
  offNothing(): string {
    throw new Error('not implemented')
  },
  offElsewhere(): string {
    throw new Error('not implemented')
  },
  status(_args: { detection: DetectionResult | undefined; mode: ModeState | undefined; consent: StoredConsent | undefined }): string {
    throw new Error('not implemented')
  },
  error(_kind: 'no-home' | 'invalid-json' | 'not-an-object' | 'write-failed' | 'verify-mismatch', _path: string | undefined): string {
    throw new Error('not implemented')
  },
}
