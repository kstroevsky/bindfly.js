import { EventHandler, SyntheticEvent, TouchEvent, useCallback, useRef, useState } from "react";

import { isLayoutActive } from "../shared/utils";
import { withPrevents } from "../shared/HOF";
import useListenersEffect from "./useListenersEffect";
import { ILongPressInitialTouch } from "../shared/types";

export const initialTouch: ILongPressInitialTouch = { start: 0, end: 0 }

const useLongPress = <E extends Element>(
  touchDuration: number,
  pressElement: E,
  preventCondition: boolean = true
) => {
  const touchStartTimer = useRef<NodeJS.Timeout>();
  const [touchInterval, setTouchInterval] = useState<ILongPressInitialTouch>({ ...initialTouch })

  const isActive = isLayoutActive(touchInterval.start, touchInterval.end)

  const handleTouchStart = useCallback<EventHandler<TouchEvent<E>>>(() => {
    setTouchInterval({ start: Date.now(), end: 0 })

    touchStartTimer.current = setTimeout(() => {
      setTouchInterval(prev => ({ ...prev, end: prev.start + touchDuration * 1.5 }))
      clearTimeout(touchStartTimer.current)
    }, touchDuration);
  }, [])

  const handleTouchEnd = useCallback<EventHandler<TouchEvent<E>>>(() => {
    clearTimeout(touchStartTimer.current)
    !touchInterval.end && setTouchInterval(prev => ({ ...prev, end: prev.end || Date.now() }))
  }, [])

  useListenersEffect<E>(pressElement, {
    touchstart: withPrevents<E, TouchEvent<E>>(handleTouchStart, !isActive, false),
    touchend: withPrevents<E, TouchEvent<E>>(handleTouchEnd, !isActive, false)
  }, [isActive], null, preventCondition, true)

  return {
    touchInterval,
    setTouchInterval,
  };
}

export default useLongPress;