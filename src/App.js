import React, { useState } from "react";
import "./App.css";
import { Routes } from "react-router-dom";
import { Route } from "react-router-dom";
import { Layout } from "./components/layout";
import properties from "./properties.json";

const Animation = React.lazy(() => import("./components/Animation"));

const initialState = properties;

function App() {
  const [properties, setProperties] = useState(initialState);

  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<Layout properties={properties} />}>
          {properties.map((x, i) => (
            <Route
              key={i}
              path={`/animation-${i}`}
              element={<Animation properties={x} />}
              // action={async () => workerRef.current.terminate()}
            />
          ))}
        </Route>
      </Routes>
    </div>
  );
}

export default App;

// const properties = {
//   bgColor: "rgba(255, 255, 255, 0.7)",
//   // particleColors: ['rgba(0, 0, 255, 1)', 'rgba(0, 255, 0, 1)', 'rgba(255, 0, 0, 1)'],
//   generativeColorsCounts: 10,
//   particleCount: 100,
//   particleMaxVelocity: 1,
//   lineLength: 150,
//   particleLife: 20,
//   margin: 20,
//   isMonochrome: false,
//   isCountStable: false,
//   isImmortal: false,
//   addByClick: true,
//   switchByClick: false,
//   isStatic: false,
//   // randomXByClick: false,
//   // randomYByClick: false,
//   // isAutoGenerate: false,
//   // autoGenerateTimeOut: 10,
//   // autoGeneratePosition: 'random'
// };
