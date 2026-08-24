import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Solver } from '../../src/contract.ts'

// 规则：第 i 个字符重复 i 次（1-based）。训练样例故意诱导「末字符翻倍」的错误首猜，
// 隐藏点（abc、abcd、a、hey）逐步揭示真正的「按位置重复」规则。
const TEST_POINTS: ReadonlyArray<{ input: string; output: string }> = [
  { input: 'ab', output: 'abb' },
  { input: 'cd', output: 'cdd' },
  { input: 'abc', output: 'abbccc' },
  { input: 'abcd', output: 'abbcccdddd' },
  { input: '', output: '' },
  { input: 'a', output: 'a' },
  { input: 'xy', output: 'xyy' },
  { input: 'hey', output: 'heeyyy' },
]

export const name = 'positional-repeat-evaluator'
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
