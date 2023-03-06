import React from 'react';
import {
	Navigate,
	Route,
	createRoutesFromElements,
	createHashRouter,
} from 'react-router-dom';

import * as animations from '../shared/2d/animations';
import Loader from '../components/Loader';
import { DataContextProvider } from '../components/Context';
import { getAlpha } from '../shared/utils/color-helpers';
import type {
	IAnimationHandlerConfig,
	IProperty,
	TClassesNames,
} from '../shared/types';

import properties from '../properties.json';
import './../App.css';

const Animation = React.lazy(
	async () => await import('../components/Animation')
);
const AnimationGL = React.lazy(
	async () => await import('../components/AnimationGL')
);
const PageLayout = React.lazy(
	async () => await import('../components/PageLayout')
);

export type CanvasAnimationsNames = TClassesNames<typeof animations>;

export const CanvasHandlersConfig: IAnimationHandlerConfig<CanvasAnimationsNames>[] =
	[
		{
			name: 'particlesCount',
			visibility: [
				animations.FlyingLines.name,
				animations.DroopingLines.name,
				animations.SpiralFlyingLines.name,
				animations.Pulse.name,
				animations.Spiral.name,
				animations.Spiral2.name,
				animations.Spiral3.name,
				animations.FlyingLinesGL.name,
			] as CanvasAnimationsNames[],
			step: 1,
			min: 0,
			getMax: (initialValue: number) =>
				initialValue < 20 ? 300 : initialValue * 5,
		},
		{
			name: 'weight',
			visibility: [
				animations.Pulse.name,
			] as CanvasAnimationsNames[],
			step: 0.1,
			min: 0,
			getMax: () => 100,
		},
		{
			name: 'lineLength',
			visibility: [
				animations.FlyingLines.name,
				animations.DroopingLines.name,
				animations.Pulse.name,
				animations.Spiral.name,
				animations.Spiral2.name,
				animations.Spiral3.name,
				animations.FlyingLinesGL.name,
			] as CanvasAnimationsNames[],
			step: 1,
			min: 0,
			getMax: (initialValue: number) => initialValue * 4,
		},
		{
			name: 'particleMaxVelocity',
			visibility: [
				animations.FlyingLines.name,
				animations.DroopingLines.name,
				animations.FlyingLinesGL.name,
			] as CanvasAnimationsNames[],
			step: 0.1,
			min: -20,
			getMax: () => 20,
		},
		{
			name: 'radius',
			visibility: [
				animations.SpiralFlyingLines.name,
			] as CanvasAnimationsNames[],
			visibilityChecking: (properties: IProperty) =>
				!!(properties.radius && !properties.isPulsative),
			step: 0.5,
			min: 0,
			getMax: (initialValue: number) => initialValue * 3,
		},
		{
			name: 'bgColor',
			visibility: [
				animations.FlyingLines.name,
				animations.DroopingLines.name,
				animations.SpiralFlyingLines.name,
				animations.Pulse.name,
				animations.Spiral.name,
				animations.Spiral2.name,
				animations.Spiral3.name,
			] as CanvasAnimationsNames[],
			step: 0.01,
			min: 0,
			getMax: () => 1,
			valueEncoder: getAlpha,
		} as IAnimationHandlerConfig<CanvasAnimationsNames, string>,
	];

const router = createHashRouter(
	createRoutesFromElements(
		<Route
			path="/"
			element={
				<DataContextProvider>
					<PageLayout properties={properties} />
				</DataContextProvider>
			}
		>
			<>
				<Route
					path="/"
					errorElement={<Loader size={200} />}
					element={
						<Navigate
							replace
							to={`/${Object.values(animations)[0].name}-Simple`}
						/>
					}
				/>
				{Object.values(animations).map((a) =>
					properties?.map((p, idx) => (
						<Route
							key={`${a.name}-${idx}`}
							path={`/${a.name}-${p.name.replaceAll(' ', '')}`}
							element={
								a.name.includes('GL') ? (
									<AnimationGL properties={p} classId={a.name as CanvasAnimationsNames} />
								) : (
									<Animation properties={p} classId={a.name as CanvasAnimationsNames} />
								)
							}
						/>
					))
				)}
			</>
		</Route>
	)
);

export default router;
