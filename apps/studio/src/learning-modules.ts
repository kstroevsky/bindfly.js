import type { RipsComplexResult } from '../../../src-v2/analysis/rips-complex.ts'
import type { StudioExperimentPlugin } from './studio-experiment-plugin.ts'
import type { ParameterSweepResult } from './parameter-sweep.ts'

export type LearningModuleId =
	| 'freeze-and-step'
	| 'formula-perturbation'
	| 'connectivity-at-scale'
	| 'parameter-sweep'

export interface LearningModule {
	readonly id: LearningModuleId
	readonly title: string
	readonly question: string
	readonly explanation: string
	readonly steps: readonly string[]
	readonly challenge: string
}

export interface LearningEvidence {
	readonly paused: boolean
	readonly singleStepCount: number
	readonly formulaTrailLength: number
	readonly analysis?: RipsComplexResult
	readonly sweep?: ParameterSweepResult
}

export type LearningChallengeStatus = 'not-started' | 'in-progress' | 'complete'

const MODULES: Readonly<Record<LearningModuleId, LearningModule>> = Object.freeze({
	'freeze-and-step': Object.freeze({
		id: 'freeze-and-step',
		title: 'Causality: freeze one mathematical moment',
		question: 'What changes when one fixed simulation step is advanced explicitly?',
		explanation: 'Freeze holds simulation state while keeping inspection live. Step advances exactly one fixed timestep, so a visible change can be attributed to one deterministic state transition.',
		steps: Object.freeze(['Freeze the simulation.', 'Inspect the current step.', 'Use Step once and compare the new state.']),
		challenge: 'Freeze the system and advance at least one explicit single step.',
	}),
	'formula-perturbation': Object.freeze({
		id: 'formula-perturbation',
		title: 'Formula causality',
		question: 'How much can a small formula or coefficient change alter the same frozen state?',
		explanation: 'A frozen formula perturbation keeps the simulation step fixed. Difference and Probe then compare mathematics against the same point identities and inputs instead of comparing unrelated trajectories.',
		steps: Object.freeze(['Freeze the simulation.', 'Change a formula or declared coefficient.', 'Use Compare or Probe to inspect the effect.']),
		challenge: 'Create at least two entries in the frozen formula trail.',
	}),
	'connectivity-at-scale': Object.freeze({
		id: 'connectivity-at-scale',
		title: 'Topology: connectivity at scale',
		question: 'At what distance scale does this point cloud become connected?',
		explanation: 'The analysis ε changes the Euclidean Rips graph over one pinned point cloud. β₀ counts connected components; moving ε changes connectivity without moving the underlying points.',
		steps: Object.freeze(['Analyze this frame.', 'Move analysis ε while keeping the snapshot pinned.', 'Watch β₀ merge toward one component.']),
		challenge: 'Find an ε where the pinned full point cloud has β₀ = 1.',
	}),
	'parameter-sweep': Object.freeze({
		id: 'parameter-sweep',
		title: 'Research: scan a declared coefficient',
		question: 'Which structural changes are associated with a controlled parameter change?',
		explanation: 'A sweep changes one declared numeric formula parameter over a reproducible range. Every sample records the same seed and analyzer provenance; frozen and dynamic sweeps have different causal meanings.',
		steps: Object.freeze(['Choose a declared formula parameter.', 'Choose frozen-state or dynamic semantics.', 'Run the bounded sweep and compare the small multiples with β₀/β₁ results.']),
		challenge: 'Complete one provenance-tagged parameter sweep.',
	}),
})

const hasFormulaParameter = (plugin: StudioExperimentPlugin): boolean =>
	Object.values(plugin.parameters).some((definition) =>
		definition.kind === 'number' && definition.semantic === 'formula-parameter')

export const listLearningModules = (plugin: StudioExperimentPlugin): readonly LearningModule[] => {
	const ids: LearningModuleId[] = []
	if (plugin.temporalSemantics.kind !== 'static') ids.push('freeze-and-step')
	if (plugin.formulaViews.length > 1) ids.push('formula-perturbation')
	if (plugin.pointCloudSources.length > 0) ids.push('connectivity-at-scale')
	if (plugin.pointCloudSources.length > 0 && hasFormulaParameter(plugin)) ids.push('parameter-sweep')
	return Object.freeze(ids.map((id) => MODULES[id]))
}

export const evaluateLearningChallenge = (
	moduleId: LearningModuleId,
	evidence: LearningEvidence,
): LearningChallengeStatus => {
	switch (moduleId) {
		case 'freeze-and-step':
			return evidence.singleStepCount > 0 && evidence.paused ? 'complete' : evidence.paused ? 'in-progress' : 'not-started'
		case 'formula-perturbation':
			return evidence.formulaTrailLength >= 2 ? 'complete' : evidence.paused ? 'in-progress' : 'not-started'
		case 'connectivity-at-scale':
			return evidence.analysis?.beta0 === 1 ? 'complete' : evidence.analysis ? 'in-progress' : 'not-started'
		case 'parameter-sweep':
			return evidence.sweep ? 'complete' : 'not-started'
	}
}
