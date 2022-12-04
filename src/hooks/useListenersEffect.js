import { useEffect } from "react"

const useListenersEffect = (
    domNode,
    eventHandlerConfig,
    deps = undefined,
    legacy = false,
    additionalCalls = null,
    condition = true
) => {
    useEffect(() => {
        additionalCalls()

        if (condition) {
            if (legacy && domNode?.addListener) Object.values(eventHandlerConfig).forEach(handler => domNode.addListener(handler))
            else Object.keys(eventHandlerConfig).forEach(eventName => domNode?.addEventListener(eventName, eventHandlerConfig[eventName]))

            return () => {
                if (legacy && domNode?.removeListener) Object.values(eventHandlerConfig).forEach(handler => domNode.removeListener(handler))
                else Object.keys(eventHandlerConfig).forEach(eventName => domNode?.removeEventListener(eventName, eventHandlerConfig[eventName]))
            }
        }
    }, deps)
}

export default useListenersEffect;