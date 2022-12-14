import React, { FC, useCallback, useState } from "react";
import CheckIcon from "../../assets/CheckIcon";
import { COPY_ANIMATION_DURATION } from "../../shared/constants";
import { IProperty, TPropertiesValues } from "../../shared/types";
import DropdownItem from "../DropdownItem";

export interface IDropdownContent {
  propertySet: IProperty
}

type TKeys<T extends object> = keyof { [P in keyof T]: P }

function createEnum<T extends { [P in keyof T]: P }>(o: T) {
  return o
}

const DropdownContent: FC<IDropdownContent> = ({ propertySet }) => {
  const [isCopied, setIsCopied] = useState(false);

  const onListClick = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(propertySet));
    setIsCopied(true);

    setTimeout(() => {
      setIsCopied(false);
    }, COPY_ANIMATION_DURATION);
  }, [propertySet]);


  return (
    <ul className="DropdownContent">
      <CheckIcon width={16} height={16} fill={isCopied ? "#36c373" : "white"} className="Clipboard" onClick={onListClick} />
      {Object.entries<TPropertiesValues>(propertySet).map(
        ([propertyKey, propertyValue]: [string, TPropertiesValues], idx: number) => (
          <DropdownItem key={idx} {...{ propertyKey, propertyValue }} />
        ))}
    </ul>
)};

export default DropdownContent;
