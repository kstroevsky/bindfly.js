import type { PersistenceInterval } from '../../../src-v2/analysis/rips-persistence.ts'

export interface RipserPersistenceOutput {
	readonly h0: readonly PersistenceInterval[]
	readonly h1: readonly PersistenceInterval[]
}

const INTERVAL = /^\s*\[\s*([^,]+),\s*([^)]*)\)\s*$/
const HEADING = /^persistence intervals in dim (\d+):$/

const compareIntervals = (left: PersistenceInterval, right: PersistenceInterval): number =>
	left.birth - right.birth
	|| (left.death ?? Number.POSITIVE_INFINITY) - (right.death ?? Number.POSITIVE_INFINITY)

const parseNumber = (value: string, label: string): number => {
	const parsed = Number(value.trim())
	if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Ripser returned an invalid ${label} '${value}'.`)
	return parsed
}

export const parseRipserPersistenceOutput = (lines: readonly string[]): RipserPersistenceOutput => {
	const h0: PersistenceInterval[] = []
	const h1: PersistenceInterval[] = []
	let dimension: number | undefined
	for (const rawLine of lines) {
		const line = rawLine.trimEnd()
		const heading = HEADING.exec(line)
		if (heading) {
			dimension = Number(heading[1])
			continue
		}
		const interval = INTERVAL.exec(line)
		if (!interval) continue
		if (dimension !== 0 && dimension !== 1) continue
		const birthText = interval[1]
		const deathText = interval[2]
		if (birthText === undefined || deathText === undefined) throw new Error('Ripser interval output is incomplete.')
		const birth = parseNumber(birthText, 'birth')
		const death = deathText.trim() === '' ? null : parseNumber(deathText, 'death')
		if (death !== null && death < birth) throw new Error(`Ripser returned death ${death} before birth ${birth}.`)
		;(dimension === 0 ? h0 : h1).push({ birth, death })
	}
	h0.sort(compareIntervals)
	h1.sort(compareIntervals)
	return { h0, h1 }
}
