import type { AuthoritativeSubmitResult } from '../../../src-v2/collaboration/index.ts'
import type { RenderFrame } from '../../../src-v2/core/index.ts'
import type { ExperimentTelemetry } from './experiment-session.ts'
import type { SharedExperimentClient } from './shared-experiment-client.ts'

export const CONNECTIVITY_GAME_ID = 'connect-within-edits-v1'
export const CONNECTIVITY_GAME_MAX_ACCEPTED_EDITS = 5

export interface CollaborativeGameClient {
	readonly currentStepIndex: number
	readonly session: {
		render(frame: RenderFrame): Readonly<ExperimentTelemetry>
	}
	submit(input: unknown): Promise<AuthoritativeSubmitResult<unknown>>
}

export interface ConnectivityGameStatus {
	readonly gameId: typeof CONNECTIVITY_GAME_ID
	readonly acceptedEdits: number
	readonly maximumAcceptedEdits: number
	readonly points: number
	readonly beta0: number
	readonly complete: boolean
	readonly exhausted: boolean
}

export class ConnectivityCollaborativeGame {
	private readonly client: CollaborativeGameClient
	private acceptedEdits = 0
	private frameIndex = 0

	constructor(client: CollaborativeGameClient) {
		this.client = client
	}

	async submit(input: unknown): Promise<AuthoritativeSubmitResult<unknown>> {
		if (this.acceptedEdits >= CONNECTIVITY_GAME_MAX_ACCEPTED_EDITS) {
			throw new Error(`Connectivity game edit budget of ${CONNECTIVITY_GAME_MAX_ACCEPTED_EDITS} is exhausted.`)
		}
		const result = await this.client.submit(input)
		if (result.ok && !result.duplicate) this.acceptedEdits += 1
		return result
	}

	status(): ConnectivityGameStatus {
		const telemetry = this.client.session.render({
			frameIndex: this.frameIndex++,
			simulationStepIndex: this.client.currentStepIndex,
			interpolationAlpha: 0,
		})
		const complete = telemetry.points >= 2 && telemetry.components === 1
		return Object.freeze({
			gameId: CONNECTIVITY_GAME_ID,
			acceptedEdits: this.acceptedEdits,
			maximumAcceptedEdits: CONNECTIVITY_GAME_MAX_ACCEPTED_EDITS,
			points: telemetry.points,
			beta0: telemetry.components,
			complete,
			exhausted: !complete && this.acceptedEdits >= CONNECTIVITY_GAME_MAX_ACCEPTED_EDITS,
		})
	}
}

export const createConnectivityCollaborativeGame = (
	client: SharedExperimentClient,
): ConnectivityCollaborativeGame => new ConnectivityCollaborativeGame(client)
