export interface ScheduledInput<Input> {
	readonly stepIndex: number
	readonly input: Input
}

export interface PointInput {
	readonly pointerId: number
	readonly worldX: number
	readonly worldY: number
}
