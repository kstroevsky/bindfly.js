export const withPrevents = (func, callCondition = true, preventCondition = true) => {
    return e => {
        preventCondition && e?.preventDefault()
        callCondition && func(e)
    }
}