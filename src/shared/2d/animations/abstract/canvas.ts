import Abstract from '../../../types';

export default abstract class CanvasAnimation {
    abstract init(): void;
    abstract loop(): void;
    abstract clear(): void;
}
