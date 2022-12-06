// import React, { useRef } from "react";
// import { Routes } from "react-router-dom";
// import { Route } from "react-router-dom";
// import DataContext from "./components/Context";
// import "./App.css";
// import properties from "./properties.json";
// import PageLayout from "./components/PageLayout";
// import { TProperties } from "./utils/types";

// const Animation = React.lazy(() => import("./components/Animation"));

// const App: React.FC = () => {
//   const data: TProperties = properties;

//   return (
//     <div className="App">
//       <DataContext.Provider
//         value={{ keyToggle: useRef(false), webWorker: useRef(null) }}
//       >
//         <Routes>
//           <Route path="/" element={<PageLayout properties={data} />}>
//             {data?.map((x, i) => (
//               <Route
//                 key={0}
//                 path={`/animation-${i}`}
//                 element={<Animation properties={x} />}
//               />
//             ))}
//           </Route>
//         </Routes>
//       </DataContext.Provider>
import { RouterProvider } from "react-router-dom";
import router from "./router";

function App() {
  return (
    <div id="App">
      <RouterProvider router={router} />
    </div>
  );
}

export default App;
