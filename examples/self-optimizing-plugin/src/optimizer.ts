import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-subagent'
import type { Solver } from './contract.ts'

interface FailurePoint {
  input: unknown
  expected: unknown
  actual: unknown
}

function buildPrompt(solver: Solver, currentBody: string, failures: FailurePoint[]): string {
  const examples = solver.trainingExamples
    .map(e => `- input: ${JSON.stringify(e.input)} → output: ${JSON.stringify(e.output)}`)
    .join('\n')
  const failureText = failures.length === 0
    ? '(none)'
    : failures.map(f => `solve(${JSON.stringify(f.input)}) returned ${JSON.stringify(f.actual)}, expected ${JSON.stringify(f.expected)}`).join('; ')
  return [
    'You are an optimizer for a code-synthesis task.',
    solver.description,
    '',
    'Training examples (input → output):',
    examples,
    '',
    'Current implementation of solve:',
    '```ts',
    currentBody,
    '```',
    '',
    `Failing test points reported by the evaluator: ${failureText}`,
    '',
    'Return ONLY the corrected body of solve(...) — one or more TypeScript statements, without the function signature or the surrounding marker comments.',
  ].join('\n')
}

export const name = 'optimizer'
export const inject = ['tools', 'subagents']

export function apply(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'optimize',
    description: 'Rewrite the solver body to fix the given failures, write it back to the solver file, and let HMR hot-reload it.',
    parameters: {
      failures: {
        type: 'array',
        required: true,
        description: 'Failing points from run_tests, each {input, expected, actual}.',
        items: {
          type: 'object',
          properties: {
            input: { type: 'json', required: true },
            expected: { type: 'json', required: true },
            actual: { type: 'json', required: true },
          },
          additionalProperties: false,
        },
      },
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          body: { type: 'string', required: true },
        },
        additionalProperties: false,
      },
      render: (_args, value) => [{ type: 'text', text: `installed solver body:\n${value.body}` }],
    },
    async execute(args, exec) {
      const parent = exec.agent
      if (!parent) throw new Error('optimize requires a calling agent (exec.agent was undefined)')
      const solver = ctx.get('solver') as Solver | undefined
      if (!solver) throw new Error('solver service is not loaded')
      const currentBody = await solver.currentBody()
      const run = await ctx.subagents.start('spawn', {
        label: 'optimizer',
        prompt: [{ type: 'text', text: buildPrompt(solver, currentBody, args.failures) }] as ContentBlock[],
        parent,
        signal: exec.signal,
        outputSchema: {
          type: 'object',
          properties: { body: { type: 'string' } },
          required: ['body'],
          additionalProperties: false,
        },
      })
      try {
        const result = await run.result
        if (result.stopReason !== 'completed' || result.structured === undefined) {
          throw new Error(`optimizer subagent ended abnormally: ${result.stopReason}`)
        }
        const body = (result.structured as { body: string }).body
        await solver.install(body)
        return { body }
      } finally {
        await run.dispose()
      }
    },
  }))
}
