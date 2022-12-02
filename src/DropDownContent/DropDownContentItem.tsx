import React from "react";
import { IProperty } from "../utils/types";

interface IDropDownContentItemProps {
  propertySets: IProperty,
  property: string
}

const DropDownContentItem: React.FC<IDropDownContentItemProps> = ({ propertySets, property }) => {
  const value = propertySets[property as keyof IProperty];
  return (
    <li className="CardPanel">
      <p>{`${property}: ${value}`}</p>
    </li>
  );
};

export default DropDownContentItem;
