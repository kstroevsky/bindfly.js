import React, { lazy, memo, forwardRef, useState, useCallback } from 'react';
import classnames from 'classnames';

import { CanvasHandlersConfig } from '../../router';
import type { CanvasAnimationsNames } from '../../router';
import type {
	IProperty,
	TParamHandleChangeName,
	TParamsHandlers,
	TParamsHandlersNames,
} from '../../shared/types';

import './styles.css';

const ParamHandler = lazy(() => import('../ParamHandler'));

export interface IParamHandlerContainerProps {
	properties: IProperty;
	handlers: TParamsHandlers;
	classId: CanvasAnimationsNames;
	keyToggle: boolean;
	offsetWidth: number;
}

const ParamHandlerContainer = forwardRef<
	HTMLDivElement,
	IParamHandlerContainerProps
>(({ properties, handlers, classId, keyToggle, offsetWidth }, ref) => {
	const [currentRangeIdx, setCurrentRangeIdx] = useState<number>(0);

	const handleClick = useCallback(
		(e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
			setCurrentRangeIdx(Number(e.currentTarget.dataset.item));
		},
		[]
	);

	return (
		<div
			ref={ref}
			key={`${+keyToggle}-ranges`}
			className={'animation-handlers'}
			style={{ width: `calc(100vw - ${offsetWidth}px)` }}
		>
			{CanvasHandlersConfig.map((item, idx) => {
				if (
					!item.visibility.includes(classId) ||
					!(!item.visibilityChecking || item.visibilityChecking(properties))
				) {
					return <></>;
				}

				const initialValue = properties[item.name] || 0;

				return (
					<div
						key={`${+keyToggle}-${item.name}-canvas`}
						data-item={idx}
						className={classnames('animation-handlers__item', {
							active: currentRangeIdx === idx,
						})}
						style={{
							backgroundImage: `radial-gradient(circle,
								hsl(${(idx * 36) % 360}, 80%, 60%),
								hsl(${(idx * 36 + 180) % 360}, 80%, 60%)
							)`,
							backgroundPosition: `${100 * (idx + 1)}em ${-100 * (idx + 1)}em`,
						}}
						onClick={handleClick}
					>
						<ParamHandler
							{...item}
							key={`${+keyToggle}-${item.name}-canvas-item`}
							max={item.getMax(initialValue)}
							initialValue={initialValue}
							onChange={
								handlers[
									`change${
										item.name.charAt(0).toUpperCase() + item.name.slice(1)
									}` as TParamHandleChangeName<TParamsHandlersNames>
								]
							}
						/>
					</div>
				);
			})}
		</div>
	);
});

export default memo(ParamHandlerContainer);
