import { useEffect } from "react"

const useListenersEffect = (
    domNode,
    eventHandlerConfig,
    deps = undefined,
    legacy = false,
    additionalCalls = null,
    condition = true,
    isInverse = false,
    inverseCondition = deps.every(x => x)
) => {
    useEffect(() => {
        additionalCalls && additionalCalls()

        if (condition) {
            const isLegacy = legacy && domNode?.addListener
            const isInverseFalse = isInverse && !inverseCondition

            const addListenerFunc = (isLegacy ? domNode.addListener : domNode?.addEventListener).bind(domNode)
            const removeListenerFunc = (isLegacy ? domNode.removeListener : domNode?.removeEventListener).bind(domNode)

            Object.keys(eventHandlerConfig).forEach(eventName =>
                (isInverseFalse || !isInverse
                    ? addListenerFunc
                    : removeListenerFunc)?.(...(isLegacy
                        ? []
                        : [eventName]
                    ), eventHandlerConfig[eventName])
            )

            return () => Object.keys(eventHandlerConfig).forEach(
                eventName => removeListenerFunc?.(...(isLegacy ? [] : [eventName]), eventHandlerConfig[eventName])
            )
        }
    }, deps)
}

export default useListenersEffect;