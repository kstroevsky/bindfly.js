import React from 'react';

interface IToggleButtonProps {
  keyInput: number;
  value: boolean;
  onChange: () => void;
}

const ToggleButton: React.FC<IToggleButtonProps> = ({
  keyInput,
  value,
  onChange
}) => {
  return (
    <>
      <input
        type="checkbox"
        className="checkbox-bipolar-input"
        id={`bipolar-${keyInput}`}
        checked={value}
        onChange={onChange}
      />
      <label htmlFor={`bipolar-${keyInput}`}>
        <span className="checkbox-bipolar">
          <span className="on">I</span>
          <span className="off">O</span>
        </span>
      </label>
    </>
  );
};

export default ToggleButton;
