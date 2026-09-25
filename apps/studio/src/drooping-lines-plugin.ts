import type { Result } from '../../../src-v2/core/result.ts'
import { droopingLinesDefinition } from '../../../src-v2/effects/drooping-lines/definition.ts'
import { compileDroopingFormulaPair } from '../../../src-v2/effects/drooping-lines/formula.ts'
import type { DroopingLinesInput, DroopingLinesParameters } from '../../../src-v2/effects/drooping-lines/types.ts'
import { bindflyOriginals } from '../../../src-v2/formula/index.ts'
import { createDroopingLinesSession } from './drooping-lines-session.ts'
import { parseMovingPointInput } from './moving-point-input.ts'
import { createMovingPointInteractionController } from './moving-point-interaction.ts'
import { defineStudioExperiment } from './studio-experiment-plugin.ts'

const parseInput = (value: unknown): Result<DroopingLinesInput, string> => {
	try { return { ok: true, value: parseMovingPointInput(value) } } catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : 'Drooping Lines input is invalid.' }
	}
}

const formulaParameters = droopingLinesDefinition.presets?.[0]?.parameters
if (!formulaParameters) throw new Error('Drooping Lines formula defaults are unavailable.')
const legacy = (parameters: Partial<DroopingLinesParameters>, formulaMorph: number): DroopingLinesParameters => ({
	...formulaParameters,
	...parameters,
	formulaMorph,
})
const legacyPresets: Readonly<Record<string, DroopingLinesParameters>> = {
	Simple: legacy({ particleCount: 100, maxSpeed: 60, connectionRadius: 250, background: 'rgba(0, 0, 0, 0.7)' }, 0),
	SwitchColor: legacy({ particleCount: 100, maxSpeed: 120, connectionRadius: 150, background: 'rgba(255, 255, 0, 0.7)' }, 0),
	'Monochrome&Clickable': legacy({ particleCount: 100, maxSpeed: 120, connectionRadius: 150, background: 'rgb(255, 255, 255)' }, 1),
	AddByClick: legacy({ particleCount: 100, maxSpeed: 120, connectionRadius: 200, background: 'rgba(0, 0, 0, 0.7)' }, 1),
	Blank: legacy({ particleCount: 1, maxSpeed: 120, connectionRadius: 200, background: 'rgba(0, 0, 0, 0.7)' }, 1),
}

export const droopingLinesPlugin = defineStudioExperiment({
	definition: droopingLinesDefinition,
	title: 'Drooping Lines',
	defaultSeed: 'bindfly-drooping-lines-simple-v1',
	formulaViews: ['morph', 'compare'],
	provenance: ['drooping-tan-x', 'drooping-atan-y'].map((id) => {
		const original = bindflyOriginals[id as 'drooping-tan-x' | 'drooping-atan-y']
		return {
			id: original.id,
			format: original.format,
			version: original.version,
			legacyPath: original.provenance.legacyPath,
			legacyGitBlob: original.provenance.legacyGitBlob,
			capturedBehavior: original.provenance.capturedBehavior,
		}
	}),
	metrics: [
		{ id: 'points', label: 'Points' },
		{ id: 'edges', label: 'Lines' },
		{ id: 'step', label: 'Step' },
		{ id: 'frameMs', label: 'Frame', format: (value) => `${Number(value).toFixed(1)} ms` },
		{ id: 'droppedSteps', label: 'Dropped' },
	],
	createSession: createDroopingLinesSession,
	createInteractionController: createMovingPointInteractionController,
	parseInput,
	validateParameters: (parameters) => {
		const compiled = compileDroopingFormulaPair(parameters)
		return compiled.ok ? { ok: true, value: undefined } : compiled
	},
	toDurableState: (parameters, seed) => ({ parameters, seed }),
	fromDurableState: (state) => state,
	migrateLegacyUrl: (url) => {
		const match = /^#\/DroopingLines-([^?]+)(?:\?.*)?$/.exec(url.hash)
		if (!match) return undefined
		const presetId = match[1]
		const parameters = presetId ? legacyPresets[presetId] : undefined
		return parameters
			? { ok: true, value: { parameters, seed: `legacy-drooping-lines-${presetId}` } }
			: { ok: false, error: `Legacy Drooping Lines preset '${presetId ?? ''}' is unsupported.` }
	},
})

export default droopingLinesPlugin
