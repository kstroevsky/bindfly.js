import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const genericHosts = [
	'apps/studio/src/studio-app.tsx',
	'apps/studio/src/studio-controller.ts',
	'apps/studio/src/main.tsx',
	'apps/studio/src/studio-state.ts',
	'apps/studio/src/studio.worker.ts',
]

test('generic Studio, state and runtime hosts contain no experiment-specific branches', async () => {
	for (const file of genericHosts) {
		const source = await readFile(file, 'utf8')
		assert.doesNotMatch(source, /flying-lines|drooping-lines|FlyingLines|DroopingLines/, file)
	}
})
