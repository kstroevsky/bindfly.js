import React, { useContext } from 'react';
import { Link, Outlet } from "react-router-dom";
import { canvasReload } from '../../utils';

import DataContext from '../Context';

const PageLayout = ({ properties }) => {
  const { keyToggle, webWorker } = useContext(DataContext)

  return (
    <>
      <aside className="Sidebar">
        <nav>
          <ul className="ListLink">
            {properties?.map((item, idx) => {
              return (
                <li key={`${idx}`}>
                  <Link
                    onClick={() => canvasReload(keyToggle, webWorker.current)}
                    to={`/animation-${idx}`}
                  >
                    {`Animation-${idx}`}
                  </Link>
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