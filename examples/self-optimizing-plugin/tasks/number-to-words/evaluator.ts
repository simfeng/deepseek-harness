import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Solver } from '../../src/contract.ts'

// 覆盖 teens、连字符、hundreds、thousand/million 分组、组内零处理等边角。
const TEST_POINTS: ReadonlyArray<{ input: number; output: string }> = [
  { input: 0, output: 'zero' },
  { input: 5, output: 'five' },
  { input: 12, output: 'twelve' },
  { input: 19, output: 'nineteen' },
  { input: 21, output: 'twenty-one' },
  { input: 90, output: 'ninety' },
  { input: 100, output: 'one hundred' },
  { input: 105, output: 'one hundred five' },
  { input: 123, output: 'one hundred twenty-three' },
  { input: 999, output: 'nine hundred ninety-nine' },
  { input: 1000, output: 'one thousand' },
  { input: 1005, output: 'one thousand five' },
  { input: 1234, output: 'one thousand two hundred thirty-four' },
  { input: 12345, output: 'twelve thousand three hundred forty-five' },
  { input: 123456, output: 'one hundred twenty-three thousand four hundred fifty-six' },
  { input: 1000000, output: 'one million' },
  { input: 1000001, output: 'one million one' },
]

export const name = 'number-to-words-evaluator'
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
