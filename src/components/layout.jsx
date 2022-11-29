import { useState } from "react";
import { Link, Outlet } from "react-router-dom";
import properties from "../properties.json";

const initialState = properties;

const Layout = () => {
  const [properties, setProperties] = useState(initialState);

  return (
    <>
      <aside>
        <nav>
          <ul>
            {properties?.map(({ name }, idx) => {
              console.log(name);
              return (
                <li key={`${idx} + ${name}`}>
                  <Link to={`/${name === "Default" ? "" : name}`}>{name}</Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <hr />
      </aside>
      <Outlet context={{ properties }} />
    </>
  );
};

export { Layout };
