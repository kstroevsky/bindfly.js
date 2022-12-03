import React from "react";
import { Navigate, Routes } from "react-router-dom";
import { Route } from "react-router-dom";
import properties from "./properties.json";
import PageLayout from "./components/PageLayout";
import { DataContextProvider } from "./components/Context";

import "./App.css";

const Animation = React.lazy(async () => await import("./components/Animation"));

function App() {
  return (
    <div id="App">
      <DataContextProvider>
        <Routes>
          <Route
            path="/"
            element={<PageLayout properties={properties} />}
          >
            <Route path="/" element={<Navigate replace to={"/animation-0"} />} />
            {properties?.map((x, i) => (
              <Route
                key={i}
                path={`/animation-${i}`}
                element={<Animation properties={x} />}
              />
            ))}
          </Route>
        </Routes>
      </DataContextProvider>
    </div>
  );
}

export default App;
