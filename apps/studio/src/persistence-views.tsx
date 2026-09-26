import type { PersistenceInterval, RipsPersistenceResult } from '../../../src-v2/analysis/rips-persistence.ts'

const MAX_BARCODE_INTERVALS_PER_DIMENSION = 60
const MAX_DIAGRAM_POINTS_PER_DIMENSION = 100

const intervalLength = (interval: PersistenceInterval, epsilonMax: number): number =>
	(interval.death ?? epsilonMax) - interval.birth

const selectLongest = (
	intervals: readonly PersistenceInterval[],
	epsilonMax: number,
	limit: number,
): readonly PersistenceInterval[] => intervals.length <= limit
	? intervals
	: [...intervals]
		.sort((left, right) => intervalLength(right, epsilonMax) - intervalLength(left, epsilonMax) || left.birth - right.birth)
		.slice(0, limit)

const clampUnit = (value: number): number => Math.max(0, Math.min(1, value))

const xFor = (value: number, epsilonMax: number): number => 34 + clampUnit(value / epsilonMax) * 252
const yForDiagram = (value: number, epsilonMax: number): number => 108 - clampUnit(value / epsilonMax) * 88

const BarcodeRows = ({
	intervals,
	epsilonMax,
	yStart,
	yEnd,
	className,
}: {
	readonly intervals: readonly PersistenceInterval[]
	readonly epsilonMax: number
	readonly yStart: number
	readonly yEnd: number
	readonly className: string
}) => {
	const visible = selectLongest(intervals, epsilonMax, MAX_BARCODE_INTERVALS_PER_DIMENSION)
	return <>{visible.map((interval, index) => {
		const y = visible.length <= 1 ? (yStart + yEnd) / 2 : yStart + index / (visible.length - 1) * (yEnd - yStart)
		return <line
			className={interval.death === null ? `${className} persistence-censored` : className}
			key={`${interval.birth}-${String(interval.death)}-${index}`}
			x1={xFor(interval.birth, epsilonMax)}
			x2={xFor(interval.death ?? epsilonMax, epsilonMax)}
			y1={y}
			y2={y}
		/>
	})}</>
}

export const PersistenceViews = ({ result, epsilon }: {
	readonly result: RipsPersistenceResult
	readonly epsilon: number
}) => {
	if (result.status !== 'computed') return null
	const cursorX = xFor(epsilon, result.epsilonMax)
	const h0Points = selectLongest(result.h0, result.epsilonMax, MAX_DIAGRAM_POINTS_PER_DIMENSION)
	const h1Points = selectLongest(result.h1, result.epsilonMax, MAX_DIAGRAM_POINTS_PER_DIMENSION)
	const omittedBarcode = Math.max(0, result.h0.length - MAX_BARCODE_INTERVALS_PER_DIMENSION)
		+ Math.max(0, result.h1.length - MAX_BARCODE_INTERVALS_PER_DIMENSION)
	const omittedDiagram = Math.max(0, result.h0.length - MAX_DIAGRAM_POINTS_PER_DIMENSION)
		+ Math.max(0, result.h1.length - MAX_DIAGRAM_POINTS_PER_DIMENSION)

	return <div className="persistence-views">
		<figure className="persistence-card">
			<figcaption><strong>Barcode</strong><span>H₀ + H₁ · εmax {result.epsilonMax.toFixed(0)} px</span></figcaption>
			<svg viewBox="0 0 300 122" role="img" aria-label="Persistence barcode">
				<text x="4" y="34">H₀</text>
				<text x="4" y="88">H₁</text>
				<line className="persistence-axis" x1="34" x2="286" y1="112" y2="112" />
				<line className="persistence-cursor" x1={cursorX} x2={cursorX} y1="10" y2="112" />
				<BarcodeRows intervals={result.h0} epsilonMax={result.epsilonMax} yStart={16} yEnd={52} className="persistence-h0" />
				<BarcodeRows intervals={result.h1} epsilonMax={result.epsilonMax} yStart={66} yEnd={102} className="persistence-h1" />
			</svg>
			{omittedBarcode > 0 ? <small>Showing the {MAX_BARCODE_INTERVALS_PER_DIMENSION} longest intervals per dimension; {omittedBarcode} shorter intervals are hidden visually.</small> : null}
		</figure>

		<figure className="persistence-card">
			<figcaption><strong>Persistence diagram</strong><span>birth → death</span></figcaption>
			<svg viewBox="0 0 300 122" role="img" aria-label="Persistence diagram">
				<line className="persistence-axis" x1="34" x2="286" y1="108" y2="108" />
				<line className="persistence-axis" x1="34" x2="34" y1="20" y2="108" />
				<line className="persistence-diagonal" x1="34" x2="286" y1="108" y2="20" />
				<line className="persistence-cursor" x1={cursorX} x2={cursorX} y1="20" y2="108" />
				<line className="persistence-cursor" x1="34" x2="286" y1={yForDiagram(epsilon, result.epsilonMax)} y2={yForDiagram(epsilon, result.epsilonMax)} />
				{h0Points.map((interval, index) => <circle
					className={interval.death === null ? 'persistence-h0-point persistence-censored-point' : 'persistence-h0-point'}
					key={`h0-${interval.birth}-${String(interval.death)}-${index}`}
					cx={xFor(interval.birth, result.epsilonMax)}
					cy={yForDiagram(interval.death ?? result.epsilonMax, result.epsilonMax)}
					r="2.2"
				/>)}
				{h1Points.map((interval, index) => <circle
					className={interval.death === null ? 'persistence-h1-point persistence-censored-point' : 'persistence-h1-point'}
					key={`h1-${interval.birth}-${String(interval.death)}-${index}`}
					cx={xFor(interval.birth, result.epsilonMax)}
					cy={yForDiagram(interval.death ?? result.epsilonMax, result.epsilonMax)}
					r="2.2"
				/>)}
				<text x="272" y="120">birth</text>
				<text x="2" y="20">death</text>
			</svg>
			{omittedDiagram > 0 ? <small>Showing the {MAX_DIAGRAM_POINTS_PER_DIMENSION} longest intervals per dimension; {omittedDiagram} shorter intervals are hidden visually.</small> : null}
		</figure>
	</div>
}
