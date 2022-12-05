export const withPrevents = (func, callCondition = true, preventCondition = true) => {
    return e => {
        if (callCondition) {
            preventCondition && e?.preventDefault()
            func(e)
        }
    }
}