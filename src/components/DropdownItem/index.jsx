import React from "react";

const DropdownItem = ({ propertySets, property }) => {
  return (
    <li className="CardPanel">
      <p>{`${property}: ${propertySets[property]}`}</p>
    </li>
  );
};

export default DropdownItem;
