import type { Result } from '../../../src-v2/core/index.ts'
import { bindflyOriginals } from '../../../src-v2/formula/index.ts'
import { parametricOriginalDefinitions } from '../../../src-v2/effects/parametric-originals/definition.ts'
import type { ParametricOriginalDefinitionBundle } from '../../../src-v2/effects/parametric-originals/definition.ts'
import { compileParametricOriginalFormulaPair } from '../../../src-v2/effects/parametric-originals/formula.ts'
import type {
	ParametricOriginalInput,
	ParametricOriginalParameters,
	ParametricPointProbe,
	ParametricPointProbeResult,
} from '../../../src-v2/effects/parametric-originals/types.ts'
import { createParametricOriginalSession } from './parametric-original-session.ts'
import { defineStudioExperiment } from './studio-experiment-plugin.ts'
import type { StudioInteractionController, StudioPointerEvent } from './studio-experiment-plugin.ts'

const parseInput = (value: unknown): Result<ParametricOriginalInput, string> => {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return { ok: false, error: 'Parametric-original input must be an object.' }
	}
	const record = value as Record<string, unknown>
	return record.type === 'set-center'
		&& typeof record.x === 'number' && Number.isFinite(record.x)
		&& typeof record.y === 'number' && Number.isFinite(record.y)
		? { ok: true, value: { type: 'set-center', x: record.x, y: record.y } }
		: { ok: false, error: 'Parametric-original input must set a finite center.' }
}

const createCenterInteractionController = (): StudioInteractionController => ({
	handle: (event: StudioPointerEvent) => event.phase === 'down'
		? [{ type: 'set-center', x: event.x, y: event.y }]
		: [],
})

const number = (value: number | undefined) => value === undefined ? 'invalid' : Number.isFinite(value) ? value.toFixed(4) : String(value)
const validityLabel = (value: number) => value === 1 ? 'A valid / B valid'
	: value === 2 ? 'A invalid / B valid'
		: value === 3 ? 'A valid / B invalid' : 'A invalid / B invalid'
const axisValue = (axis: ParametricPointProbe['a']['x']) => axis.error ? `${axis.error.code}: ${axis.error.message}` : number(axis.value)
const traceRows = (label: string, axis: ParametricPointProbe['a']['x']) => axis.trace.map((entry) => ({
	label: `${label} · ${entry.expression}`,
	value: number(entry.value),
}))

const formatPointInspection = (value: unknown) => {
	if (typeof value !== 'object' || value === null || !('kind' in value)) return undefined
	const probe = value as ParametricPointProbeResult
	if (probe.kind === 'no-point') return { title: 'Point Probe', sections: [{ title: 'Selection', rows: [{ label: 'Result', value: 'No point within selection radius.' }] }] }
	if (probe.kind !== 'point-probe') return undefined
	return {
		title: `Point Probe · #${probe.pointId}`,
		sections: [
			{ title: 'Point', rows: [
				{ label: 'Stable ID', value: String(probe.pointId) },
				{ label: 'Simulation step', value: String(probe.simulationStep) },
				{ label: 'Validity', value: validityLabel(probe.validity) },
			] },
			{ title: 'Scope', rows: Object.entries(probe.scope).map(([label, scopeValue]) => ({ label, value: number(scopeValue) })) },
			{ title: 'Formula A / B', rows: [
				{ label: 'A.x', value: axisValue(probe.a.x) },
				{ label: 'A.y', value: axisValue(probe.a.y) },
				{ label: 'B.x', value: axisValue(probe.b.x) },
				{ label: 'B.y', value: axisValue(probe.b.y) },
				...(probe.morph ? [{ label: 'Morph', value: `(${number(probe.morph.x)}, ${number(probe.morph.y)})` }] : []),
				...(probe.displacement ? [
					{ label: 'dx', value: number(probe.displacement.dx) },
					{ label: 'dy', value: number(probe.displacement.dy) },
					{ label: 'Δ', value: number(probe.displacement.magnitude) },
				] : []),
			] },
			{ title: 'Trace · Formula A', rows: [
				...traceRows('x', probe.a.x), ...traceRows('y', probe.a.y),
			] },
			{ title: 'Trace · Formula B', rows: [
				...traceRows('x', probe.b.x), ...traceRows('y', probe.b.y),
			] },
		],
	}
}

const legacyPreset = (
	defaults: ParametricOriginalParameters,
	presetId: string,
): ParametricOriginalParameters | undefined => {
	switch (presetId) {
		case 'Simple': return { ...defaults, particleCount: 100, connectionRadius: 250, weight: 10, background: 'rgba(0, 0, 0, 0.7)' }
		case 'SwitchColor': return { ...defaults, particleCount: 100, connectionRadius: 150, weight: 10, background: 'rgba(255, 255, 0, 0.7)' }
		case 'Fixed&Movable': return { ...defaults, particleCount: 100, connectionRadius: 150, weight: 10, background: 'rgba(0, 0, 0, 0.7)' }
		case 'Blank': return { ...defaults, particleCount: 1, connectionRadius: 200, weight: 10, background: 'rgba(0, 0, 0, 0.7)' }
		default: return undefined
	}
}

const createParametricOriginalPlugin = (bundle: ParametricOriginalDefinitionBundle) => {
	const original = bindflyOriginals[bundle.spec.id]
	const defaults = bundle.definition.presets?.[0]?.parameters
	if (!defaults) throw new Error(`${original.title} defaults are unavailable.`)
	return defineStudioExperiment({
		definition: bundle.definition,
		title: original.title,
		defaultSeed: `bindfly-${bundle.spec.id}-original-v1`,
		provenance: [{
			id: original.id,
			format: original.format,
			version: original.version,
			legacyPath: original.provenance.legacyPath,
			legacyGitBlob: original.provenance.legacyGitBlob,
			capturedBehavior: original.provenance.capturedBehavior,
		}],
		pointCloudSources: ['morph', 'formula-a', 'formula-b'],
		formulaViews: ['morph', 'formula-a', 'compare', 'difference-vector', 'difference-magnitude', 'formula-b'],
		formatPointInspection,
		metrics: [
			{ id: 'points', label: 'Points' },
			{ id: 'edges', label: 'Lines' },
			{ id: 'step', label: 'Step' },
			{ id: 'frameMs', label: 'Frame', format: (value) => `${Number(value).toFixed(1)} ms` },
			{ id: 'droppedSteps', label: 'Dropped' },
		],
		createSession: (options) => createParametricOriginalSession(bundle, options),
		createInteractionController: createCenterInteractionController,
		parseInput,
		validateParameters: (parameters) => {
			const formulas = compileParametricOriginalFormulaPair(parameters)
			return formulas.ok ? { ok: true, value: undefined } : formulas
		},
		toDurableState: (parameters, seed) => ({ parameters, seed }),
		fromDurableState: (state) => state,
		migrateLegacyUrl: (url) => {
			const match = new RegExp(`^#/${bundle.spec.legacyRouteName}-([^?]+)(?:\\?.*)?$`).exec(url.hash)
			if (!match) return undefined
			const presetId = match[1] ?? ''
			const parameters = legacyPreset(defaults, presetId)
			return parameters
				? { ok: true, value: { parameters, seed: `legacy-${bundle.definition.id}-${presetId}` } }
				: { ok: false, error: `Legacy ${original.title} preset '${presetId}' is unsupported.` }
		},
	})
}

export const parametricOriginalPlugins = parametricOriginalDefinitions.map(createParametricOriginalPlugin)
