import React from 'react'
import {
	Navigate,
	Route,
	createRoutesFromElements,
	createHashRouter,
} from 'react-router-dom'
import { DataContextProvider } from '../components/Context'
import Loader from '../components/Loader'
import * as animations from '../shared/2d/animations'

import properties from '../properties.json'

import './../App.css'
import AnimationGL from '../components/AnimationGL'

const Animation = React.lazy(
	async () => await import('../components/Animation')
)
const PageLayout = React.lazy(
	async () => await import('../components/PageLayout')
)

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
								a.name.includes('GL')
									? (
											<AnimationGL properties={p} classId={a.name} />
										)
									: (
											<Animation properties={p} classId={a.name} />
										)
							}
						/>
					))
				)}
			</>
		</Route>
	)
)

export default router
