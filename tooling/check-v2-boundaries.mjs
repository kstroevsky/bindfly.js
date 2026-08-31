import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'

const moduleRoots = {
	core: path.join('src-v2', 'core'),
	formula: path.join('src-v2', 'formula'),
	effects: path.join('src-v2', 'effects'),
	rendering: path.join('src-v2', 'rendering'),
	runtime: path.join('src-v2', 'runtime'),
	analysis: path.join('src-v2', 'analysis'),
	benchmarks: path.join('src-v2', 'benchmarks'),
	studio: path.join('apps', 'studio', 'src'),
}

const allowedDependencies = {
	core: [],
	formula: ['core'],
	effects: ['core', 'formula'],
	rendering: ['core'],
	runtime: ['core'],
	analysis: ['core'],
	benchmarks: ['core', 'formula', 'effects', 'rendering', 'runtime', 'analysis'],
	studio: ['core', 'formula', 'effects', 'rendering', 'runtime', 'analysis', 'benchmarks'],
}

const forbiddenModuleNames = ['shared', 'types', 'utils']
const engineModules = Object.keys(moduleRoots).filter((moduleName) => moduleName !== 'studio')

export const dependencyPolicy = Object.freeze({
	modules: Object.freeze(Object.keys(moduleRoots)),
	moduleRoots: Object.freeze({ ...moduleRoots }),
	allowedDependencies: Object.freeze(
		Object.fromEntries(
			Object.entries(allowedDependencies).map(([moduleName, dependencies]) => [
				moduleName,
				Object.freeze([...dependencies]),
			])
		)
	),
	forbiddenModuleNames: Object.freeze([...forbiddenModuleNames]),
})

const isWithin = (candidate, parent) => {
	const relative = path.relative(parent, candidate)
	return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

const exists = async (targetPath) => {
	try {
		await stat(targetPath)
		return true
	} catch {
		return false
	}
}

const collectFiles = async (directory) => {
	if (!(await exists(directory))) return []

	const entries = await readdir(directory, { withFileTypes: true })
	const files = []

	for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
		const entryPath = path.join(directory, entry.name)

		if (entry.isDirectory()) files.push(...await collectFiles(entryPath))
		else if (/\.(?:cts|mts|tsx?)$/.test(entry.name)) files.push(entryPath)
	}

	return files
}

const moduleForPath = (absolutePath, absoluteRoots) =>
	Object.entries(absoluteRoots).find(([, moduleRoot]) => isWithin(absolutePath, moduleRoot))?.[0]

const literalText = (node) =>
	ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : undefined

const collectModuleSpecifiers = (sourceText, fileName) => {
	const scriptKind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
	const sourceFile = ts.createSourceFile(
		fileName,
		sourceText,
		ts.ScriptTarget.Latest,
		true,
		scriptKind
	)
	const specifiers = []

	const visit = (node) => {
		if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
			const specifier = literalText(node.moduleSpecifier)
			if (specifier) specifiers.push(specifier)
		}

		if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
			const specifier = literalText(node.argument.literal)
			if (specifier) specifiers.push(specifier)
		}

		if (ts.isCallExpression(node) && node.arguments.length === 1) {
			const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword
			const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require'

			if (isDynamicImport || isRequire) {
				const specifier = literalText(node.arguments[0])
				if (specifier) specifiers.push(specifier)
			}
		}

		ts.forEachChild(node, visit)
	}

	visit(sourceFile)
	return specifiers
}

const targetForSpecifier = ({ filePath, rootDir, specifier, absoluteRoots }) => {
	if (specifier.startsWith('@bindfly-v2/')) {
		return {
			kind: 'v2',
			moduleName: specifier.slice('@bindfly-v2/'.length).split('/')[0],
		}
	}

	if (specifier === '@legacy' || specifier.startsWith('@legacy/')) {
		return { kind: 'legacy' }
	}

	if (!specifier.startsWith('.')) return { kind: 'package' }

	const resolvedPath = path.resolve(path.dirname(filePath), specifier)
	const legacyRoot = path.resolve(rootDir, 'src')

	if (isWithin(resolvedPath, legacyRoot)) return { kind: 'legacy' }

	const moduleName = moduleForPath(resolvedPath, absoluteRoots)
	return moduleName ? { kind: 'v2', moduleName } : { kind: 'unowned-relative' }
}

