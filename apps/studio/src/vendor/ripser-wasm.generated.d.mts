export interface RipserWasmModule {
	readonly FS: {
		writeFile(path: string, data: string): void
		unlink(path: string): void
	}
	callMain(arguments_: readonly string[]): number
}

export interface RipserWasmModuleOptions {
	readonly print?: (line: string) => void
	readonly printErr?: (line: string) => void
}

declare const createRipserWasmModule: (options?: RipserWasmModuleOptions) => Promise<RipserWasmModule>
export default createRipserWasmModule
