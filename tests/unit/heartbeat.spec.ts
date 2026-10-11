import { describe, expect, it } from 'vitest'
import {
  createSilence,
  HEARTBEAT_DEFAULT_SECONDS,
  isHeartbeatSetting,
  noteVisible,
  parseHeartbeatArg,
  resolveHeartbeat,
  tick,
} from '../../hooks/lib/heartbeat'
import { messages } from '../../hooks/lib/messages'

describe('tick (AC-016)', () => {
  it('announces the silence each time it grows by the interval', () => {
    let state = createSilence(1000)
    expect(tick(state, 11000, 20).announce).toBeUndefined()
    const first = tick(state, 21050, 20)
    expect(first.announce).toBe(20)
    state = first.state
    expect(tick(state, 31000, 20).announce).toBeUndefined()
    const second = tick(state, 41200, 20)
    expect(second.announce).toBe(40)
    expect(tick(second.state, 61000, 20).announce).toBe(60)
  })
  it('restarts the silence when output appeared, and announces nothing for that tick', () => {
    let state = createSilence(0)
    state = tick(state, 15000, 20).state
    state = noteVisible(state)
    const seen = tick(state, 16000, 20)
    expect(seen.announce).toBeUndefined()
    expect(seen.state.silentSince).toBe(16000)
    expect(seen.state.seenCount).toBe(1)
    expect(tick(seen.state, 35000, 20).announce).toBeUndefined()
    expect(tick(seen.state, 36000, 20).announce).toBe(20)
  })
  it('announces nothing when the interval is 0', () => {
    expect(tick(createSilence(0), 100000, 0).announce).toBeUndefined()
  })
})

describe('setting and argument (AC-017)', () => {
  it('defaults to 10 seconds and reads a stored value', () => {
    expect(resolveHeartbeat(undefined)).toBe(HEARTBEAT_DEFAULT_SECONDS)
    expect(resolveHeartbeat({ seconds: 0, setAt: 'x' })).toBe(0)
    expect(resolveHeartbeat({ seconds: 45, setAt: 'x' })).toBe(45)
    expect(resolveHeartbeat({ seconds: -1, setAt: 'x' })).toBe(HEARTBEAT_DEFAULT_SECONDS)
    expect(resolveHeartbeat({ seconds: 2.5, setAt: 'x' })).toBe(HEARTBEAT_DEFAULT_SECONDS)
    expect(isHeartbeatSetting({ seconds: 10 })).toBe(false)
  })
  it('reads the argument within 5 to 600 seconds', () => {
    expect(parseHeartbeatArg('')).toBe('report')
    expect(parseHeartbeatArg('OFF')).toBe('off')
    expect(parseHeartbeatArg(' 30 ')).toBe(30)
    expect(parseHeartbeatArg('5')).toBe(5)
    expect(parseHeartbeatArg('600')).toBe(600)
    expect(parseHeartbeatArg('4')).toBe('invalid')
    expect(parseHeartbeatArg('601')).toBe('invalid')
    expect(parseHeartbeatArg('on')).toBe('invalid')
    expect(parseHeartbeatArg('1e3')).toBe('invalid')
  })
  it('has the reply lines', () => {
    expect(messages.heartbeat(40)).toBe('Still working, 40 seconds.')
    expect(messages.heartbeatReport(0)).toBe('Heartbeat off.')
    expect(messages.heartbeatReport(20)).toBe('Heartbeat every 20 seconds of silence while an answer is being prepared, in screen reader mode.')
    expect(messages.heartbeatSet(0)).toBe('Heartbeat off.')
    expect(messages.heartbeatSet(30)).toBe('Heartbeat set to every 30 seconds of silence.')
    expect(messages.heartbeatInvalid()).toBe('Usage: /earshot-heartbeat, /earshot-heartbeat <seconds> (5 to 600), or /earshot-heartbeat off.')
  })
})
