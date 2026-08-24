# self-optimizing-plugin

一个「自我优化」闭环实验：**求解器**完成任务 → **评估器**判断是否完成 → **优化器**根据评估反馈改写求解器 → 循环，直到任务完成。

## 1. 核心思想

整个实验要表达的是这个**自我优化循环**：

- **求解器 solver**：完成任务的那段代码，是被优化的对象。
- **评估器 evaluator**：判断「任务完成没有」。确定性判分，不调模型。
- **优化器 optimizer**：唯一调模型的角色——读评估器的反馈，改写求解器。
- **循环**：求解 → 评估 → 没完成 → 优化 → 再求解 → …… 直到完成。

三个角色 + 一个循环，就是全部。两个关键性质：

1. **优化 = 改代码**：优化器的产出直接改写求解器的实现，改写后立即生效。
2. **求解器和评估器可替换**：通用件（优化器 + 循环）只认一个 `ctx.solver` 契约；换任务 = 换求解器和评估器，其余一字不动。

## 2. 架构

```text
src/                                # 共享，任务无关
  optimizer.ts    通用 optimize 工具：读 ctx.solver 契约 → 起 subagent 改代码 → 写回
  body.ts         读写 solver 文件里标记区间内的函数体
  contract.ts     ctx.solver 契约（类型 + declare module）

tasks/<任务名>/                     # 每个任务一个目录，换任务 = 换目录
  solver.ts       求解器：提供 ctx.solver
  evaluator.ts    评估器：注册 run_tests，持本任务测试点，读 ctx.solver 判分

self-opt-real*.cordis.yml           # 每个任务一个真实运行组合（include headless 基座）
self-opt.cordis.yml                 # keyless 冒烟组合（mock llm）
run.sh / reset-solver.mjs / summarize.mjs   # 一键运行 / 重置 / 提取迭代轨迹
```

### 求解器契约（`src/contract.ts`）

```ts
interface Solver {
  solve(input: unknown): unknown                      // 被优化的代码本体
  currentBody(): Promise<string>                     // 读当前函数体（源码文本）
  install(body: string): Promise<void>               // 写回函数体，立即生效
  readonly description: string                       // 任务描述（进 optimizer prompt）
  readonly trainingExamples: { input: unknown; output: unknown }[]  // 训练样例
}
```

优化器只问这个契约，所以它对「具体是什么任务」一无所知。

### 一次循环的时序

```text
主 agent
  ├─ 调 run_tests ────────► evaluator（读 ctx.solver.solve 逐点比对）──► { done, failures }
  ├─ done=false 时调 optimize(failures)
  │    └─ optimizer：读 ctx.solver.currentBody() + description + trainingExamples
  │         └─ 起一个 fresh spawn subagent（带 outputSchema:{body}）──► 新函数体
  │              └─ ctx.solver.install(body) 写回 solver ──► 立即生效
  └─ 再调 run_tests …… 直到 done=true
```

三个设计点：

- **评估器 / 优化器用 `ctx.get('solver')` 读服务**（可选依赖），而不是 `inject: ['solver']`——这样求解器被改写重载时，评估器和优化器不会跟着被卸载。
- **optimizer 是每轮一个 fresh one-shot subagent**：每次优化在一个独立短命的子会话里完成，不污染主会话上下文。
- **优化器不碰任务细节**：它通过 `ctx.solver.currentBody()/install()` 读写代码、通过契约读任务描述和样例，因此完全通用。

## 3. 目录结构

```
examples/self-optimizing-plugin/
├── README.md                        # 本文件
├── run.sh                           # 一键：重置 → 跑真实循环 → 打印迭代轨迹
├── reset-solver.mjs                 # 把某任务的 solver 重置为错误起点
├── summarize.mjs                    # 从日志提取「run_tests / optimize」迭代轨迹
├── self-opt-real*.cordis.yml        # 各任务的真实运行组合
├── self-opt.cordis.yml              # keyless 冒烟组合（mock llm）
├── src/
│   ├── contract.ts                  # ctx.solver 契约
│   ├── body.ts                      # 函数体读写（标记区间 splice）
│   └── optimizer.ts                 # 通用 optimize 工具
├── tasks/
│   ├── numeric-function/            # 任务：从样例推断数值函数
│   ├── to-snake-case/               # 任务：驼峰 → 蛇形
│   ├── positional-repeat/           # 任务：按位置重复字符
│   └── number-to-words/             # 任务：数字 → 英文单词
└── tests/
    ├── install-body.spec.ts         # installer 单测
    ├── keyless-smoke.e2e.ts         # keyless Loader 冒烟
    └── fixtures/
        ├── self-opt-driver.ts       # 冒烟驱动（boot + 跑一个 turn）
        └── mock-optimizer-llm.ts    # keyless mock llm
```

## 4. 快速开始

### 前置

```sh
pnpm install
# 把 key 放进 gitignored 的根 .env（一行）：
#   DEEPSEEK_API_KEY=sk-...
```

### 跑真实循环

```sh
# 默认任务（to-snake-case）
bash examples/self-optimizing-plugin/run.sh

# 指定任务
bash examples/self-optimizing-plugin/run.sh number-to-words

# 自定义循环指令（第二个参数）
bash examples/self-optimizing-plugin/run.sh to-snake-case "你的任务指令"
```

