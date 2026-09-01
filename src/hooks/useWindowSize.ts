import { useLayoutEffect, useState } from 'react'
import useThrottle from './useThrottle'

const useWindowSize = () => {
	const [size, setSize] = useState([0, 0])

	useLayoutEffect(() => {
		// const updateSize = useThrottle(500, () => {
		//   setSize([window.innerWidth, window.innerHeight]);
		// })

		const updateSize = () => {
			setSize([window.innerWidth, window.innerHeight])
		}

		window.addEventListener('resize', updateSize)

		updateSize()

		return () => window.removeEventListener('resize', updateSize)
	}, [])

	return size
}

export default useWindowSize
