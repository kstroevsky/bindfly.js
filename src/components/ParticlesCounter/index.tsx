import React, { memo, useCallback, useEffect, useState } from 'react';
import type { FC } from 'react';

import { useThrottle } from '../../hooks';
import type { TCallable } from '../../shared/types';

import './styles.css';

export interface IParticlesCounterProps {
	initialValue: number;
	onChange: TCallable<void, number>;
}

const ParticlesCounter: FC<IParticlesCounterProps> = ({
	onChange,
	initialValue,
}) => {
	const [count, setCount] = useState<number>(initialValue);

	const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		setCount(parseInt(e.target.value));
	}, []);

	const changeCount = useCallback(
		useThrottle(150, (count: number) => onChange(count)),
		[]
	);

	useEffect(() => {
		changeCount(count);
	}, [count]);

	return (
		<input
			className={'counter'}
			type={'range'}
			min={0}
			max={initialValue < 20 ? 300 : initialValue * 5}
			value={count}
			onChange={handleChange}
		/>
	);
};

export default memo(ParticlesCounter);
