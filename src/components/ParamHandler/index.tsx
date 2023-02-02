import React, { memo, useCallback, useEffect, useState } from 'react';
import type { FC } from 'react';

import { useThrottle } from '../../hooks';
import { PARAMS_HANDLER_DEBOUNCE_DELAY } from '../../shared/constants';
import type { TCallable } from '../../shared/types';

import './styles.css';

export interface IParamHandlerProps {
	step: number;
	min: number;
	max: number;
	initialValue: number;
	onChange: TCallable<void, number>;
}

const ParamHandler: FC<IParamHandlerProps> = ({
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

	return (
		<input
			className={'counter'}
			type={'range'}
			min={min}
			max={max || initialValue * 2}
			step={step}
			value={state}
			onChange={handleChange}
		/>
	);
};

export default memo(ParamHandler);
