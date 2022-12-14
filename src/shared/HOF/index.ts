import { EventHandler, ReactEventHandler, SyntheticEvent, UIEvent } from 'react';

export const withPrevents = <E extends Element, V extends UIEvent<E>>(
  func: EventHandler<V>,
  callCondition = true,
  preventCondition = true
) => {
  return (e: V) => {
    preventCondition && e?.preventDefault();
    callCondition && func(e);
  };
};
