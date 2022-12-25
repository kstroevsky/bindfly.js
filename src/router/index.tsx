import React from 'react'
import {
	Navigate,
	Route,
	createRoutesFromElements,
	createHashRouter
} from 'react-router-dom'
import { DataContextProvider } from '../components/Context'
import Loader from '../components/Loader'
import * as animations from '../shared/2d/animations'

import properties from '../properties.json'

import './../App.css'

const Animation = React.lazy(async () => await import('../components/Animation'))
const PageLayout = React.lazy(async () => await import('../components/PageLayout'))

const router = createHashRouter(
	createRoutesFromElements(
		<Route
			path="/"
			element={
				<DataContextProvider>
					<PageLayout properties={properties} />
				</DataContextProvider>
			}>
			<>
				<Route
					path="/"
					element={<Navigate replace to={`/${Object.values(animations)[0].name}-Simple`} />}
					errorElement={<Loader size={200} />}
				/>
				{Object.values(animations).map((y) => properties?.map((x, i) => (
					<Route
						key={i}
						path={`/${y.name}-${x.name}`}
						element={<Animation properties={x} classId={y.name} />}
					/>
				)))}
			</>
		</Route>
	)
)

export default router
