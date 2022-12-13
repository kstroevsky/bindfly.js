import React, { useEffect, useRef, useState, Suspense, SyntheticEvent, MouseEvent } from "react";
import { createPortal } from "react-dom";
import { Outlet } from "react-router-dom";

import root from "../..";
import useMediaQuery from "../../hooks/useMediaQuery";
import { TProperties, IOutletContext } from "../../shared/types";
import Loader from "../Loader";
import { PageSidebar } from "../PageSidebar";

interface IPageLayoutProps {
  properties: TProperties
}

const PageLayout: React.FC<IPageLayoutProps> = ({ properties }) => {
  const sidebarRef = useRef<HTMLElement | null>(null)
  const portalRef = useRef<HTMLElement | null>(null)
  const [width, setWidth] = useState<IOutletContext['width']>(0)

  const isMobile: IOutletContext['isMobile'] = useMediaQuery('(max-width: 768px),(orientation: portrait)')

  const isVisible: boolean = isMobile ? true : !!width

  useEffect(() => {
    if (sidebarRef.current && !isMobile) setWidth(+sidebarRef.current.getBoundingClientRect().width || 0)
  }, [sidebarRef, isMobile])

  useEffect(() => {
    if (isMobile && !portalRef.current) createPortal(
      <PageSidebar
        ref={portalRef}
        key={"mobile-sidebar"}
        isModal={true}
        properties={properties}
      />, root as Element
    )
  }, [])

  return (
    <>
      <PageSidebar
        ref={sidebarRef}
        key={"desktop-sidebar"}
        properties={properties}
        isModal={isMobile}
      />
      <Suspense fallback={<Loader size={200} />}>
        {isVisible && <Outlet context={{ width, isMobile }} />}
      </Suspense>
    </>
  );
};

export default PageLayout;