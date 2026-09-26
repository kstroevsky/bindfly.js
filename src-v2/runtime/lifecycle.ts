export type RuntimeState =
	| 'idle'
	| 'initializing'
	| 'ready'
	| 'running'
	| 'paused'
	| 'failed'
	| 'disposing'
	| 'disposed'

const transitions: Readonly<Record<RuntimeState, readonly RuntimeState[]>> = {
	idle: ['initializing', 'disposing'],
	initializing: ['ready', 'failed', 'disposing'],
	ready: ['running', 'failed', 'disposing'],
	running: ['paused', 'failed', 'disposing'],
	paused: ['running', 'failed', 'disposing'],
	failed: ['disposing'],
	disposing: ['disposed'],
	disposed: [],
}

export const canTransitionRuntime = (from: RuntimeState, to: RuntimeState): boolean =>
	transitions[from].includes(to)

export class RuntimeTransitionError extends Error {
	readonly from: RuntimeState
	readonly to: RuntimeState

	constructor(from: RuntimeState, to: RuntimeState) {
		super(`Runtime cannot transition from '${from}' to '${to}'.`)
		this.name = 'RuntimeTransitionError'
		this.from = from
		this.to = to
	}
}

export const assertRuntimeTransition = (from: RuntimeState, to: RuntimeState): void => {
	if (!canTransitionRuntime(from, to)) throw new RuntimeTransitionError(from, to)
}
