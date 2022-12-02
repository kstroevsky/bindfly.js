import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import useLongPress from "../../hooks/useLongPressHandler";

import LinkItem from "../LinkItem";

const PageLayout = ({ properties }) => {
  const [isAction, setIsAction] = useState(false);
  const { action, handlers } = useLongPress();

  useEffect(() => {
    console.log(isAction);
    action && setIsAction(true);
  }, [action]);

  function closeWindow() {
    setIsAction(false);
  }

  return (
    <>
      <aside className={`Sidebar${isAction ? " Active" : ""}`} {...handlers}>
        <nav>
          <ul className="ListLink">
            {properties?.map((item, idx) => {
              return <LinkItem key={idx} propertySets={item} id={idx} />;
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
