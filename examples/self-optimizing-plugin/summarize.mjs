#!/usr/bin/env node
// 从 run.sh 的日志里提取 worker 迭代轨迹：按发生顺序打印每次 run_tests 判定与每次 optimize 写回的函数体。
import { readFileSync } from 'node:fs'

const LOG = process.argv[2] ?? 'tmp/self-opt-run.log'
const INITIAL = 'return input' // 与 reset-solver.mjs 的 WRONG_BODY 保持一致

const lines = readFileSync(LOG, 'utf8').trimEnd().split('\n')
const steps = []
for (const line of lines) {
  let record
  try { record = JSON.parse(line) } catch { continue }
  const event = record.event
  if (!event || event.type !== 'tool/result') continue
  const content = event.data?.message?.content
  if (!Array.isArray(content)) continue
  for (const block of content) {
    if (block.type !== 'tool-result' || !Array.isArray(block.content)) continue
    for (const b of block.content) {
      if (b.type !== 'text' || typeof b.text !== 'string') continue
      if (b.text.startsWith('installed solver body:\n')) {
        steps.push({ kind: 'optimize', body: b.text.slice('installed solver body:\n'.length) })
      } else if (b.text.trimStart().startsWith('{') && b.text.includes('"done"')) {
        let parsed
        try { parsed = JSON.parse(b.text) } catch { continue }
        steps.push({
          kind: 'run_tests',
          done: parsed.done === true,
          loadError: parsed.loadError === true,
          count: Array.isArray(parsed.failures) ? parsed.failures.length : 0,
        })
      }
    }
  }
}

console.log('\n=== Worker 迭代轨迹 ===')
console.log(`初始实现：${INITIAL}`)
for (const s of steps) {
  if (s.kind === 'optimize') {
    console.log(`optimize → ${s.body}`)
  } else if (s.loadError) {
    console.log('run_tests → worker 未加载（等待 HMR 热插）')
  } else {
    console.log(`run_tests → done=${s.done}${s.done ? ' ✓' : `（${s.count} 个失败点）`}`)
  }
}
