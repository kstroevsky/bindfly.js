import { createExperimentRegistry } from '../../../src-v2/core/registry.ts'
import { droopingLinesPlugin } from './drooping-lines-plugin.ts'
import { flyingLinesPlugin } from './flying-lines-plugin.ts'
import { parametricOriginalPlugins } from './parametric-original-plugin.ts'
import type { StudioExperimentPlugin } from './studio-experiment-plugin.ts'
import { vectorFieldPlugin } from './vector-field-plugin.ts'

const plugins: readonly StudioExperimentPlugin[] = [
	droopingLinesPlugin,
	flyingLinesPlugin,
	...parametricOriginalPlugins,
	vectorFieldPlugin,
]
const pluginsById = new Map(plugins.map((plugin) => [plugin.id, plugin]))

export const DEFAULT_STUDIO_EXPERIMENT_ID = flyingLinesPlugin.id

export const studioExperimentRegistry = createExperimentRegistry<StudioExperimentPlugin>()

for (const plugin of plugins) {
	studioExperimentRegistry.register({ id: plugin.id, load: () => Promise.resolve({ default: plugin }) })
}

export const getStudioExperimentPlugin = (id: string): StudioExperimentPlugin | undefined => pluginsById.get(id)
export const listStudioExperimentPlugins = (): readonly StudioExperimentPlugin[] =>
	[...plugins].sort((left, right) => left.id.localeCompare(right.id))
