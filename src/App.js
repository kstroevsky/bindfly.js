import React, { useRef } from "react";

import { Routes, Route } from "react-router-dom";
import PageLayout from "./components/PageLayout";

import "./App.css";
import DataContext from "./components/Context";

const Animation = React.lazy(() => import("./components/Animation"));

const properties = [
  {
    bgColor: 'rgba(0, 0, 0, 0.7)',
    particleColors: ['rgba(0, 0, 255, 1)', 'rgba(0, 255, 0, 1)', 'rgba(255, 0, 0, 1)'],
    generativeColorsCounts: 10,
    particleCount: 100,
    particleMaxVelocity: 1,
    lineLength: 150,
    particleLife: 20,
    margin: 20,
    isMonochrome: false,
    isCountStable: false,
    isImmortal: false,
    addByClick: false,
    switchByClick: true,
    isStatic: false,
    // randomXByClick: false,
    // randomYByClick: false,
    // isAutoGenerate: false,
    // autoGenerateTimeOut: 10,
    // autoGeneratePosition: 'random'
  },
  {
    bgColor: 'rgba(0, 0, 0, 0.7)',
    // particleColors: ['rgba(0, 0, 255, 1)', 'rgba(0, 255, 0, 1)', 'rgba(255, 0, 0, 1)'],
    generativeColorsCounts: 10,
    particleCount: 100,
    particleMaxVelocity: 1,
    lineLength: 150,
    particleLife: 20,
    margin: 20,
    isMonochrome: false,
    isCountStable: false,
    isImmortal: false,
    addByClick: true,
    switchByClick: false,
    isStatic: false,
    // randomXByClick: false,
    // randomYByClick: false,
    // isAutoGenerate: false,
    // autoGenerateTimeOut: 10,
    // autoGeneratePosition: 'random'
  },
  {
    bgColor: 'rgba(0, 0, 0, 0.7)',
    // particleColors: ['rgba(0, 0, 255, 1)', 'rgba(0, 255, 0, 1)', 'rgba(255, 0, 0, 1)'],
    generativeColorsCounts: 10,
    particleCount: 100,
    particleMaxVelocity: 1,
    lineLength: 150,
    particleLife: 20,
    margin: 20,
    isMonochrome: false,
    isCountStable: true,
    isImmortal: false,
    addByClick: true,
    switchByClick: false,
    isStatic: false,
    // randomXByClick: false,
    // randomYByClick: false,
    // isAutoGenerate: false,
    // autoGenerateTimeOut: 10,
    // autoGeneratePosition: 'random'
  },
  {
    bgColor: 'rgba(0, 0, 0, 0.7)',
    // particleColors: ['rgba(0, 0, 255, 1)', 'rgba(0, 255, 0, 1)', 'rgba(255, 0, 0, 1)'],
    generativeColorsCounts: 10,
    particleCount: 100,
    particleMaxVelocity: 1,
    lineLength: 150,
    particleLife: 20,
    margin: 20,
    isMonochrome: false,
    isCountStable: true,
    isImmortal: true,
    addByClick: true,
    switchByClick: false,
    isStatic: false,
    // randomXByClick: false,
    // randomYByClick: false,
    // isAutoGenerate: false,
    // autoGenerateTimeOut: 10,
    // autoGeneratePosition: 'random'
  },
  {
    bgColor: 'rgba(0, 0, 0, 0.7)',
    // particleColors: ['rgba(0, 0, 255, 1)', 'rgba(0, 255, 0, 1)', 'rgba(255, 0, 0, 1)'],
    generativeColorsCounts: 10,
    particleCount: 100,
    particleMaxVelocity: 1,
    lineLength: 150,
    particleLife: 20,
    margin: 20,
    isMonochrome: false,
    isCountStable: false,
    isImmortal: false,
    addByClick: false,
    switchByClick: false,
    isStatic: false,
    // randomXByClick: false,
    // randomYByClick: false,
    // isAutoGenerate: false,
    // autoGenerateTimeOut: 10,
    // autoGeneratePosition: 'random'
  },
  {
    bgColor: 'rgba(0, 0, 0, 0.7)',
    // particleColors: ['rgba(0, 0, 255, 1)', 'rgba(0, 255, 0, 1)', 'rgba(255, 0, 0, 1)'],
    generativeColorsCounts: 10,
    particleCount: 100,
    particleMaxVelocity: 1,
    lineLength: 150,
    particleLife: 20,
    margin: 20,
    isMonochrome: false,
    isCountStable: false,
    isImmortal: false,
    addByClick: true,
    switchByClick: false,
    isStatic: false,
    // randomXByClick: false,
    // randomYByClick: false,
    // isAutoGenerate: false,
    // autoGenerateTimeOut: 10,
    // autoGeneratePosition: 'random'
  },
];

const App = () => {
  return (
    <div className="App">
      <DataContext.Provider value={{ keyToggle: useRef(false), webWorker: useRef(null) }}>
        <Routes>
          <Route path="/" element={<PageLayout properties={properties} />}>
            {properties.map((x, i) => (
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
  )
}

export default App;