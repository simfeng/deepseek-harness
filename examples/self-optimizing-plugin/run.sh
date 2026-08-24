#!/usr/bin/env bash
# 一键：重置指定任务的 solver → 跑真实自优化循环。
# 用法：bash examples/self-optimizing-plugin/run.sh [to-snake-case|numeric-function] ["自定义任务指令"]
# 前提：根 .env 里有 DEEPSEEK_API_KEY。
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

TASK="${1:-to-snake-case}"
case "$TASK" in
  to-snake-case) CONFIG="examples/self-optimizing-plugin/self-opt-real.cordis.yml" ;;
  numeric-function) CONFIG="examples/self-optimizing-plugin/self-opt-real-numeric.cordis.yml" ;;
  positional-repeat) CONFIG="examples/self-optimizing-plugin/self-opt-real-positional.cordis.yml" ;;
  number-to-words) CONFIG="examples/self-optimizing-plugin/self-opt-real-number-words.cordis.yml" ;;
  *) echo "未知任务：$TASK（可选 to-snake-case | numeric-function | positional-repeat | number-to-words）" >&2; exit 1 ;;
esac

node examples/self-optimizing-plugin/reset-solver.mjs "$TASK"

DEFAULT_TASK='Drive the self-optimization loop. Repeat: (1) call run_tests; (2) if done is false, call optimize passing the exact failures array run_tests returned; (3) call run_tests again. Stop when run_tests returns done=true. Then report the final solver body and confirm done=true.'
TASK_TEXT="${2:-$DEFAULT_TASK}"

LOG="tmp/self-opt-run.log"
mkdir -p "$(dirname "$LOG")"
node --import tsx \
  examples/self-optimizing-plugin/tests/fixtures/self-opt-driver.ts \
  "$CONFIG" \
  "$TASK_TEXT" > "$LOG" 2>&1

echo ""
node examples/self-optimizing-plugin/summarize.mjs "$LOG"

echo ""
echo "=== 磁盘 solver 的 solve 函数体 ==="
sed -n '/SOLVE_BODY_BEGIN/,/SOLVE_BODY_END/p' "examples/self-optimizing-plugin/tasks/$TASK/solver.ts"
echo ""
echo "完整日志: ${LOG}"
