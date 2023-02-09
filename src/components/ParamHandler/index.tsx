import React, { memo, useCallback, useEffect, useState } from 'react';
import type { FC } from 'react';

import { useThrottle } from '../../hooks';
import { PARAMS_HANDLER_DEBOUNCE_DELAY } from '../../shared/constants';
import type { TCallable } from '../../shared/types';

import './styles.css';

export interface IParamHandlerProps {
	name: string;
	step: number;
	min: number;
	max: number;
	initialValue: number;
	onChange: TCallable<void, number>;
}

const ParamHandler: FC<IParamHandlerProps> = ({
	name,
	step = 0,
	min = 1,
	max,
	initialValue,
	onChange,
}) => {
	const [state, setState] = useState<number>(initialValue);

	const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		setState(Number(e.target.value));
	}, []);

	const setParam = useCallback(
		useThrottle(PARAMS_HANDLER_DEBOUNCE_DELAY, (value: number) =>
			onChange(value)
		),
		[onChange]
	);

	useEffect(() => {
		setParam(state);
	}, [state]);

	const maxValue = max || initialValue * 2;
	const percent = (100 * (state - min)) / (maxValue - min);

	return (
		<>
			<div className={'count'}>
				<span className={'count-title'}>{name}</span>
				<div className={'count-container'}>
					<span className={'count-value'}>{state}</span>
					<span
						className={'count-pic'}
						style={{
							backgroundImage: `linear-gradient(90deg, black 0%, black ${percent}%, rgb(255,255,255) ${percent}%, rgb(255,255,255) 100%)`,
						}}
					/>
				</div>
			</div>
			<input
				className={'counter'}
				type={'range'}
				min={min}
				max={maxValue}
				step={step}
				value={state}
				onChange={handleChange}
			/>
		</>
	);
};

export default memo(ParamHandler);
