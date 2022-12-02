import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import LinkItem from "./LinkItem";

const Layout = ({ properties, action }) => {
  const [isAction, setIsAction] = useState(false);

  useEffect(() => {
    action && setIsAction(true);
  }, [action]);

  function closeWindow() {
    setIsAction(false);
  }

  return (
    <>
      <aside className={`Sidebar${isAction ? " Active" : ""}`}>
        <nav>
          <ul className="ListLink">
            {properties?.map((item, idx) => (
              <LinkItem key={idx} propertySets={item} id={idx} />
            ))}
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

export { Layout };
