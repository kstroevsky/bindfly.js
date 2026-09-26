export const SEEDED_RANDOM_ALGORITHM = 'xmur3-mulberry32-v1'

export interface SeededRandomSnapshot {
	readonly algorithm: typeof SEEDED_RANDOM_ALGORITHM
	readonly state: number
}

export interface RandomSource {
	next(): number
	nextBetween(minInclusive: number, maxExclusive: number): number
	snapshot(): SeededRandomSnapshot
}

const UINT32_RANGE = 4_294_967_296

const hashSeed = (seed: string) => {
	let hash = 1_779_033_703 ^ seed.length

	for (let index = 0; index < seed.length; index++) {
		hash = Math.imul(hash ^ seed.charCodeAt(index), 3_432_918_353)
		hash = (hash << 13) | (hash >>> 19)
	}

	hash = Math.imul(hash ^ (hash >>> 16), 2_246_822_507)
	hash = Math.imul(hash ^ (hash >>> 13), 3_266_489_909)
	return (hash ^ (hash >>> 16)) >>> 0
}

const createFromState = (initialState: number): RandomSource => {
	let state = initialState >>> 0
	const next = () => {
		state = (state + 0x6d2b79f5) >>> 0
		let value = state
		value = Math.imul(value ^ (value >>> 15), value | 1)
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
		return ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE
	}

	return {
		next,
		nextBetween: (minInclusive, maxExclusive) => {
			if (!Number.isFinite(minInclusive) || !Number.isFinite(maxExclusive) || maxExclusive <= minInclusive) {
				throw new RangeError('Random range must contain two finite ascending bounds.')
			}

			return minInclusive + (maxExclusive - minInclusive) * next()
		},
		snapshot: () => ({
			algorithm: SEEDED_RANDOM_ALGORITHM,
			state,
		}),
	}
}

export const createSeededRandom = (seed: string | number): RandomSource =>
	createFromState(hashSeed(String(seed)))

export const restoreSeededRandom = (snapshot: Readonly<{ algorithm: string; state: number }>): RandomSource => {
	if (snapshot.algorithm !== SEEDED_RANDOM_ALGORITHM) {
		throw new Error(`Unsupported seeded-random algorithm '${snapshot.algorithm}'.`)
	}

	if (!Number.isInteger(snapshot.state) || snapshot.state < 0 || snapshot.state >= UINT32_RANGE) {
		throw new RangeError('Seeded-random snapshot state must be an unsigned 32-bit integer.')
	}

	return createFromState(snapshot.state)
}
