import { Service, type Context } from '@deepseek-ai/cordis'
import { readBody, writeBody } from '../../src/body.ts'

const SOLVER_URL = new URL('./solver.ts', import.meta.url)

export class NumericSolver extends Service {
  constructor(ctx: Context) {
    super(ctx, 'solver')
  }

  solve(input: unknown): unknown {
    // <SOLVE_BODY_BEGIN>
    return input
    // <SOLVE_BODY_END>
  }

  currentBody(): Promise<string> {
    return readBody(SOLVER_URL)
  }

  install(body: string): Promise<void> {
    return writeBody(SOLVER_URL, body)
  }

  readonly description = [
    'Infer a hidden numeric function f(x) from the training examples, then implement it.',
    'The input x is a number; return the number f(x).',
  ].join(' ')

  readonly trainingExamples = [
    { input: 0, output: -5 },
    { input: 1, output: -2 },
    { input: 2, output: 7 },
    { input: 3, output: 28 },
    { input: -1, output: -8 },
    { input: -2, output: -17 },
  ]
}

export const name = 'numeric-function-solver'

export function apply(ctx: Context): void {
  ctx.plugin(NumericSolver)
}
