import React, { memo, useCallback, useEffect, useState } from 'react';
import type { FC } from 'react';

import { useThrottle } from '../../hooks';
import type { TCallable } from '../../shared/types';

import './styles.css';

export interface ILineLengthCounterProps {
	initialValue: number;
	onChange: TCallable<void, number>;
}

const LineLengthCounter: FC<ILineLengthCounterProps> = ({
	onChange,
	initialValue,
}) => {
	const [lineLength, setLineLength] = useState<number>(initialValue);

	const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		setLineLength(Number(e.target.value));
	}, []);

	const changeLineLength = useCallback(
		useThrottle(150, (lineLength: number) => onChange(lineLength)),
		[]
	);

	useEffect(() => {
		changeLineLength(lineLength);
	}, [lineLength]);

	return (
		<>
			<span className={'count'}>LineLength: {lineLength}</span>
			<input
				className={'counter'}
				type={'range'}
				min={0}
				max={initialValue * 4}
				value={lineLength}
				onChange={handleChange}
			/>
		</>
	);
};

export default memo(LineLengthCounter);
