import React, { useEffect, useRef, useState, Suspense } from "react";
import { createPortal } from "react-dom";
import { Outlet } from "react-router-dom";

import useMediaQuery from "../../hooks/useMediaQuery";
import { PageSidebar } from "../PageSidebar";
import { root } from "../..";
import { DataContextProvider } from "../Context";

const PageLayout = ({ properties }) => {
  const sidebarRef = useRef(null)
  const [width, setWidth] = useState(0)

  const isMobile = useMediaQuery('(max-width: 768px),(orientation: portrait)')

  const isVisible = isMobile ? true : !!width

  useEffect(() => {
    if (!isMobile) setWidth(+sidebarRef.current?.getBoundingClientRect().width || 0)
    else window.oncontextmenu = e => ((e.button !== 2 && !(e.clientX === e.clientY === 1 || 0)) || e.pointerType === 'touch')
      && e.preventDefault();
  }, [sidebarRef, isMobile])

  return (
    <DataContextProvider>
      <Suspense>
        {isMobile
          ? createPortal(
            <PageSidebar
              isModal={true}
              properties={properties}
            />, root
          ) : (
            <PageSidebar
              ref={sidebarRef}
              properties={properties}
            />
          )}
        {isVisible && <Outlet context={{ width }} />}
      </Suspense>
    </DataContextProvider>

  );
};

export default PageLayout;