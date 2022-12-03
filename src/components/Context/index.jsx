import React, { useRef } from 'react'
import { createContext } from "react";

export const DataContext = createContext();

export const DataContextProvider = ({ children, ...args }) => {
    const keyToggle = useRef(false)
    const webWorker = useRef(null)

    return (
        <DataContext.Provider value={{ keyToggle, webWorker }} >
                {children}
        </DataContext.Provider>
    )
}