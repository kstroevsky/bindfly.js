import { useRef, useState } from "react";
import { isLayoutActive } from "../shared/utils";
import { withPrevents } from "../shared/HOF";


const initialTouch = { start: 0, end: 0 }

const useLongPress = (touchDuration) => {
  const touchStartTimer = useRef(null);
  const [touchInterval, setTouchInterval] = useState({ ...initialTouch })

  const handleTouchStart = (e) => {
    setTouchInterval({ start: Date.now(), end: 0 })

    touchStartTimer.current = setTimeout(() => {
      setTouchInterval(prev => ({ ...prev, end: prev.start + touchDuration * 1.5 }))
      clearTimeout(touchStartTimer.current)
    }, touchDuration);
  }

  const handleTouchEnd = (e) => !touchInterval.end && setTouchInterval(prev => ({ ...prev, end: prev.end || Date.now() }))

  return {
    touchInterval,
    setTouchInterval,
    handlers: {
      touchstart: withPrevents(handleTouchStart, !isLayoutActive(touchInterval.start, touchInterval.end)),
      touchend: withPrevents(handleTouchEnd, !isLayoutActive(touchInterval.start, touchInterval.end))
    }
  };
}

export default useLongPress;