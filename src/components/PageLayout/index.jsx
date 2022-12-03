import React, { useContext, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Outlet } from "react-router-dom";

import useLongPress from "../../hooks/useLongPress";
import { isLayoutActive } from "../../shared/utils";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { PageSidebar } from "../PageSidebar";
import { DataContext } from "../Context";

const PageLayout = ({ properties }) => {
  const root = useRef(document.getElementById('root'))
  const isMobile = useMediaQuery('(max-width: 768px),(orientation: portrait)')
  const { touchInterval, setTouchInterval, handlers } = useLongPress(500);
  const sidebarRef = useRef(null)

  const handleClose = () => {
    setTouchInterval({ start: 0, end: 0 })
  }

  useEffect(() => {
    if (isMobile) {
      Object.keys(handlers).forEach(handler => root.current?.addEventListener(handler, handlers[handler]))
      return () => Object.keys(handlers).forEach(handler => root.current?.removeEventListener(handler, handlers[handler]))
    }
  }, [isMobile, handlers])

  return (
    <>
      {isMobile
        ? createPortal(
          <PageSidebar
            isModal={isMobile}
            properties={properties}
            isActive={isLayoutActive(touchInterval.start, touchInterval.end)}
            onClose={handleClose}
          />,
          root.current
        ) : (
          <PageSidebar
            ref={sidebarRef}
            properties={properties}
          />
        )}
      <Outlet />
    </>
  );
};

export default PageLayout;
