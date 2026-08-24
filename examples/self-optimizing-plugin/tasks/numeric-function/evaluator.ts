import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Solver } from '../../src/contract.ts'

// 隐藏真值函数的测试点。前 6 个是训练样例，其余是隐藏点，用于逼迫归纳规则而非查表。
const TEST_POINTS: ReadonlyArray<{ input: number; output: number }> = [
  { input: 0, output: -5 },
  { input: 1, output: -2 },
  { input: 2, output: 7 },
  { input: 3, output: 28 },
  { input: -1, output: -8 },
  { input: -2, output: -17 },
  { input: 4, output: 67 },
  { input: 5, output: 130 },
  { input: -3, output: -38 },
  { input: 10, output: 1015 },
  { input: -10, output: -1025 },
]

export const name = 'numeric-function-evaluator'
export const inject = ['tools']

export function apply(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'run_tests',
    description: 'Run the current solver against the evaluation points and report failures.',
    parameters: {},
    output: {
      schema: {
        type: 'object',
        properties: {
          done: { type: 'boolean' },
          loadError: { type: 'boolean' },
          failures: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                input: { type: 'json' },
                expected: { type: 'json' },
                actual: { type: 'json' },
              },
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute() {
      const solver = ctx.get('solver') as Solver | undefined
      if (!solver) return { done: false, loadError: true, failures: [] }
      const failures: { input: unknown; expected: unknown; actual: unknown }[] = []
      for (const t of TEST_POINTS) {
        const actual = solver.solve(t.input)
        if (actual !== t.output) failures.push({ input: t.input, expected: t.output, actual })
      }
      return { done: failures.length === 0, loadError: false, failures }
    },
  }))
}
