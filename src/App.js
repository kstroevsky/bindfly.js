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
