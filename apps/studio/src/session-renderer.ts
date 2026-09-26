export const requireHtmlCanvas = (
	canvas: HTMLCanvasElement | OffscreenCanvas,
	experimentTitle: string,
): HTMLCanvasElement => {
	if (typeof HTMLCanvasElement === 'undefined' || !(canvas instanceof HTMLCanvasElement)) {
		throw new Error(`${experimentTitle} WebGL2 rendering requires a main-thread HTMLCanvasElement.`)
	}
	return canvas
}
