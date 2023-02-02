import React, { lazy, memo } from 'react';
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
	return (
		<div key={`${+keyToggle}-ranges`} className={'animation-handlers'}>
			{CanvasHandlersConfig.map((item) => {
				if (
					!item.visibility.includes(classId) ||
					!(!item.visibilityChecking || item.visibilityChecking(properties))
				) {
					return <></>;
				}

				const initialValue = properties[item.name] || 0;

				return (
					<ParamHandler
						{...item}
						key={`${+keyToggle}-${item.name}-canvas`}
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
				);
			})}
		</div>
	);
};

export default memo(ParamHandlerContainer);
