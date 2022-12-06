import React, { useEffect, useRef, useState, Suspense } from "react";
import { createPortal } from "react-dom";
import { Outlet } from "react-router-dom";
import { TProperties, IProperty } from "../../utils/types";

import useMediaQuery from "../../hooks/useMediaQuery";
import { PageSidebar } from "../PageSidebar";
import { root } from "../..";

interface IPageLayoutProps {
  properties: TProperties
}



const PageLayout: React.FC<IPageLayoutProps> = ({ properties }) => {
  const sidebarRef = useRef(null)
  const portalRef = useRef(null)
  const [width, setWidth] = useState(0)


  const isMobile = useMediaQuery('(max-width: 768px),(orientation: portrait)')

  const isVisible = isMobile ? true : !!width

  useEffect(() => {
    if (!isMobile) setWidth(+sidebarRef.current?.getBoundingClientRect().width || 0)
    else window.oncontextmenu = (e: MouseEvent) => ((e.button !== 2 && !(e.clientX === e.clientY === 1 || 0)) || e.pointerType === 'touch')
      && e.preventDefault()
  }, [sidebarRef, isMobile])

  useEffect(() => {
    if (isMobile && !portalRef.current) createPortal(
      <PageSidebar
        ref={portalRef}
        key={"mobile-sidebar"}
        isModal={true}
        properties={properties}
      />, root
    )
  }, [])

  return (
    // <>
    //   <aside className={`Sidebar${isAction ? " Active" : ""}`} {...handlers}>
    //     <nav>
    //       <ul className="ListLink">
    //         {properties?.map((item: IProperty, idx: number) => {
    //           return <LinkItem key={idx} propertySets={item} id={idx} />;
    //         })}
    //       </ul>
    //     </nav>
    //     <button className="CloseButton" onClick={closeWindow}>
    //       Close
    //     </button>
    //   </aside>
    //   <Outlet />
    // </>
    <Suspense>
      <PageSidebar
        ref={sidebarRef}
        key={"desktop-sidebar"}
        properties={properties}
        isModal={isMobile}
      />
      {isVisible && <Outlet context={{ width, isMobile }} />}
    </Suspense>
  );
};

export default PageLayout;