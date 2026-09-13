import type { FlyingLinesParameters, FlyingLinesState } from './types.ts'

export const applyFlyingLinesHotParameters = (
	state: FlyingLinesState,
	parameters: Pick<FlyingLinesParameters, 'background' | 'connectionRadius'>,
): void => {
	state.background = parameters.background
	state.connectionRadius = parameters.connectionRadius
}
