import { describe, expect, it } from 'vitest'
import { extractBody, installBody } from '../src/body.ts'

const SOURCE = `export class Solver extends Service {
  solve(input: unknown): unknown {
    // <SOLVE_BODY_BEGIN>
    return input
    // <SOLVE_BODY_END>
  }
}
`

describe('solver body install', () => {
  it('extracts the current body between the markers', () => {
    expect(extractBody(SOURCE)).toBe('return input')
  })

  it('replaces the body while preserving the surrounding skeleton', () => {
    const next = installBody(SOURCE, 'return String(input)')
    expect(extractBody(next)).toBe('return String(input)')
    expect(next).toContain('return String(input)')
    expect(next).toContain('export class Solver extends Service')
    expect(next).not.toContain('return input')
  })

  it('rejects a source missing the region markers', () => {
    expect(() => extractBody('function solve() { return 0 }')).toThrow('SOLVE_BODY')
  })
})
