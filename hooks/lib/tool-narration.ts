import type { LastResultEntry, ToolFlags, ToolLabel } from './types'

export const SUMMARY_LIMIT = 60

export type LastResults = {
  note(id: string, summary: string): void
  put(entry: { id: string; text: string; fallbackSummary: string }): void
  get(n: number): LastResultEntry | undefined
  size(): number
}

export function describeToolUse(_tool: string, _input: unknown): string {
  throw new Error('not implemented')
}

export function labelFor(_flags: ToolFlags): ToolLabel {
  throw new Error('not implemented')
}

export function summaryLine(_flags: ToolFlags, _tool: string, _input: unknown): string {
  throw new Error('not implemented')
}

export function textOfResult(_tool: string, _output: unknown): string {
  throw new Error('not implemented')
}

export function countLines(_text: string): number {
  throw new Error('not implemented')
}

export function resultLine(_isErrored: boolean, _lines: number): string {
  throw new Error('not implemented')
}

export function parseLastArg(_args: string): number | 'invalid' {
  throw new Error('not implemented')
}

export function createLastResults(_limit: number): LastResults {
  throw new Error('not implemented')
}
