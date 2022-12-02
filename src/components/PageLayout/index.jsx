import React, { useContext, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
// import { canvasReload } from "../../utils";

// import DataContext from "../Context";
import LinkItem from "../LinkItem";

const PageLayout = ({ properties, action }) => {
  const [isAction, setIsAction] = useState(false);
  // const location = useLocation();
  // const { keyToggle, webWorker } = useContext(DataContext);

  useEffect(() => {
    action && setIsAction(true);
  }, [action]);

  function closeWindow() {
    console.log("close");
    setIsAction(false);
  }

  return (
    <>
      <aside className={`Sidebar${isAction ? " Active" : ""}`}>
        <nav>
          <ul className="ListLink">
            {properties?.map((item, idx) => {
              // const navPath = `/animation-${idx}`;
              return (
                <LinkItem key={idx} propertySets={item} id={idx} />
                // <li key={`${idx}`}>
                //   <NavLink
                //     {...(location.pathname === navPath
                //       ? {
                //           onClick: (e) => e.preventDefault(),
                //         }
                //       : {
                //           onClick: () =>
                //             canvasReload(keyToggle, webWorker.current),
                //           to: navPath,
                //         })}
                //     style={({ isActive }) =>
                //       isActive
                //         ? {
                //             color: "white",
                //             cursor: "default",
                //             textDecoration: "none",
                //           }
                //         : {}
                //     }
                //   >
                //     {`Animation-${idx}`}
                //   </NavLink>
                // </li>
              );
            })}
          </ul>
        </nav>
        <button className="CloseButton" onClick={closeWindow}>
          Close
        </button>
      </aside>
      <Outlet />
    </>
  );
};

export default PageLayout;
