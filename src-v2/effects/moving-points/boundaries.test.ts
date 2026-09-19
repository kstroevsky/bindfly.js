import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

const sourceFiles = async (directory: string) => (await readdir(directory))
	.filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
	.map((file) => `${directory}/${file}`)

test('experiment-specific modules depend on neutral moving points, never on each other', async () => {
	const flyingFiles = await sourceFiles('src-v2/effects/flying-lines')
	const droopingFiles = await sourceFiles('src-v2/effects/drooping-lines')
	for (const file of flyingFiles) assert.doesNotMatch(await readFile(file, 'utf8'), /drooping-lines/, file)
	for (const file of droopingFiles) assert.doesNotMatch(await readFile(file, 'utf8'), /flying-lines/, file)

	const consumers = await Promise.all([
		readFile('src-v2/effects/flying-lines/simulation.ts', 'utf8'),
		readFile('src-v2/effects/drooping-lines/simulation.ts', 'utf8'),
	])
	for (const source of consumers) assert.match(source, /moving-points\/simulation/)
})
