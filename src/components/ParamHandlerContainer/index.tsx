import React, { lazy, memo, useState, useCallback } from 'react';
import type { FC } from 'react';

import { CanvasHandlersConfig } from '../../router';
import type { CanvasAnimationsNames } from '../../router';
import type {
	IProperty,
	TParamHandleChangeName,
	TParamsHandlers,
	TParamsHandlersNames,
} from '../../shared/types';

import './styles.css';
import classnames from 'classnames';

const ParamHandler = lazy(() => import('../ParamHandler'));

export interface IParamHandlerContainerProps {
	properties: IProperty;
	handlers: TParamsHandlers;
	classId: CanvasAnimationsNames;
	keyToggle: boolean;
}

const ParamHandlerContainer: FC<IParamHandlerContainerProps> = ({
	properties,
	handlers,
	classId,
	keyToggle,
}) => {
	const [currentRangeIdx, setCurrentRangeIdx] = useState<number>(0);

	const handleClick = useCallback(
		(e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
			setCurrentRangeIdx(Number(e.currentTarget.dataset.item));
		},
		[]
	);

	return (
		<div key={`${+keyToggle}-ranges`} className={'animation-handlers'}>
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
						onClick={handleClick}
					>
						<ParamHandler
							{...item}
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
};

export default memo(ParamHandlerContainer);
