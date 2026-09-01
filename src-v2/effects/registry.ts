import { createExperimentRegistry } from '../core/index.ts'
import type { flyingLinesDefinition } from './flying-lines/definition.ts'

export type RegisteredExperimentDefinition = typeof flyingLinesDefinition

export const experimentRegistry = createExperimentRegistry<RegisteredExperimentDefinition>()

experimentRegistry.register({
	id: 'flying-lines',
	load: async () => ({
		default: (await import('./flying-lines/definition.ts')).default,
	}),
})
