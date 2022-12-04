import React, { useEffect, useRef, useState, Suspense } from "react";
import { createPortal } from "react-dom";
import { Outlet } from "react-router-dom";

import useMediaQuery from "../../hooks/useMediaQuery";
import useLongPress from "../../hooks/useLongPress";
import { isLayoutActive } from "../../shared/utils";
import { PageSidebar } from "../PageSidebar";
import { root } from "../..";
import { DataContextProvider } from "../Context";

const PageLayout = ({ properties }) => {
  const sidebarRef = useRef(null)
  const [width, setWidth] = useState(0)

  const isMobile = useMediaQuery('(max-width: 768px),(orientation: portrait)')
  const { touchInterval, setTouchInterval, handlers } = useLongPress(500);

  const isVisible = isMobile ? true : !!width

  const handleClose = () => {
    setTouchInterval({ start: 0, end: 0 })
  }

  useEffect(() => {
    isMobile || setWidth(+sidebarRef.current?.getBoundingClientRect().width || 0)
  }, [sidebarRef, isMobile])

  useEffect(() => {
    if (isMobile) {
      Object.keys(handlers).forEach(handler => root.addEventListener(handler, handlers[handler]))
      return () => Object.keys(handlers).forEach(handler => root.removeEventListener(handler, handlers[handler]))
    }
  }, [isMobile, handlers])

  return (
    <DataContextProvider>
      {/* <Suspense> */}
      {isMobile
        ? createPortal(
          <PageSidebar
            isModal={true}
            properties={properties}
            isActive={isLayoutActive(touchInterval.start, touchInterval.end)}
            onClose={handleClose}
          />, root
        ) : (
          <PageSidebar
            ref={sidebarRef}
            properties={properties}
          />
        )}
      {isVisible && <Outlet context={{ width }} />}
      {/* </Suspense> */}
    </DataContextProvider>

  );
};

export default PageLayout;