export const withPrevents = (func, ...conditions) => {
    return conditions.every(x => x) ? (e) => {
        e?.preventDefault()
        func(e)
    } : () => { }
}

export const withListenersEffects = (domNode, eventHandlerConfig, legacy = false) => () => {
    if (legacy && domNode?.addListener) Object.values(eventHandlerConfig).forEach(handler => domNode.addListener(handler))
    else Object.keys(eventHandlerConfig).forEach(eventName => domNode?.addEventListener(eventName, eventHandlerConfig[eventName]))

    return () => {
        if (legacy && domNode?.removeListener) Object.values(eventHandlerConfig).forEach(handler => domNode.removeListener(handler))
        else Object.keys(eventHandlerConfig).forEach(eventName => domNode?.removeEventListener(eventName, eventHandlerConfig[eventName]))
    }
}