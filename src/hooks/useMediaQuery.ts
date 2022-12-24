import { useState } from 'react'
import { getMediaMatches } from '../shared/utils'
import useListenersEffect from './useListenersEffect'

const useMediaQuery = (query: string) => {
	const [matches, setMatches] = useState<boolean>(getMediaMatches(query))

	const handleChange = () => {
		setMatches(getMediaMatches(query))
	}

	useListenersEffect<MediaQueryList>(
		window.matchMedia(query),
		{ change: handleChange },
		[query],
		handleChange,
		true,
		true
	)

	return matches
}

export default useMediaQuery
