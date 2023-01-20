import React, { createContext, useRef } from 'react'
import type { FC, MutableRefObject, ReactNode } from 'react'

export interface IDataContext {
	keyToggle: MutableRefObject<boolean>;
	webWorker: MutableRefObject<Worker | null>;
}

const DataContext = createContext<IDataContext>({} as IDataContext)

export interface IDataContextProviderProps {
	children?: ReactNode | ReactNode[];
}

export const DataContextProvider: FC<IDataContextProviderProps> = ({ children }) => {
	const keyToggle = useRef<boolean>(false)
	const webWorker = useRef<Worker | null>(null)

	return (
		<DataContext.Provider value={{ keyToggle, webWorker }}>
			{children}
		</DataContext.Provider>
	)
}

export default DataContext
