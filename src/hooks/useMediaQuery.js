import { useEffect, useState } from "react"
import { getMediaMatches } from "../shared/utils"
import { withListenersEffects } from "../shared/HOF"

export const useMediaQuery = (query) => {
    const [matches, setMatches] = useState(getMediaMatches(query))

    function handleChange() {
        setMatches(getMediaMatches(query))
    }

    useEffect(() => {
        handleChange()

        return withListenersEffects(window.matchMedia(query), { change: handleChange }, true)
    }, [query])

    return matches
}