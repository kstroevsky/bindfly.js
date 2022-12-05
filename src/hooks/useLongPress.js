import { useCallback, useRef, useState } from "react";

import { isLayoutActive } from "../shared/utils";
import { withPrevents } from "../shared/HOF";
import useListenersEffect from "./useListenersEffect";

const initialTouch = { start: 0, end: 0 }

const useLongPress = (touchDuration, pressElement, preventCondition = true) => {
  const touchStartTimer = useRef(null);
  const [touchInterval, setTouchInterval] = useState({ ...initialTouch })

  const isActive = isLayoutActive(touchInterval.start, touchInterval.end)

  const handleTouchStart = useCallback(e => {
    setTouchInterval({ start: Date.now(), end: 0 })

    touchStartTimer.current = setTimeout(() => {
      console.log(e)
      setTouchInterval(prev => ({ ...prev, end: prev.start + touchDuration * 1.5 }))
      clearTimeout(touchStartTimer.current)
    }, touchDuration);
  }, [])

  const handleTouchEnd = useCallback(e => {
    console.log(e)
    clearTimeout(touchStartTimer.current)
    !touchInterval.end && setTouchInterval(prev => ({ ...prev, end: prev.end || Date.now() }))
  }, [])

  useListenersEffect(pressElement, {
    touchstart: withPrevents(handleTouchStart, !isActive, false),
    touchend: withPrevents(handleTouchEnd, !isActive, false)
  }, [isActive], false, null, preventCondition, true, isActive)

  return {
    touchInterval,
    setTouchInterval,
  };
}

export default useLongPress;