import type { FlyingPoints, FlyingPointsGL } from '../2d/templates'
import type { IProperty } from '../types'

export default abstract class CanvasAnimation {
	abstract properties: IProperty;
	abstract particles?: FlyingPoints['particles'] | FlyingPointsGL['particles'];
	abstract spiralRadius?: number;
	abstract sizes?: {
		width: number;
		height: number;
	};

	abstract init(): void;
	abstract loop(): void;
	abstract clear(): void;
}
