import { useState } from 'react'

const useForceUpdate = (): (() => void) => {
	const set = useState<boolean>(false)[1]
	return () => set((s) => !s)
}

export default useForceUpdate
