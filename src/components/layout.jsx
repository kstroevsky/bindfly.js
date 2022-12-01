import React, { useEffect } from 'react';
import { Link, Outlet } from "react-router-dom";

const Layout = ({ properties }) => {
  return (
    <>
      <aside className="Sidebar">
        <nav>
          <ul className="ListLink">
            {properties?.map((item, idx) => {
              return (
                <li key={`${idx}`}>
                  <Link to={`/animation-${idx}`}>{`Animation-${idx}`}</Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      <Outlet />
    </>
  );
};

export { Layout };
