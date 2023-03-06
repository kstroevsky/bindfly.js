import React, { memo, useCallback, useEffect, useState } from 'react'
import type { FC } from 'react'

import { useThrottle } from '../../hooks'
import { PARAMS_HANDLER_DEBOUNCE_DELAY } from '../../shared/constants'
import type { TCallable } from '../../shared/types'

import './styles.css'

export interface IParamHandlerProps {
  name: string;
  step: number;
  min: number;
  max: number;
  initialValue: number;
  onChange: TCallable<void, number>;
  updateSearch: (params: { [key: string]: string }) => void;
  searchParams: URLSearchParams
}

const ParamHandler: FC<IParamHandlerProps> = ({
  name,
  step = 0,
  min = 1,
  max,
  initialValue,
  onChange,
  updateSearch,
  searchParams,
}) => {
  const [state, setState] = useState<number>(initialValue);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setState(Number(e.target.value));
  }, []);

  const setParam = useCallback(
    useThrottle(PARAMS_HANDLER_DEBOUNCE_DELAY, (value: number) => {
      updateSearch({ [name]: state.toString() });
      onChange(value);
    }), [onChange]);

  useEffect(() => {
    const initialState = Number(searchParams.get(name) || initialValue);
    setState(initialState);
    setParam(initialState);
  }, []);

  useEffect(() => {
    setParam(state);
  }, [state]);

  const maxValue = max || initialValue * 2
  const percent = (100 * (state - min)) / (maxValue - min)

  return (
    <>
      <span className={'count-title'}>{name}</span>
      <div className={'count'}>
        <div className={'count-container'}>
          <span className={'count-value'}>{state}</span>
          <span
            className={'count-pic'}
            style={{
              backgroundImage: `linear-gradient(90deg, black 0%, black ${percent}%, rgb(255,255,255) ${percent}%, rgb(255,255,255) 100%)`,
            }}
          />
        </div>
      </div>
      <input
        className={'counter'}
        type={'range'}
        min={min}
        max={maxValue}
        step={step}
        value={state}
        onChange={handleChange}
      />
    </>
  )
}

export default memo(ParamHandler)
