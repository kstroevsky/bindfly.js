import { memo } from 'react'

import type { ParameterSchema, ParameterValues } from '../../../src-v2/core/parameters.ts'
import { createParameterControlModels } from './parameter-control-model.ts'

interface ParameterControlsProps<Schema extends ParameterSchema> {
	readonly schema: Schema
	readonly values: ParameterValues<Schema>
	readonly onChange: (parameterId: keyof Schema & string, value: unknown) => void
}

const ParameterControlsInner = <Schema extends ParameterSchema>({ schema, values, onChange }: ParameterControlsProps<Schema>) => (
	<section className="controls" aria-label="Parameters">
		{createParameterControlModels(schema, values).map((model) => {
			const inputId = `parameter-${model.id}`
			const descriptionId = `${inputId}-description`
			const definition = model.definition
			let control

			switch (definition.kind) {
				case 'number':
					control = <input
						id={inputId}
						type={definition.min !== undefined && definition.max !== undefined ? 'range' : 'number'}
						value={model.value as number}
						min={definition.min}
						max={definition.max}
						step={definition.step}
						aria-describedby={descriptionId}
						onChange={(event) => onChange(model.id as keyof Schema & string, event.currentTarget.valueAsNumber)}
					/>
					break
				case 'boolean':
					control = <input id={inputId} type="checkbox" checked={model.value as boolean} aria-describedby={descriptionId} onChange={(event) => onChange(model.id as keyof Schema & string, event.currentTarget.checked)} />
					break
				case 'string':
					control = <input id={inputId} type="text" value={model.value as string} maxLength={definition.maxLength} aria-describedby={descriptionId} onChange={(event) => onChange(model.id as keyof Schema & string, event.currentTarget.value)} />
					break
				case 'enum':
					control = <select id={inputId} value={model.value as string} aria-describedby={descriptionId} onChange={(event) => onChange(model.id as keyof Schema & string, event.currentTarget.value)}>{definition.values.map((value) => <option key={value} value={value}>{value}</option>)}</select>
					break
			}

			return <label className="control" key={model.id} htmlFor={inputId}>
				<span className="control-row"><span>{model.label}</span><output htmlFor={inputId}>{String(model.value)}{model.units ? ` ${model.units}` : ''}</output></span>
				{control}
				<small id={descriptionId} className="control-meta">{model.invalidation.replace('-', ' ')}</small>
			</label>
		})}
	</section>
)

export const ParameterControls = memo(ParameterControlsInner) as typeof ParameterControlsInner
