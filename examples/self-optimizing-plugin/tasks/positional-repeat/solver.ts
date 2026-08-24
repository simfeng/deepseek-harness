import { Service, type Context } from '@deepseek-ai/cordis'
import { readBody, writeBody } from '../../src/body.ts'

const SOLVER_URL = new URL('./solver.ts', import.meta.url)

export class PositionalRepeatSolver extends Service {
  constructor(ctx: Context) {
    super(ctx, 'solver')
  }

  solve(input: unknown): unknown {
    // <SOLVE_BODY_BEGIN>
    return input.split('').map((c, i) => c.repeat(i + 1)).join('')
    // <SOLVE_BODY_END>
  }

  currentBody(): Promise<string> {
    return readBody(SOLVER_URL)
  }

  install(body: string): Promise<void> {
    return writeBody(SOLVER_URL, body)
  }

  readonly description = [
    'Infer the hidden string transformation from the training examples, then implement solve(input) to apply it.',
    'The input is always a string; return the transformed string.',
  ].join(' ')

  // 刻意给「歧义」样例：看起来像“最后一个字符翻倍”，诱导错误的第一次猜测；
  // 隐藏测试点会揭示真正的规则。
  readonly trainingExamples = [
    { input: 'ab', output: 'abb' },
    { input: 'cd', output: 'cdd' },
  ]
}

export const name = 'positional-repeat-solver'

export function apply(ctx: Context): void {
  ctx.plugin(PositionalRepeatSolver)
}
