export default abstract class CanvasAnimation {
	abstract spiralRadius?: number
	abstract properties?: any
	abstract sizes?: any
	abstract particles?: any[];
	abstract init(): void;
	abstract loop(): void;
	abstract clear(): void;
}
