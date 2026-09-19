import { memo, useState } from 'react'
import type { KeyboardEvent } from 'react'

import type { ParameterSchema, ParameterValues, StringParameterDefinition } from '../../../src-v2/core/parameters.ts'
import { createParameterControlModels } from './parameter-control-model.ts'
import type { StudioParameterValues } from './studio-experiment-plugin.ts'

interface ParameterControlsProps {
	readonly schema: ParameterSchema
	readonly values: StudioParameterValues
	readonly onChange: (parameterId: string, value: unknown) => void
}

interface FormulaControlProps {
	readonly definition: StringParameterDefinition
	readonly id: string
	readonly inputId: string
	readonly descriptionId: string
	readonly label: string
	readonly value: string
	readonly onCommit: (parameterId: string, value: string) => void
}

const FormulaControl = ({ definition, id, inputId, descriptionId, label, value, onCommit }: FormulaControlProps) => {
	const [draft, setDraft] = useState(value)
	const commit = () => onCommit(id, draft)
	const restoreDefault = () => {
		setDraft(definition.default)
		onCommit(id, definition.default)
	}
	const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault()
			commit()
		} else if (event.key === 'Escape') {
			setDraft(value)
		}
	}

	return <>
		<textarea
			id={inputId}
			className="formula-editor"
			value={draft}
			maxLength={definition.maxLength}
			rows={2}
			spellCheck={false}
			aria-describedby={descriptionId}
			onChange={(event) => setDraft(event.currentTarget.value)}
			onKeyDown={handleKeyDown}
		/>
		<span className="formula-actions">
			<small id={descriptionId}>Enter or Apply to update · Esc to restore</small>
			<span className="formula-buttons">
				<button type="button" aria-label={`Restore default ${label}`} onClick={restoreDefault}>Default</button>
				<button type="button" aria-label={`Apply ${label}`} onClick={commit}>Apply</button>
			</span>
		</span>
	</>
}

const ParameterControlsInner = ({ schema, values, onChange }: ParameterControlsProps) => (
	<section className="controls" aria-label="Parameters">
		{createParameterControlModels(schema, values as ParameterValues<ParameterSchema>).map((model) => {
			const inputId = `parameter-${model.id}`
			const descriptionId = `${inputId}-description`
			const definition = model.definition
			const formulaControl = definition.kind === 'string' && definition.control === 'formula'
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
						onChange={(event) => onChange(model.id, event.currentTarget.valueAsNumber)}
					/>
					break
				case 'boolean':
					control = <input id={inputId} type="checkbox" checked={model.value as boolean} aria-describedby={descriptionId} onChange={(event) => onChange(model.id, event.currentTarget.checked)} />
					break
				case 'string':
					control = formulaControl
						? <FormulaControl
							key={`${model.id}:${String(model.value)}`}
							definition={definition}
							id={model.id}
							inputId={inputId}
							descriptionId={descriptionId}
							label={model.label}
							value={model.value as string}
							onCommit={onChange}
						/>
						: <input id={inputId} type="text" value={model.value as string} maxLength={definition.maxLength} aria-describedby={descriptionId} onChange={(event) => onChange(model.id, event.currentTarget.value)} />
					break
				case 'enum':
					control = <select id={inputId} value={model.value as string} aria-describedby={descriptionId} onChange={(event) => onChange(model.id, event.currentTarget.value)}>{definition.values.map((value) => <option key={value} value={value}>{value}</option>)}</select>
					break
			}

			return formulaControl
				? <div className="control control--formula" key={model.id}>
					<label className="control-row" htmlFor={inputId}>{model.label}</label>
					{control}
				</div>
				: <label className="control" key={model.id} htmlFor={inputId}>
					<span className="control-row"><span>{model.label}</span><output htmlFor={inputId}>{String(model.value)}{model.units ? ` ${model.units}` : ''}</output></span>
					{control}
					<small id={descriptionId} className="control-meta">{model.invalidation.replace('-', ' ')}</small>
				</label>
		})}
	</section>
)

export const ParameterControls = memo(ParameterControlsInner)
