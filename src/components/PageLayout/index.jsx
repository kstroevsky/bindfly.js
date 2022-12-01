import React, { useContext } from 'react';
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { canvasReload } from '../../utils';

import DataContext from '../Context';

const PageLayout = ({ properties }) => {
  const location = useLocation()
  const { keyToggle, webWorker } = useContext(DataContext)

  return (
    <>
      <aside className="Sidebar">
        <nav>
          <ul className="ListLink">
            {properties?.map((_, idx) => {
              const navPath = `/animation-${idx}`;
              return (
                <li key={`${idx}`}>
                  <NavLink
                    {...(location.pathname === navPath
                      ? {
                        onClick: e => e.preventDefault(),
                      } : {
                        onClick: () => canvasReload(keyToggle, webWorker.current),
                        to: navPath,
                      }
                    )}
                    style={({ isActive }) => isActive ? {
                      color: 'white',
                      cursor: 'default',
                      textDecoration: 'none'
                    } : {}}
                  >
                    {`Animation-${idx}`}
                  </NavLink>
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

export default PageLayout