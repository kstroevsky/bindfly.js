import type { Result } from '../../../src-v2/core/result.ts'
import { droopingLinesDefinition } from '../../../src-v2/effects/drooping-lines/definition.ts'
import type { DroopingLinesInput, DroopingLinesParameters } from '../../../src-v2/effects/drooping-lines/types.ts'
import { createDroopingLinesSession } from './drooping-lines-session.ts'
import { parseFlyingLinesInput } from './flying-lines-input.ts'
import { defineStudioExperiment } from './studio-experiment-plugin.ts'

const parseInput = (value: unknown): Result<DroopingLinesInput, string> => {
	try { return { ok: true, value: parseFlyingLinesInput(value) } } catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : 'Drooping Lines input is invalid.' }
	}
}

const legacyPresets: Readonly<Record<string, DroopingLinesParameters>> = {
	Simple: { particleCount: 100, maxSpeed: 60, connectionRadius: 250, particleLifetimeSeconds: 20, margin: 20, background: 'rgba(0, 0, 0, 0.7)', deformation: 'tan-x' },
	SwitchColor: { particleCount: 100, maxSpeed: 120, connectionRadius: 150, particleLifetimeSeconds: 20, margin: 20, background: 'rgba(255, 255, 0, 0.7)', deformation: 'tan-x' },
	'Monochrome&Clickable': { particleCount: 100, maxSpeed: 120, connectionRadius: 150, particleLifetimeSeconds: 20, margin: 20, background: 'rgb(255, 255, 255)', deformation: 'atan-y' },
	AddByClick: { particleCount: 100, maxSpeed: 120, connectionRadius: 200, particleLifetimeSeconds: 20, margin: 20, background: 'rgba(0, 0, 0, 0.7)', deformation: 'atan-y' },
	Blank: { particleCount: 1, maxSpeed: 120, connectionRadius: 200, particleLifetimeSeconds: 20, margin: 20, background: 'rgba(0, 0, 0, 0.7)', deformation: 'atan-y' },
}

export const droopingLinesPlugin = defineStudioExperiment({
	definition: droopingLinesDefinition,
	title: 'Drooping Lines',
	defaultSeed: 'bindfly-drooping-lines-simple-v1',
	metrics: [
		{ id: 'points', label: 'Points' },
		{ id: 'edges', label: 'Lines' },
		{ id: 'step', label: 'Step' },
		{ id: 'frameMs', label: 'Frame', format: (value) => `${Number(value).toFixed(1)} ms` },
		{ id: 'droppedSteps', label: 'Dropped' },
	],
	createSession: createDroopingLinesSession,
	createInteractionController: () => {
		let previous: { readonly x: number; readonly y: number } | undefined
		let moved = false
		return {
			handle: (event): readonly DroopingLinesInput[] => {
				if (event.phase === 'down') {
					if (event.shiftKey) return [{ type: 'remove-nearest', x: event.x, y: event.y, maxDistance: 18 }]
					previous = { x: event.x, y: event.y }
					moved = false
					return []
				}
				if (event.phase === 'move') {
					if (!previous || event.buttons === 0) return []
					if (Math.hypot(event.x - previous.x, event.y - previous.y) >= 2) moved = true
					const input: DroopingLinesInput = { type: 'move-nearest', fromX: previous.x, fromY: previous.y, x: event.x, y: event.y, maxDistance: 14 }
					previous = { x: event.x, y: event.y }
					return [input]
				}
				if (event.phase === 'up') {
					const shouldAdd = previous !== undefined && !moved
					previous = undefined
					return shouldAdd ? [{ type: 'add-point', x: event.x, y: event.y }] : []
				}
				previous = undefined
				return []
			},
		}
	},
	parseInput,
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
