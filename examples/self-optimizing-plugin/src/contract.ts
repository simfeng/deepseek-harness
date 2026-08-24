/**
 * 求解器契约：每个任务目录里的 `solver.ts` 提供 `ctx.solver`。
 * evaluator 与 optimizer 只认这个契约，因此换任务 = 换一个提供该契约的 solver。
 */

export interface Solver {
  /** 被优化的代码本体：给定输入，返回输出。evaluator 调用它判分。 */
  solve(input: unknown): unknown
  /** 读取当前待优化的函数体（源码文本）。 */
  currentBody(): Promise<string>
  /** 把新的函数体写回 solver 文件（HMR 热插）。 */
  install(body: string): Promise<void>
  /** 任务描述，进入 optimizer subagent 的 prompt。 */
  readonly description: string
  /** 训练样例（input → output），进入 optimizer subagent 的 prompt。 */
  readonly trainingExamples: ReadonlyArray<{ input: unknown; output: unknown }>
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    solver: Solver
  }
}
