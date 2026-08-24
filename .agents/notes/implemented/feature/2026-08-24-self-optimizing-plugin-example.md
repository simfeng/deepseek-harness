# Agent Note: Self-optimizing plugin example

Status: implemented

English | [中文](2026-08-24-self-optimizing-plugin-example.zh.md)

## Problem

No runnable example showed the closed self-optimizing loop the harness can assemble: a solver completes a task, a deterministic evaluator judges it, and the model rewrites the solver source in place until the evaluator passes. Without one, each demo re-invented the loop, and the harness had no shared reference for testing whether optimize → install → re-evaluate actually converges.

## Decision

`examples/self-optimizing-plugin` ships the loop as three roles plus one shared contract.

- `src/contract.ts` declares the `ctx.solver` contract: `solve`, `currentBody`, `install`, `description`, `trainingExamples`. The optimizer knows nothing about any concrete task beyond this contract.
- `src/optimizer.ts` registers the generic `optimize` tool. Per round it spawns a fresh one-shot subagent that receives the current function body, task description, and training examples, and returns a new body through `outputSchema`, written back via `install`.
- `src/body.ts` splices only the region between the `<SOLVE_BODY_BEGIN>` and `<SOLVE_BODY_END>` markers inside a task solver file.
- `tasks/<task>/solver.ts` and `evaluator.ts` are the only per-task files; the evaluator registers `run_tests` and compares `solve(input)` against deterministic points.

The evaluator and optimizer read the solver lazily through `ctx.get('solver')` rather than declaring it in `inject`, so a rewritten-and-reloaded solver does not unmount them. Real runs compose each task with the `headless-agent` base; `self-opt.cordis.yml` is the keyless smoke combination with a mock llm. Four tasks ship: `to-snake-case` (default), `numeric-function`, `positional-repeat`, `number-to-words`. `run.sh`, `reset-solver.mjs`, and `summarize.mjs` script the reset-run-summarize cycle.

## Alternatives considered

**Declare the solver in `inject: ['solver']`.** Static injection would tear down the evaluator and optimizer whenever `install` rewrites and reloads the solver, which is the operation the loop exists to perform. Lazy `ctx.get` keeps the seam alive across solver reloads.

**Run optimization inside the main session.** Repeated large edits would grow the main context and mix task trials with optimization reasoning. A fresh one-shot subagent isolates each round and returns the new body as structured output.

**Hardcode task detail in the optimizer.** A generic optimizer had to be swappable across tasks; reading description and examples from the contract keeps the shared code task-free.

## Verification

`tests/install-body.spec.ts` covers the marked-region splice; `tests/keyless-smoke.e2e.ts` boots the real Loader tree from `self-opt.cordis.yml` with a mock llm and drives one `run_tests` round. Real convergence runs are keyed (`run.sh`, DeepSeek V4 Flash).

## Consequences

The loop is demonstrated complete, but on the shipped tasks DeepSeek V4 Flash typically converges in one optimize round; making the loop visibly multi-round needs extra constraints such as partial failure disclosure or per-round edit budgets. The evaluator compares with `===`, so tasks are single-function with deterministic comparison; richer judgments are a per-task evaluator. Real runs depend on the `headless-agent` base combination.
