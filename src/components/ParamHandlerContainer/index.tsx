import React, { lazy, memo, useState, useCallback } from 'react';
import classnames from 'classnames';
import { useSearchParams } from 'react-router-dom';
import type { FC } from 'react';

import { CanvasHandlersConfig } from '../../router';
import { trivialOne } from '../../shared/utils/helpers';
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
	offsetWidth: number;
}

const ParamHandlerContainer: FC<IParamHandlerContainerProps> = ({
	properties,
	handlers,
	classId,
	offsetWidth,
}) => {
	const [currentRangeIdx, setCurrentRangeIdx] = useState<number>(0);
	const [searchParams, setSearchParams] = useSearchParams();

	const handleClick = useCallback(
		(e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
			setCurrentRangeIdx(Number(e.currentTarget.dataset.item));
		},
		[]
	);

	const updateSearch = useCallback((params: { [key: string]: string }) => {
		Object.entries(params).forEach(([key, value]) => {
			searchParams.set(key, value);
		});
		setSearchParams(searchParams);
	}, [searchParams]);

	return (
		<div
			className={'animation-handlers'}
			style={{ width: `calc(100vw - ${offsetWidth}px)` }}
		>
			{CanvasHandlersConfig.filter(
				(item) =>
					item.visibility.includes(classId) &&
					(!item.visibilityChecking || item.visibilityChecking(properties))
			).map((item, idx) => {
				const encode = item.valueEncoder || trivialOne;
				const initialValue: number = encode(properties[item.name] || 0);

				return (
					<div
						key={`${properties.name}-${item.name}-canvas`}
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
							max={item.getMax(initialValue)}
							initialValue={initialValue}
							updateSearch={updateSearch}
							searchParams={searchParams}
							onChange={
								handlers[
								`change${item.name.charAt(0).toUpperCase() + item.name.slice(1)
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
