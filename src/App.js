import React, { useState } from "react";
import "./App.css";
import { Routes, Route, Switch } from "react-router-dom";
import { Layout } from "./components/layout";

const Animation = React.lazy(() => import("./components/Animation"));

const initialState = [{
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

function useForceUpdate() {
  const [value, setValue] = useState(0); // integer state
  console.log('1')
  return () => setValue(value => value + 1); // update state to force render
  // An function that increment 👆🏻 the previous state like here 
  // is better than directly setting `value + 1`
}

function App() {
  const [properties, setProperties] = useState(initialState);

  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<Layout properties={properties} />}>
          {properties.map((x, i) => (
            <Route
              key={0}
              path={`/animation-${i}`}
              element={<Animation properties={x} />}
            // action={async () => forceUpdate()}
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
