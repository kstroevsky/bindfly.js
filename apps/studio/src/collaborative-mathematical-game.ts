import type { AuthoritativeSubmitResult } from '../../../src-v2/collaboration/index.ts'
import type { RenderFrame } from '../../../src-v2/core/index.ts'
import type { ExperimentTelemetry } from './experiment-session.ts'
import type { SharedExperimentClient } from './shared-experiment-client.ts'

export const CONNECTIVITY_GAME_ID = 'connect-within-edits-v1'
export const CONNECTIVITY_GAME_MAX_ACCEPTED_EDITS = 5

export interface CollaborativeGameClient {
	readonly currentStepIndex: number
	readonly lastAppliedSequence: number
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
	private readonly gameStartSequence: number
	private frameIndex = 0

	constructor(client: CollaborativeGameClient, gameStartSequence: number) {
		if (!Number.isSafeInteger(gameStartSequence) || gameStartSequence < 0) {
			throw new RangeError('Connectivity game start sequence must be a non-negative safe integer.')
		}
		if (gameStartSequence > client.lastAppliedSequence) {
			throw new RangeError('Connectivity game start sequence cannot be ahead of the shared authoritative history.')
		}
		this.client = client
		this.gameStartSequence = gameStartSequence
	}

	private authoritativeEditCount(): number {
		const sequence = this.client.lastAppliedSequence
		if (!Number.isSafeInteger(sequence) || sequence < this.gameStartSequence) {
			throw new Error('Shared authoritative sequence regressed behind the connectivity game start.')
		}
		return sequence - this.gameStartSequence
	}

	async submit(input: unknown): Promise<AuthoritativeSubmitResult<unknown>> {
		if (this.authoritativeEditCount() >= CONNECTIVITY_GAME_MAX_ACCEPTED_EDITS) {
			throw new Error(`Connectivity game edit budget of ${CONNECTIVITY_GAME_MAX_ACCEPTED_EDITS} is exhausted.`)
		}
		return this.client.submit(input)
	}

	status(): ConnectivityGameStatus {
		const acceptedEdits = this.authoritativeEditCount()
		const telemetry = this.client.session.render({
			frameIndex: this.frameIndex++,
			simulationStepIndex: this.client.currentStepIndex,
			interpolationAlpha: 0,
		})
		const complete = telemetry.points >= 2
			&& telemetry.components === 1
			&& acceptedEdits <= CONNECTIVITY_GAME_MAX_ACCEPTED_EDITS
		return Object.freeze({
			gameId: CONNECTIVITY_GAME_ID,
			acceptedEdits,
			maximumAcceptedEdits: CONNECTIVITY_GAME_MAX_ACCEPTED_EDITS,
			points: telemetry.points,
			beta0: telemetry.components,
			complete,
			exhausted: !complete && acceptedEdits >= CONNECTIVITY_GAME_MAX_ACCEPTED_EDITS,
		})
	}
}

export const createConnectivityCollaborativeGame = (
	client: SharedExperimentClient,
	gameStartSequence: number,
): ConnectivityCollaborativeGame => new ConnectivityCollaborativeGame(client, gameStartSequence)
