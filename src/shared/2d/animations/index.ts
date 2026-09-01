// import FlyingLines from './FlyingLines'
// import DroopingLines from './DroopingLines'
// import FlyingLinesGL from './FlyingLinesGL'
// import FlyingCubesGL from './FlyingCubesGL'
// import SpiralFlyingLines from './SpiralFlyingLines'
// import Pulse from './Pulse'
// import Spiral from './Spiral'
// import Spiral2 from './Spiral2'
// import Spiral3 from './Spiral3'

const FlyingLines = async () => await import('./FlyingLines')
const DroopingLines = async () => await import('./DroopingLines')
const FlyingLinesGL = async () => await import('./FlyingLinesGL')
const FlyingCubesGL = async () => await import('./FlyingCubesGL')
const SpiralFlyingLines = async () => await import('./SpiralFlyingLines')
const Pulse = async () => await import('./Pulse')
const Spiral = async () => await import('./Spiral')
const Spiral2 = async () => await import('./Spiral2')
const Spiral3 = async () => await import('./Spiral3')

export { FlyingLines, DroopingLines, FlyingLinesGL, FlyingCubesGL, SpiralFlyingLines, Pulse, Spiral, Spiral2, Spiral3 }
