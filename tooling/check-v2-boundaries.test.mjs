import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { checkV2Boundaries, dependencyPolicy } from './check-v2-boundaries.mjs'

const modulePath = (moduleName, file = 'index.ts') =>
	moduleName === 'studio'
		? path.join('apps', 'studio', 'src', file)
		: path.join('src-v2', moduleName, file)

const withFixture = async (files, callback) => {
	const rootDir = await mkdtemp(path.join(os.tmpdir(), 'bindfly-v2-boundaries-'))

	try {
		for (const [relativePath, contents] of Object.entries(files)) {
			const absolutePath = path.join(rootDir, relativePath)
			await mkdir(path.dirname(absolutePath), { recursive: true })
			await writeFile(absolutePath, contents)
		}

		await callback(rootDir)
	} finally {
		await rm(rootDir, { recursive: true, force: true })
	}
}

test('allows the canonical dependency direction', async () => {
	const files = {
		[modulePath('core')]: 'export const core = true\n',
		[modulePath('formula')]: "import '@bindfly-v2/core'\n",
		[modulePath('effects')]: "import '@bindfly-v2/core'\nimport '@bindfly-v2/formula'\n",
		[modulePath('rendering')]: "import '@bindfly-v2/core'\n",
		[modulePath('runtime')]: "import '@bindfly-v2/core'\n",
		[modulePath('analysis')]: "import '@bindfly-v2/core'\n",
		[modulePath('benchmarks')]: [
			"import '@bindfly-v2/core'",
			"import '@bindfly-v2/effects'",
			"import '@bindfly-v2/rendering'",
			"import '@bindfly-v2/runtime'",
			"import '@bindfly-v2/analysis'",
		].join('\n'),
		[modulePath('studio')]: "import '@bindfly-v2/benchmarks'\n",
	}

	await withFixture(files, async (rootDir) => {
		assert.deepEqual(await checkV2Boundaries({ rootDir }), [])
	})
})

test('rejects every forbidden cross-module direction', async () => {
	const files = {}
	const expectedPairs = []

	for (const sourceModule of dependencyPolicy.modules) {
		const allowed = new Set(dependencyPolicy.allowedDependencies[sourceModule])

		for (const targetModule of dependencyPolicy.modules) {
			if (sourceModule === targetModule || allowed.has(targetModule)) continue

			expectedPairs.push(`${sourceModule}->${targetModule}`)
			files[modulePath(sourceModule, `imports-${targetModule}.ts`)] =
				`import '@bindfly-v2/${targetModule}'\n`
		}
	}

	await withFixture(files, async (rootDir) => {
		const violations = await checkV2Boundaries({ rootDir })
		const actualPairs = violations
			.filter(({ rule }) => rule === 'module-dependency')
			.map(({ sourceModule, targetModule }) => `${sourceModule}->${targetModule}`)
			.sort()

		assert.deepEqual(actualPairs, expectedPairs.sort())
	})
})

test('rejects React imports from every engine module', async () => {
	const files = Object.fromEntries(
		dependencyPolicy.modules
			.filter((moduleName) => moduleName !== 'studio')
			.map((moduleName) => [modulePath(moduleName), "import 'react'\n"])
	)

	await withFixture(files, async (rootDir) => {
		const violations = await checkV2Boundaries({ rootDir })
		assert.equal(
			violations.filter(({ rule }) => rule === 'react-isolation').length,
			dependencyPolicy.modules.length - 1
		)
	})
})

test('rejects imports from the legacy source tree', async () => {
	await withFixture(
		{
			[modulePath('core')]: "import '../../src/hooks'\n",
			'src/hooks/index.ts': 'export {}\n',
		},
		async (rootDir) => {
			const violations = await checkV2Boundaries({ rootDir })
			assert.equal(violations.length, 1)
			assert.equal(violations[0].rule, 'legacy-isolation')
		}
	)
})

test('rejects garbage-drawer module directories', async () => {
	await withFixture(
		{
			'src-v2/shared/index.ts': 'export {}\n',
			'src-v2/utils/index.ts': 'export {}\n',
			'src-v2/types/index.ts': 'export {}\n',
		},
		async (rootDir) => {
			const violations = await checkV2Boundaries({ rootDir })
			assert.deepEqual(
				violations.map(({ moduleName }) => moduleName).sort(),
				['shared', 'types', 'utils']
			)
		}
	)
})

test('rejects forbidden dynamic imports and requires', async () => {
	await withFixture(
		{
			[modulePath('core', 'dynamic.ts')]: "void import('@bindfly-v2/effects')\n",
			[modulePath('core', 'require.ts')]: "require('@bindfly-v2/effects')\n",
		},
		async (rootDir) => {
			const violations = await checkV2Boundaries({ rootDir })
			assert.deepEqual(
				violations.map(({ rule }) => rule),
				['module-dependency', 'module-dependency']
			)
		}
	)
})

test('rejects unknown aliases and relative imports outside owned roots', async () => {
	await withFixture(
		{
			[modulePath('core', 'unknown.ts')]: "import '@bindfly-v2/unknown'\n",
			[modulePath('core', 'outside.ts')]: "import '../../outside'\n",
			'outside.ts': 'export {}\n',
		},
		async (rootDir) => {
			const violations = await checkV2Boundaries({ rootDir })
			assert.deepEqual(
				violations.map(({ rule }) => rule).sort(),
				['unknown-v2-module', 'unowned-relative-import']
			)
		}
	)
})
