import React from "react";
import { IProperty } from "../utils/types";
import DropDownContentItem from "./DropDownContentItem";

interface IDropDownContentProps {
  propertySets: IProperty
}

const DropDownContent: React.FC<IDropDownContentProps> = ({ propertySets }) => {
  return (
    <ul className="DropDownContent">
      {Object.keys(propertySets).map((property, idx) => (
        <DropDownContentItem key={idx} propertySets={propertySets} property={property} />
      ))}
    </ul>
  );
};

export default DropDownContent;
