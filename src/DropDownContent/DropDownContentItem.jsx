import React from "react";

const DropDownContentItem = ({ propertySets, property }) => {
  return (
    <li className="CardPanel">
      <p>{`${property}: ${propertySets[property]}`}</p>
    </li>
  );
};

export default DropDownContentItem;
