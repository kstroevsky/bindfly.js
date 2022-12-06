import { createContext } from "react";
import { IDataContext } from "../../utils/types";




const DataContext = createContext < IDataContext | null>(null);

export default DataContext;