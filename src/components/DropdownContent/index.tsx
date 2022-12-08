import React, { FC } from "react";
import { IProperty, TPropertiesValues } from "../../shared/types";
import DropdownItem from "../DropdownItem";

export interface IDropdownContent {
  propertySet: IProperty
}

type TKeys<T extends object> = keyof { [P in keyof T]: P }

function createEnum<T extends { [P in keyof T]: P }>(o: T) {
  return o
}

const DropdownContent: FC<IDropdownContent> = ({ propertySet }) => (
  <ul className="DropdownContent">
    {Object.entries<TPropertiesValues>(propertySet).map(
      ([propertyKey, propertyValue]: [string, TPropertiesValues], idx: number) => (
        <DropdownItem key={idx} {...{ propertyKey, propertyValue }} />
      ))}
  </ul>
);

export default DropdownContent;
