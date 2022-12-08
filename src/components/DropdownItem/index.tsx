import React, { FC } from "react";
import { TPropertiesValues } from "../../shared/types";
import { parametersToString } from "../../shared/utils";

export interface IDropdownItemProps {
  propertyKey: string
  propertyValue: TPropertiesValues
}

const DropdownItem: FC<IDropdownItemProps> = ({ propertyKey, propertyValue }) => {
  return (
    <li className="CardPanel">
      <p>
        {`${propertyKey}: `}
        <span>{parametersToString(propertyValue)}</span>
      </p>
    </li>
  );
};

export default DropdownItem;
