import { DEFAULT_STUDIO_EXPERIMENT_ID, getStudioExperimentPlugin } from './studio-experiment-registry.ts'
import { migrateLegacyUrl } from './studio-state.ts'

export const defaultStudioRoute = `#/lab/${DEFAULT_STUDIO_EXPERIMENT_ID}`

export const isStudioRoute = (url: URL): boolean => {
	const experimentId = /^#\/lab\/([^?]+)/.exec(url.hash)?.[1]
	if (experimentId) return getStudioExperimentPlugin(experimentId) !== undefined
	const legacy = migrateLegacyUrl(url)
	return !legacy.ok || legacy.value !== undefined
}
