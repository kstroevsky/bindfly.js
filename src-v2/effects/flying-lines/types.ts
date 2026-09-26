import type { ParameterValues } from '../../core/index.ts'
import type { MovingPointBuffer, MovingPointInput, MovingPointState } from '../moving-points/types.ts'

import type { flyingLinesParameters } from './parameters.ts'

export type FlyingLinesParameters = ParameterValues<typeof flyingLinesParameters>

export type FlyingLinesParticleBuffer = MovingPointBuffer
export type FlyingLinesState = MovingPointState
export type FlyingLinesInput = MovingPointInput
