import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Solver } from '../../src/contract.ts'

// 训练样例只给「基础驼峰」；缩写、连续大写、结尾大写等边角放在测试点里（隐藏），
// 逼迫 solver 归纳规则而非记住样例。
const TEST_POINTS: ReadonlyArray<{ input: string; output: string }> = [
  { input: 'helloWorld', output: 'hello_world' },
  { input: 'HelloWorld', output: 'hello_world' },
  { input: 'HTTPRequest', output: 'http_request' },
  { input: 'helloWORLD', output: 'hello_world' },
  { input: 'hello_world', output: 'hello_world' },
  { input: 'hello', output: 'hello' },
  { input: 'helloWorld123', output: 'hello_world123' },
  { input: '', output: '' },
  { input: 'ABC', output: 'abc' },
  { input: 'aB', output: 'a_b' },
  { input: 'MyXMLParser', output: 'my_xml_parser' },
]

export const name = 'to-snake-case-evaluator'
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
