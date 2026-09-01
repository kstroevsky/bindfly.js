import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const collectTests = async (directory) => {
	const entries = await readdir(directory, { withFileTypes: true })
	const tests = []

	for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
		const entryPath = path.join(directory, entry.name)

		if (entry.isDirectory()) tests.push(...await collectTests(entryPath))
		else if (/\.test\.(?:mjs|ts)$/.test(entry.name)) tests.push(entryPath)
	}

	return tests
}

const tests = [
	...await collectTests('tooling'),
	...await collectTests('src-v2'),
	...await collectTests('apps/studio/src'),
]

const result = spawnSync(
	process.execPath,
	[
		'--experimental-strip-types',
		'--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
		'--test',
		...tests,
	],
	{
		stdio: 'inherit',
	},
)

if (result.error) throw result.error
process.exitCode = result.status ?? 1