`run.sh` 会依次：重置该任务的 solver → 用 V4 Flash 跑真实循环 → 打印**迭代轨迹**（每轮 run_tests 判定 + 每次 optimize 写出的新代码）→ 打印最终写在磁盘上的函数体。完整事件日志在 `tmp/self-opt-run.log`（gitignored）。

现有任务：`to-snake-case`（默认）、`numeric-function`、`positional-repeat`、`number-to-words`。

## 5. 如何添加一个新任务

只需三步，不改任何共享代码。

### 第 1 步：写求解器 `tasks/<任务名>/solver.ts`

```ts
import { Service, type Context } from '@deepseek-ai/cordis'
import { readBody, writeBody } from '../../src/body.ts'

const SOLVER_URL = new URL('./solver.ts', import.meta.url)

export class MySolver extends Service {
  constructor(ctx: Context) {
    super(ctx, 'solver')
  }

  solve(input: unknown): unknown {
    // <SOLVE_BODY_BEGIN>
    return input            // 错误起点；标记之间是 optimizer 会改写的代码
    // <SOLVE_BODY_END>
  }

  currentBody(): Promise<string> { return readBody(SOLVER_URL) }
  install(body: string): Promise<void> { return writeBody(SOLVER_URL, body) }

  readonly description = '任务描述（进 optimizer 的 prompt）'
  readonly trainingExamples = [
    { input: '示例输入', output: '示例输出' },
  ]
}

export const name = 'my-task-solver'
export function apply(ctx: Context): void { ctx.plugin(MySolver) }
```

注意：`// <SOLVE_BODY_BEGIN>` / `// <SOLVE_BODY_END>` 两个标记**必须**存在，优化器只改这两行之间的内容。

### 第 2 步：写评估器 `tasks/<任务名>/evaluator.ts`

```ts
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Solver } from '../../src/contract.ts'

const TEST_POINTS = [
  { input: '示例输入', output: '期望输出' },
  // ... 含隐藏边角用例
]

export const name = 'my-task-evaluator'
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
                input: { type: 'json' }, expected: { type: 'json' }, actual: { type: 'json' },
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
      const failures: { input: unknown, expected: unknown, actual: unknown }[] = []
      for (const t of TEST_POINTS) {
        const actual = solver.solve(t.input)
        if (actual !== t.output) failures.push({ input: t.input, expected: t.output, actual })
      }
      return { done: failures.length === 0, loadError: false, failures }
    },
  }))
}
```

### 第 3 步：建组合 `self-opt-real-<任务名>.cordis.yml`

```yaml
- id: hmr
  name: '@deepseek-ai/cordis-plugin-hmr'
  config:
    root: ['.']
- id: solver
  name: './tasks/<任务名>/solver.ts'
- id: evaluator
  name: './tasks/<任务名>/evaluator.ts'
- id: optimizer
  name: './src/optimizer.ts'
- id: base
  name: '@deepseek-ai/cordis-plugin-include'
  config:
    path: ../headless-agent/cordis.yml
```

然后在 `run.sh` 的 `case` 里加一行：

```sh
  <任务名>) CONFIG="examples/self-optimizing-plugin/self-opt-real-<任务名>.cordis.yml" ;;
```

完成。`bash examples/self-optimizing-plugin/run.sh <任务名>` 即可跑。

## 6. 验证工具

| 命令 | 作用 | 是否耗 key |
|---|---|---|
| `pnpm exec vitest run examples/self-optimizing-plugin/tests/install-body.spec.ts` | installer（函数体 splice）单测 | 否 |
| `pnpm exec vitest run --config vitest.e2e.config.ts examples/self-optimizing-plugin/tests/keyless-smoke.e2e.ts` | 真实 Loader 树 boot + `run_tests` 全链路（mock llm） | 否 |
| `tsc -b tsconfig.host.json` | 类型检查 | 否 |
| `bash examples/self-optimizing-plugin/run.sh <任务名>` | 真实自我优化闭环（DeepSeek V4 Flash） | 是 |

辅助脚本：

- `reset-solver.mjs <任务名>`：把该任务 solver 的函数体重置为错误起点 `return input`。
- `summarize.mjs <日志路径>`：从 JSONL 日志提取「初始实现 → run_tests 判定 → optimize 写出的代码 → …」这条迭代轨迹。

## 7. 已知结论与局限

- **一轮收敛是常态**：本实验试过已知公式、已知算法、非标准规则、复杂多规则四类任务，DeepSeek V4 Flash 都能在一次 optimize 内写出完整正确解。这是前沿模型对「单个函数」任务的实力事实，不是架构缺陷——循环本身（求解 → 评估 → 优化 → 复测）是完整跑通的。
- **真·多轮需要额外约束**：若要让循环肉眼可见地转多轮，需给优化器加约束（如每轮只披露部分失败点、或限制每轮改动幅度）。
- **只支持「单函数 + 确定性比对」**：评估器用 `actual !== output` 判分；对象/近似匹配等更复杂的判定需自定义 evaluator（这正是把 evaluator 放在每任务目录里的原因）。
- **组合来自 headless-agent 基座**：真实运行依赖 `examples/headless-agent/cordis.yml` 提供的 agent spine、subagent seam、llm 适配器、fs 工具等。

## 8. 术语速查

- **solver / evaluator / optimizer**：求解器（被优化）/ 评估器（判定）/ 优化器（调模型改写）。
- **agent vs subagent**：agent 是「session + 跑模型轮次的驱动」；subagent 是其独立子会话（隔离上下文、可结构化收口）。
