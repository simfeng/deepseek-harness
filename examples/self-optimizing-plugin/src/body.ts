import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export const BODY_BEGIN = '// <SOLVE_BODY_BEGIN>'
export const BODY_END = '// <SOLVE_BODY_END>'

/** 从 solver 源码中抽出 `<SOLVE_BODY_BEGIN>` 与 `<SOLVE_BODY_END>` 之间的函数体。 */
export function extractBody(source: string): string {
  const start = source.indexOf(BODY_BEGIN)
  const end = source.indexOf(BODY_END)
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('solver source is missing the SOLVE_BODY region markers')
  }
  return source.slice(start + BODY_BEGIN.length, end).trim()
}

/** 把新的函数体 splice 回两处标记之间，其余骨架原样保留，并按 BEGIN 标记的缩进对齐。 */
export function installBody(source: string, body: string): string {
  const start = source.indexOf(BODY_BEGIN)
  const end = source.indexOf(BODY_END)
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('solver source is missing the SOLVE_BODY region markers')
  }
  const head = source.slice(0, start + BODY_BEGIN.length)
  const endLineStart = source.lastIndexOf('\n', end) + 1
  const tail = source.slice(endLineStart)
  const beginLineStart = source.lastIndexOf('\n', start) + 1
  const indent = source.slice(beginLineStart, start)
  const indented = body.split('\n').map(line => (line.trim() === '' ? '' : indent + line)).join('\n')
  return `${head}\n${indented}\n${tail}`
}

/** 读取 solver 文件中当前待优化的函数体。 */
export async function readBody(fileUrl: URL): Promise<string> {
  return extractBody(await readFile(fileURLToPath(fileUrl), 'utf8'))
}

/** 把新的函数体写回 solver 文件（HMR 检测到保存后热插）。 */
export async function writeBody(fileUrl: URL, body: string): Promise<void> {
  const source = await readFile(fileURLToPath(fileUrl), 'utf8')
  await writeFile(fileURLToPath(fileUrl), installBody(source, body), 'utf8')
}
