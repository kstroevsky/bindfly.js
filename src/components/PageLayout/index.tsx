import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import useLongPress from "../../hooks/useLongPressHandler";
import { TProperties, IProperty } from "../../utils/types";

import LinkItem from "../LinkItem";

interface IPageLayoutProps {
  properties: TProperties
}



const PageLayout: React.FC<IPageLayoutProps> = ({ properties }) => {
  const [isAction, setIsAction] = useState<boolean>(false);
  const { action, handlers } = useLongPress();

  useEffect(() => {
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
            {properties?.map((item: IProperty, idx: number) => {
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
