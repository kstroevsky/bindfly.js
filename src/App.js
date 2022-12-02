import React, { useEffect, useRef, useState } from "react";
import { Routes } from "react-router-dom";
import { Route } from "react-router-dom";
import DataContext from "./components/Context";
import "./App.css";
import properties from "./properties.json";
import PageLayout from "./components/PageLayout";

const Animation = React.lazy(() => import("./components/Animation"));

function App() {
  const [data, setData] = useState([]);

  useEffect(() => {
    setData(properties);
  }, [setData]);

  return (
    <div className="App">
      <DataContext.Provider
        value={{ keyToggle: useRef(false), webWorker: useRef(null) }}
      >
        <Routes>
          {/* <Route path="/" element={<PageLayout properties={properties} />}> */}
          <Route path="/" element={<PageLayout properties={data} />}>
            {data?.map((x, i) => (
              <Route
                key={0}
                path={`/animation-${i}`}
                element={<Animation properties={x} />}
              />
            ))}
          </Route>
        </Routes>
      </DataContext.Provider>
    </div>
  );
}

export default App;
