import React from "react";
import { Navigate, Route, createBrowserRouter, createRoutesFromElements } from "react-router-dom";

import properties from "../properties.json";

import "./../App.css";

const Animation = React.lazy(async () => await import("../components/Animation"));
const PageLayout = React.lazy(async () => await import("../components/PageLayout"));

const router = createBrowserRouter(
    createRoutesFromElements(
        <Route
            path="/"
            element={<PageLayout properties={properties} />}
        >
            <>
                <Route path="/" element={<Navigate replace to={"/animation-0"} />} />
                {properties?.map((x, i) => (
                    <Route
                        key={i}
                        path={`/animation-${i}`}
                        element={<Animation properties={x} />}
                        errorElement={<></>}
                    />

                ))}
            </>
        </Route>
    )
)

export default router;