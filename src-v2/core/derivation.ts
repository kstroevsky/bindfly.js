export interface Derivation<Input, Output> {
	readonly result: Readonly<Output>
	update(input: Readonly<Input>): Readonly<Output>
	dispose(): void
}
