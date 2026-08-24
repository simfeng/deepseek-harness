import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { LOADER_SMOKE_TEST_TIMEOUT_MS, runLoaderSmoke } from '@deepseek-ai/dsh-loader-smoke'
import type { SessionEvent } from '@deepseek-ai/dsh-session'

const binScript = fileURLToPath(new URL('./fixtures/self-opt-driver.ts', import.meta.url))
const configPath = fileURLToPath(new URL('../self-opt.cordis.yml', import.meta.url))
const tsconfigPath = fileURLToPath(new URL('../../../tsconfig.json', import.meta.url))

describe('self-optimizing-plugin keyless smoke', () => {
  it('boots the real Loader tree and run_tests reports the initial failures', async () => {
    const { stdout, stderr } = await runLoaderSmoke({
      label: 'self-optimizing-plugin',
      tempDirPrefix: 'self-opt-smoke-',
      binScript,
      libBinScript: binScript,
      configPath,
      binArgs: [configPath, 'run the self-optimizing smoke'],
      tsconfigPath,
    })
    const lines = stdout.trimEnd().split('\n').map(line => JSON.parse(line) as Record<string, unknown>)
    const events = lines.slice(0, -1).map(line => line['event'] as SessionEvent)
    expect(stderr).toBe('')
    expect(events.some(event => event.type === 'tool/call' && event.data.name === 'run_tests')).toBe(true)
    const toolResult = events.find(event => event.type === 'tool/result')
    expect(toolResult).toBeDefined()
    const serialized = JSON.stringify(toolResult)
    // run_tests 返回的文本是 {"done":false,...,"failures":[{input,expected,actual},...]}。
    expect(serialized).toContain('done')
    expect(serialized).toContain('expected')
  }, LOADER_SMOKE_TEST_TIMEOUT_MS)
})
