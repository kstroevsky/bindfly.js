import React, { MouseEvent, PointerEvent, Suspense } from 'react'
import { RouterProvider } from 'react-router-dom'
import type { FC } from 'react'

import router from './router'
import Loader from './components/Loader'

export const App: FC = () => (
	<div
		id="App"
		onContextMenu={(
			e: MouseEvent<HTMLDivElement> & PointerEvent<HTMLDivElement>
		) => {
			const { button, clientX, clientY, pointerType = 'click' } = e.nativeEvent
			const isTouchByPosition =
				(clientX !== 1 && clientX !== 0 && clientY !== 1) || clientY !== 0

			if ((button !== 2 && isTouchByPosition) || pointerType === 'touch') { e.preventDefault() }
		}}>
		<Suspense fallback={<Loader size={200} />}>
			<RouterProvider router={router} />
		</Suspense>
	</div>
)

export default App
