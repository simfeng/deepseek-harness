import { Service, type Context } from '@deepseek-ai/cordis'
import { readBody, writeBody } from '../../src/body.ts'

const SOLVER_URL = new URL('./solver.ts', import.meta.url)

export class SnakeSolver extends Service {
  constructor(ctx: Context) {
    super(ctx, 'solver')
  }

  solve(input: unknown): unknown {
    // <SOLVE_BODY_BEGIN>
    const s = String(input)
    return s
      .replace(/([a-z\d])([A-Z])/g, '$1_$2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
      .toLowerCase()
    // <SOLVE_BODY_END>
  }

  currentBody(): Promise<string> {
    return readBody(SOLVER_URL)
  }

  install(body: string): Promise<void> {
    return writeBody(SOLVER_URL, body)
  }

  readonly description = [
    'Implement toSnakeCase(s): convert a camelCase string to snake_case.',
    'Insert underscores at word boundaries and lowercase everything.',
    'Handle acronyms (consecutive uppercase letters) and trailing uppercase runs.',
    'The input is always a string; return the snake_case string.',
  ].join(' ')

  readonly trainingExamples = [
    { input: 'helloWorld', output: 'hello_world' },
    { input: 'HelloWorld', output: 'hello_world' },
    { input: 'hello', output: 'hello' },
  ]
}

export const name = 'to-snake-case-solver'

export function apply(ctx: Context): void {
  ctx.plugin(SnakeSolver)
}
