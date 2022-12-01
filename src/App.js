import React, { useEffect, useState } from "react";
import "./App.css";
import { Routes } from "react-router-dom";
import { Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import properties from "./properties.json";
import useLongPress from "./hooks/useLongPressHandler";

const Animation = React.lazy(() => import("./components/Animation"));

function App() {
  const [data, setData] = useState([]);
  const { action, handlers } = useLongPress();

  useEffect(() => {
    setData(properties);
  }, [setData]);

  return (
    <div className="App" {...handlers}>
      <Routes>
        <Route
          path="/"
          element={
            <Layout
              properties={data}
              action={action === "longpress" && action}
            />
          }
        >
          {data?.map((x, i) => (
            <Route
              key={i}
              path={`/animation-${i}`}
              element={<Animation properties={x} />}
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
