import React from "react";
import "./App.css";
import { Routes } from "react-router-dom";
import { Route } from "react-router-dom";
import { Layout } from "./components/layout";

const Animation = React.lazy(() => import("./components/Animation"));

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Animation keyProperties={"Default"} />} />
          <Route path="Set1" element={<Animation keyProperties={"Set1"} />} />
          <Route path="Set2" element={<Animation keyProperties={"Set2"} />} />
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
