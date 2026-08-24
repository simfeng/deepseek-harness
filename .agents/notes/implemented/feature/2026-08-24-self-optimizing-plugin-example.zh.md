# Agent Note: Self-optimizing plugin example

Status: implemented

[English](2026-08-24-self-optimizing-plugin-example.md) | 中文

## Problem

此前没有可运行的示例展示 harness 能组装出的这个封闭式自我优化循环：求解器完成任务 → 确定性评估器判定 → 模型原地改写求解器源码，直到评估器通过。没有它，每个 demo 都在重复发明这个循环，仓库也没有共享参照来验证「optimize → install → 复测」是否真的收敛。

## Decision

`examples/self-optimizing-plugin` 把循环落成三个角色加一份共享契约。

- `src/contract.ts` 声明 `ctx.solver` 契约：`solve`、`currentBody`、`install`、`description`、`trainingExamples`。优化器对任何具体任务一无所知，只认这份契约。
- `src/optimizer.ts` 注册通用 `optimize` 工具。每轮起一个 fresh one-shot subagent，接收当前函数体、任务描述和训练样例，通过 `outputSchema` 返回新函数体，再经 `install` 写回。
- `src/body.ts` 只 splice 任务 solver 文件里 `<SOLVE_BODY_BEGIN>` 与 `<SOLVE_BODY_END>` 两个标记之间的区间。
- `tasks/<任务>/solver.ts` 与 `evaluator.ts` 是唯一的每任务文件；评估器注册 `run_tests`，把 `solve(input)` 与确定性测试点逐一比对。

评估器与优化器通过 `ctx.get('solver')` 惰性读取服务，而不是在 `inject` 里声明，因此 solver 被改写重载时它们不会被卸载。真实运行以 `headless-agent` 基座组合各任务；`self-opt.cordis.yml` 是带 mock llm 的 keyless 冒烟组合。随附四个任务：`to-snake-case`（默认）、`numeric-function`、`positional-repeat`、`number-to-words`。`run.sh`、`reset-solver.mjs`、`summarize.mjs` 串起「重置 → 运行 → 提取轨迹」的流程。

## Alternatives considered

**在 `inject: ['solver']` 里声明求解器。** 静态注入会在 `install` 改写并重载 solver 时卸载评估器和优化器——而这正是循环存在的目的操作。惰性 `ctx.get` 让这条 seam 在 solver 重载后仍然存活。

**在主会话内完成优化。** 反复的大段编辑会膨胀主上下文，并把任务尝试与优化推理混在一起。fresh one-shot subagent 隔离每一轮，并以结构化输出交回新函数体。

**在优化器里硬编码任务细节。** 通用优化器必须可跨任务替换；从契约读取描述与样例让共享代码与任务无关。

## Verification

`tests/install-body.spec.ts` 覆盖标记区间 splice；`tests/keyless-smoke.e2e.ts` 用 mock llm 从 `self-opt.cordis.yml` 启动真实 Loader 树并驱动一轮 `run_tests`。真实收敛运行需 key（`run.sh`，DeepSeek V4 Flash）。

## Consequences

循环被证明完整跑通，但在随附任务上 DeepSeek V4 Flash 通常一轮 optimize 即收敛；要让循环肉眼可见地多轮运转，需要额外约束，如每轮只披露部分失败点或限制每轮改动幅度。评估器用 `===` 判分，因此任务限定为「单函数 + 确定性比对」；更复杂的判定由每任务 evaluator 承担。真实运行依赖 `headless-agent` 基座组合。
