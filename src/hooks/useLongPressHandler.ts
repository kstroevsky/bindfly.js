import { useEffect, useState } from "react";

export default function useLongPress() {
  const [action, setAction] = useState<string>("");
  const [touchStart, setTouchStart] = useState<number>( 0 );
  const [touchEnd, setTouchEnd] = useState<number>(0);

  useEffect(() => {
    if (touchEnd - touchStart > 500) {
      setAction("longpress");
    }
  }, [touchStart, touchEnd]);

  function handleOnTouchStart() {
    console.log("touch");
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