export const checkV2Boundaries = async ({ rootDir = process.cwd() } = {}) => {
	const absoluteRoot = path.resolve(rootDir)
	const absoluteRoots = Object.fromEntries(
		Object.entries(moduleRoots).map(([moduleName, relativeRoot]) => [
			moduleName,
			path.resolve(absoluteRoot, relativeRoot),
		])
	)
	const files = (await Promise.all(
		Object.values(absoluteRoots).map((moduleRoot) => collectFiles(moduleRoot))
	)).flat()
	const violations = []

	const logicalRoot = path.resolve(absoluteRoot, 'src-v2')
	if (await exists(logicalRoot)) {
		const entries = await readdir(logicalRoot, { withFileTypes: true })
		for (const entry of entries) {
			if (entry.isDirectory() && forbiddenModuleNames.includes(entry.name)) {
				violations.push({
					rule: 'forbidden-module-name',
					file: path.relative(absoluteRoot, path.join(logicalRoot, entry.name)),
					moduleName: entry.name,
					message: `V2 module directory '${entry.name}' is a forbidden garbage-drawer boundary.`,
				})
			}
		}
	}

	for (const filePath of files) {
		const sourceModule = moduleForPath(filePath, absoluteRoots)
		if (!sourceModule) continue

		const sourceText = await readFile(filePath, 'utf8')

		for (const specifier of collectModuleSpecifiers(sourceText, filePath)) {
			const common = {
				file: path.relative(absoluteRoot, filePath),
				sourceModule,
				specifier,
			}

			if (engineModules.includes(sourceModule) && (specifier === 'react' || specifier.startsWith('react/'))) {
				violations.push({
					...common,
					rule: 'react-isolation',
					message: `Engine module '${sourceModule}' must not import React.`,
				})
				continue
			}

			const target = targetForSpecifier({ filePath, rootDir: absoluteRoot, specifier, absoluteRoots })

			if (target.kind === 'legacy') {
				violations.push({
					...common,
					rule: 'legacy-isolation',
					message: `V2 module '${sourceModule}' must not import the legacy src tree.`,
				})
				continue
			}

			if (target.kind === 'unowned-relative') {
				violations.push({
					...common,
					rule: 'unowned-relative-import',
					message: `Relative import '${specifier}' leaves the owned V2 module roots.`,
				})
				continue
			}

			if (target.kind !== 'v2') continue

			if (!dependencyPolicy.modules.includes(target.moduleName)) {
				violations.push({
					...common,
					rule: 'unknown-v2-module',
					targetModule: target.moduleName,
					message: `Unknown V2 module '${target.moduleName}'.`,
				})
				continue
			}

			if (target.moduleName === sourceModule) continue

			if (!allowedDependencies[sourceModule].includes(target.moduleName)) {
				violations.push({
					...common,
					rule: 'module-dependency',
					targetModule: target.moduleName,
					message: `Dependency '${sourceModule}' -> '${target.moduleName}' is forbidden.`,
				})
			}
		}
	}

	return violations.sort((left, right) =>
		left.file.localeCompare(right.file)
		|| left.rule.localeCompare(right.rule)
		|| (left.specifier || '').localeCompare(right.specifier || '')
	)
}

const isMain = process.argv[1]
	&& path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
	const violations = await checkV2Boundaries()

	if (violations.length === 0) {
		console.info('Bindfly 2 dependency boundaries: PASS')
	} else {
		console.error(`Bindfly 2 dependency boundaries: FAIL (${violations.length})`)
		for (const violation of violations) {
			console.error(`${violation.file}: ${violation.message}`)
		}
		process.exitCode = 1
	}
}
