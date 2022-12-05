import { useState } from "react"
import { getMediaMatches } from "../shared/utils"
import useListenersEffect from "./useListenersEffect"

const useMediaQuery = (query) => {
    const [matches, setMatches] = useState(getMediaMatches(query))

    const handleChange = () => {
        setMatches(getMediaMatches(query))
    }

    useListenersEffect(window.matchMedia(query), { change: handleChange }, [query], true, handleChange)

    return matches
}

export default useMediaQuery;