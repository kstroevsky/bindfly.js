import { useEffect, useState } from "react";

export default function useLongPress() {
  const [action, setAction] = useState();
  const [touchStart, setTouchStart] = useState();
  const [touchEnd, setTouchEnd] = useState();

  useEffect(() => {
    if (touchEnd - touchStart > 500) {
      setAction("longpress");
    }
  }, [touchStart, touchEnd]);

  function handleOnTouchStart() {
    setAction("");
    setTouchStart(Date.now());
  }

  function handleOnTouchEnd() {
    setTouchEnd(Date.now());
  }

  return {
    action,
    handlers: {
      onTouchStart: handleOnTouchStart,
      onTouchEnd: handleOnTouchEnd,
    },
  };
}
