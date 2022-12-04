import { useEffect, useState } from "react"
import { getMediaMatches } from "../shared/utils"
import useListenersEffect from "./useListenersEffect"

const useMediaQuery = (query) => {
    const [matches, setMatches] = useState(getMediaMatches(query))

    function handleChange() {
        setMatches(getMediaMatches(query))
    }

    const withListenersEffects = (domNode, eventHandlerConfig, legacy = false) => () => {
        if (legacy && domNode?.addListener) Object.values(eventHandlerConfig).forEach(handler => domNode.addListener(handler))
        else Object.keys(eventHandlerConfig).forEach(eventName => domNode?.addEventListener(eventName, eventHandlerConfig[eventName]))

        return () => {
            if (legacy && domNode?.removeListener) Object.values(eventHandlerConfig).forEach(handler => domNode.removeListener(handler))
            else Object.keys(eventHandlerConfig).forEach(eventName => domNode?.removeEventListener(eventName, eventHandlerConfig[eventName]))
        }
    }

    useEffect(() => {
        handleChange()
        return withListenersEffects(window.matchMedia(query), { change: handleChange }, true)
    }, [query])

    // useListenersEffect(window.matchMedia(query), { change: handleChange }, [query], true, handleChange)

    return matches
}

export default useMediaQuery;