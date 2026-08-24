#!/usr/bin/env node
// 把指定任务的 solver 函数体重置为错误起点（return input），供反复跑自优化循环。
import { readFile, writeFile } from 'node:fs/promises'

const task = process.argv[2] ?? 'to-snake-case'
const solverUrl = new URL(`./tasks/${task}/solver.ts`, import.meta.url)
const BEGIN = '// <SOLVE_BODY_BEGIN>'
const END = '// <SOLVE_BODY_END>'
const WRONG_BODY = 'return input'

const source = await readFile(solverUrl, 'utf8')
const a = source.indexOf(BEGIN)
const b = source.indexOf(END)
if (a === -1 || b === -1 || b <= a) {
  console.error(`${task} 的 solver 缺少 SOLVE_BODY 标记区间`)
  process.exit(1)
}
const beginLineStart = source.lastIndexOf('\n', a) + 1
const indent = source.slice(beginLineStart, a)
const endLineStart = source.lastIndexOf('\n', b) + 1
const next = `${source.slice(0, a + BEGIN.length)}\n${indent}${WRONG_BODY}\n${source.slice(endLineStart)}`
await writeFile(solverUrl, next, 'utf8')
console.log(`${task} 的 solver 已重置为：${WRONG_BODY}`)
