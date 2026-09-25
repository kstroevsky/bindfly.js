import type { PointCloudSnapshot } from '../../../src-v2/analysis/point-cloud-snapshot.ts'
import {
	PersistentHomologyBackendError,
	createBudgetExceededPersistenceResult,
	preflightRipsPersistence,
} from '../../../src-v2/analysis/rips-persistence.ts'
import type {
	PersistenceBackendMetadata,
	PersistenceOptions,
	PersistentHomologyBackend,
	RipsPersistenceResult,
} from '../../../src-v2/analysis/rips-persistence.ts'
import { parseRipserPersistenceOutput } from './ripser-output.ts'
import createRipserWasmModule from './vendor/ripser-wasm.generated.mjs'

export const RIPSER_WASM_METADATA: PersistenceBackendMetadata = Object.freeze({
	id: 'ripser-wasm',
	version: '1',
	sourceCommit: '01add51ff64aaf40889483260cc5c3b7d0f2a1e7',
	license: 'MIT',
	numericSemantics: 'Full H₀/H₁ over F₂ · Ripser float filtration',
})

const cancelled = () => new PersistentHomologyBackendError('cancelled', 'Persistent homology analysis was cancelled.')

const pointCloudCsv = (snapshot: PointCloudSnapshot): string => {
	const rows = new Array<string>(snapshot.ids.length)
	for (let index = 0; index < snapshot.ids.length; index++) {
		const x = snapshot.x[index]
		const y = snapshot.y[index]
		if (x === undefined || y === undefined || !Number.isFinite(x) || !Number.isFinite(y)) {
			throw new PersistentHomologyBackendError('invalid-output', `Point ${index} is not a finite 2D coordinate.`)
		}
		rows[index] = `${x},${y}`
	}
	return `${rows.join('\n')}\n`
}

const classifyBackendFailure = (error: unknown): PersistentHomologyBackendError => {
	if (error instanceof PersistentHomologyBackendError) return error
	const message = error instanceof Error ? error.message : String(error)
	return /out of memory|oom|memory/i.test(message)
		? new PersistentHomologyBackendError('resource-limit', `Ripser WASM exhausted its memory envelope: ${message}`)
		: new PersistentHomologyBackendError('backend-failed', `Ripser WASM failed: ${message}`)
}

export class RipserWasmAdapter implements PersistentHomologyBackend {
	readonly metadata = RIPSER_WASM_METADATA

	async compute(
		snapshot: PointCloudSnapshot,
		options: PersistenceOptions,
		signal?: AbortSignal,
	): Promise<RipsPersistenceResult> {
		if (options.maximumHomologyDimension !== 1 || options.coefficientField !== 2) {
			throw new PersistentHomologyBackendError('backend-failed', 'Ripser WASM Stage 13 supports full H0/H1 over F2 with float filtration values only.')
		}
		if (signal?.aborted) throw cancelled()
		const preflight = preflightRipsPersistence(snapshot, options.epsilonMax, options.budget)
		if (preflight.status === 'budget-exceeded') {
			return createBudgetExceededPersistenceResult(preflight, this.metadata)
		}

		const stdout: string[] = []
		const stderr: string[] = []
		try {
			const module = await createRipserWasmModule({
				print: (line) => stdout.push(line),
				printErr: (line) => stderr.push(line),
			})
			if (signal?.aborted) throw cancelled()
			const inputPath = '/bindfly-point-cloud.csv'
			module.FS.writeFile(inputPath, pointCloudCsv(snapshot))
			const exitCode = module.callMain([
				'--format', 'point-cloud',
				'--dim', '1',
				'--threshold', String(options.epsilonMax),
				inputPath,
			])
			if (exitCode !== 0) {
				throw new PersistentHomologyBackendError(
					'backend-failed',
					`Ripser WASM exited with code ${exitCode}${stderr.length > 0 ? `: ${stderr.join(' ')}` : '.'}`,
				)
			}
			if (signal?.aborted) throw cancelled()
			const persistence = parseRipserPersistenceOutput(stdout)
			if (snapshot.ids.length > 0 && persistence.h0.length === 0) {
				throw new PersistentHomologyBackendError('invalid-output', 'Ripser WASM returned no H0 intervals for a non-empty point cloud.')
			}
			return {
				status: 'computed',
				epsilonMax: preflight.epsilonMax,
				metric: preflight.metric,
				pointCount: preflight.pointCount,
				edgeCount: preflight.edgeCount,
				triangleCount: preflight.triangleCount,
				triangleCountExact: true,
				simplexCount: preflight.simplexCount,
				simplexCountExact: true,
				h0: persistence.h0,
				h1: persistence.h1,
				warnings: [],
				backend: this.metadata,
			}
		} catch (error) {
			throw classifyBackendFailure(error)
		}
	}
}
