import { Service, type Context } from '@deepseek-ai/cordis'
import { readBody, writeBody } from '../../src/body.ts'

const SOLVER_URL = new URL('./solver.ts', import.meta.url)

export class NumberToWordsSolver extends Service {
  constructor(ctx: Context) {
    super(ctx, 'solver')
  }

  solve(input: unknown): unknown {
    // <SOLVE_BODY_BEGIN>
    const ones = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen']
    const tens = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety']
    const convert = (n: number): string => {
      if (n < 20) return ones[n]
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? '-' + ones[n % 10] : '')
      if (n < 1000) return ones[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + convert(n % 100) : '')
      if (n < 1000000) return convert(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '')
      return convert(Math.floor(n / 1000000)) + ' million' + (n % 1000000 ? ' ' + convert(n % 1000000) : '')
    }
    return convert(input)
    // <SOLVE_BODY_END>
  }

  currentBody(): Promise<string> {
    return readBody(SOLVER_URL)
  }

  install(body: string): Promise<void> {
    return writeBody(SOLVER_URL, body)
  }

  readonly description = [
    'Implement numberToWords(n): convert a non-negative integer to its English words representation.',
    'Use lowercase, spaces between words, and a hyphen between the tens and ones (e.g. "twenty-one").',
    'Handle zero, the teens (11-19), hundreds, and thousand/million groups.',
    'The input is a non-negative integer; return the words as a single string.',
  ].join(' ')

  readonly trainingExamples = [
    { input: 0, output: 'zero' },
    { input: 21, output: 'twenty-one' },
    { input: 123, output: 'one hundred twenty-three' },
    { input: 1000, output: 'one thousand' },
  ]
}

export const name = 'number-to-words-solver'

export function apply(ctx: Context): void {
  ctx.plugin(NumberToWordsSolver)
}
