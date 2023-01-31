import React, { memo, useCallback, useEffect, useState } from 'react';
import type { FC } from 'react';

import { useThrottle } from '../../hooks';
import type { TCallable } from '../../shared/types';

import './styles.css';

export interface IVelocityCounterProps {
	initialValue: number;
	onChange: TCallable<void, number>;
}

const VelocityCounter: FC<IVelocityCounterProps> = ({
	onChange,
	initialValue,
}) => {
	const [velocity, setVelocity] = useState<number>(initialValue);

	const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		setVelocity(Number(e.target.value));
	}, []);

	const changeVelocity = useCallback(
		useThrottle(150, (velocity: number) => onChange(velocity)),
		[]
	);

	useEffect(() => {
		changeVelocity(velocity);
	}, [velocity]);

	return (
		<input
			className={'counter'}
			type={'range'}
			min={0}
			max={20}
			value={velocity}
			step={0.1}
			onChange={handleChange}
		/>
	);
};

export default memo(VelocityCounter);
