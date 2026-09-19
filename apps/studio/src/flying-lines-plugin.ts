import type { Result } from '../../../src-v2/core/result.ts'
import { flyingLinesDefinition } from '../../../src-v2/effects/flying-lines/definition.ts'
import type { FlyingLinesInput, FlyingLinesParameters } from '../../../src-v2/effects/flying-lines/types.ts'
import { createFlyingLinesSession } from './flying-lines-session.ts'
import { parseMovingPointInput } from './moving-point-input.ts'
import { createMovingPointInteractionController } from './moving-point-interaction.ts'
import { defineStudioExperiment } from './studio-experiment-plugin.ts'

const parseInput = (value: unknown): Result<FlyingLinesInput, string> => {
	try {
		return { ok: true, value: parseMovingPointInput(value) }
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : 'Flying Lines input is invalid.' }
	}
}

const legacyPresets: Readonly<Record<string, FlyingLinesParameters>> = {
	Simple: { particleCount: 100, maxSpeed: 60, connectionRadius: 250, particleLifetimeSeconds: 20, margin: 20, background: 'rgba(0, 0, 0, 0.7)' },
	SwitchColor: { particleCount: 100, maxSpeed: 120, connectionRadius: 150, particleLifetimeSeconds: 20, margin: 20, background: 'rgba(255, 255, 0, 0.7)' },
	'Monochrome&Clickable': { particleCount: 100, maxSpeed: 120, connectionRadius: 150, particleLifetimeSeconds: 20, margin: 20, background: 'rgb(255, 255, 255)' },
	AddByClick: { particleCount: 100, maxSpeed: 120, connectionRadius: 200, particleLifetimeSeconds: 20, margin: 20, background: 'rgba(0, 0, 0, 0.7)' },
	Blank: { particleCount: 1, maxSpeed: 120, connectionRadius: 200, particleLifetimeSeconds: 20, margin: 20, background: 'rgba(0, 0, 0, 0.7)' },
}

export const flyingLinesPlugin = defineStudioExperiment({
	definition: flyingLinesDefinition,
	title: 'Flying Lines',
	defaultSeed: 'bindfly-flying-lines-simple-v1',
	metrics: [
		{ id: 'points', label: 'Points' },
		{ id: 'edges', label: 'Edges' },
		{ id: 'components', label: 'β₀' },
		{ id: 'step', label: 'Step' },
		{ id: 'frameMs', label: 'Frame', format: (value) => `${Number(value).toFixed(1)} ms` },
		{ id: 'droppedSteps', label: 'Dropped' },
	],
	createSession: createFlyingLinesSession,
	createInteractionController: createMovingPointInteractionController,
	parseInput,
	toDurableState: (parameters, seed) => ({ parameters, seed }),
	fromDurableState: (state) => state,
	migrateLegacyUrl: (url) => {
		const match = /^#\/FlyingLines-([^?]+)(?:\?.*)?$/.exec(url.hash)
		if (!match) return undefined
		const presetId = match[1]
		const parameters = presetId ? legacyPresets[presetId] : undefined
		return parameters
			? { ok: true, value: { parameters, seed: `legacy-flying-lines-${presetId}` } }
			: { ok: false, error: `Legacy Flying Lines preset '${presetId ?? ''}' is unsupported.` }
	},
})

export default flyingLinesPlugin
