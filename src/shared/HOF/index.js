export const withPrevents = (func, ...conditions) => {
    return conditions.every(x => x) ? (e) => {
        e?.preventDefault()
        func(e)
    } : () => { }
}