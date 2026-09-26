import { createViewport } from '../../../src-v2/core/index.ts'
import { connectSharedExperiment } from './shared-experiment-client.ts'
import type { SharedExperimentClient } from './shared-experiment-client.ts'
import { getStudioExperimentPlugin } from './studio-experiment-registry.ts'

interface BrowserHarnessConnectionOptions {
	readonly url: string
	readonly roomId: string
	readonly participantId: string
}

interface BrowserHarnessStatus {
	readonly connected: boolean
	readonly currentStepIndex: number
	readonly lastAppliedSequence: number
	readonly requiresResynchronization: boolean
	readonly stateBase64Url: string
}

export interface CollaborationBrowserTestHarness {
	connect(options: BrowserHarnessConnectionOptions): Promise<void>
	submit(input: unknown): Promise<unknown>
	diverge(input: unknown): void
	disconnect(): Promise<void>
	reconnect(): Promise<void>
	waitForIdle(): Promise<void>
	status(): BrowserHarnessStatus
	dispose(): Promise<void>
}

const bytesToBase64Url = (bytes: Uint8Array): string => {
	let binary = ''
	for (const byte of bytes) binary += String.fromCharCode(byte)
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

export const installCollaborationBrowserTestHarness = (): CollaborationBrowserTestHarness => {
	let client: SharedExperimentClient | undefined
	let canvas: HTMLCanvasElement | undefined
	const requireClient = (): SharedExperimentClient => {
		if (!client) throw new Error('Collaboration browser test harness is not connected.')
		return client
	}
	const harness: CollaborationBrowserTestHarness = {
		connect: async (options) => {
			if (client) await client.dispose()
			canvas?.remove()
			canvas = document.createElement('canvas')
			canvas.hidden = true
			document.body.append(canvas)
			client = await connectSharedExperiment({
				...options,
				resolvePlugin: getStudioExperimentPlugin,
				createSession: ({ plugin, configuration }) => plugin.createSession({
					canvas: canvas!,
					rendererId: 'canvas2d',
					parameters: configuration.parameters,
					formulaView: plugin.formulaViews[0] ?? 'morph',
					seed: configuration.seed,
					viewport: createViewport({
						cssWidth: configuration.simulationWidth,
						cssHeight: configuration.simulationHeight,
						devicePixelRatio: 1,
					}),
				}),
			})
		},
		submit: (input) => requireClient().submit(input),
		diverge: (input) => requireClient().session.applyInput(input),
		disconnect: () => requireClient().disconnect(),
		reconnect: () => requireClient().reconnect(),
		waitForIdle: () => requireClient().waitForIdle(),
		status: () => {
			const active = requireClient()
			const state = active.session.collaboration
			if (!state) throw new Error('Shared Studio session does not expose collaboration state.')
			return {
				connected: active.connected,
				currentStepIndex: active.currentStepIndex,
				lastAppliedSequence: active.lastAppliedSequence,
				requiresResynchronization: active.requiresResynchronization,
				stateBase64Url: bytesToBase64Url(state.captureStateBytes()),
			}
		},
		dispose: async () => {
			await client?.dispose()
			client = undefined
			canvas?.remove()
			canvas = undefined
		},
	}
	return harness
}
