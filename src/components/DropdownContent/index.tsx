import React, { FC, useCallback, useState } from "react";
import CheckIcon from "../../assets/Check_icon.svg";
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

  const onClick = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(propertySet))
    setIsCopied(true);

    setTimeout(() => {
      setIsCopied(false);
    }, 1000)
  }, [propertySet]);

  return (
  <>
    <ul className="DropdownContent" onClick={onClick}>
      {Object.entries<TPropertiesValues>(propertySet).map(
        ([propertyKey, propertyValue]: [string, TPropertiesValues], idx: number) => (
          <DropdownItem key={idx} {...{ propertyKey, propertyValue }} />
        ))}
    </ul>
    {isCopied && 
      <div className="Clipboard">
        <img src={CheckIcon} alt="check icon" />
        <p>Copied!</p>
      </div>
    }
  </>
)};

export default DropdownContent;
