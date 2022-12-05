import React from "react";
import { parametersToString } from "../../shared/utils";

const DropdownItem = ({ propertySets, property }) => {
  return (
    <li className="CardPanel">
      <p>
        {`${property}: `}
        <span>{parametersToString(propertySets[property])}</span>
      </p>
    </li>
  );
};

export default DropdownItem;
