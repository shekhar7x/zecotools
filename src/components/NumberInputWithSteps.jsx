import React, { useRef, useEffect } from 'react';
import './NumberInputWithSteps.css';

export default function NumberInputWithSteps({
  value,
  onChange,
  step = 1,
  min = 0,
  locale = 'en-US',
  style = {}
}) {
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const parseNum = (v) => parseFloat(String(v).replace(/,/g, '')) || 0;

  const handleChange = (e) => {
    onChange(e.target.value);
  };

  const handleBlur = (e) => {
    const raw = e.target.value.replace(/,/g, '');
    if (raw && !isNaN(raw)) {
      onChange(Number(raw).toLocaleString(locale));
    }
  };

  const doIncrement = () => {
    const current = parseNum(valueRef.current);
    const newValue = (current + step).toLocaleString(locale);
    onChange(newValue);
    valueRef.current = newValue;
  };

  const doDecrement = () => {
    const current = parseNum(valueRef.current);
    const newValue = Math.max(min, current - step);
    const formatted = newValue.toLocaleString(locale);
    onChange(formatted);
    valueRef.current = formatted;
  };

  const startIncrement = (e) => {
    e.preventDefault();
    doIncrement();
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        doIncrement();
      }, 100);
    }, 300);
  };

  const startDecrement = (e) => {
    e.preventDefault();
    doDecrement();
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        doDecrement();
      }, 100);
    }, 300);
  };

  const stopChange = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  return (
    <div className="number-input-with-steps">
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        style={style}
      />
      <div className="step-buttons">
        <button
          type="button"
          className="step-btn step-up"
          onMouseDown={startIncrement}
          onMouseUp={stopChange}
          onMouseLeave={stopChange}
          onTouchStart={startIncrement}
          onTouchEnd={stopChange}
        >
          ▲
        </button>
        <button
          type="button"
          className="step-btn step-down"
          onMouseDown={startDecrement}
          onMouseUp={stopChange}
          onMouseLeave={stopChange}
          onTouchStart={startDecrement}
          onTouchEnd={stopChange}
        >
          ▼
        </button>
      </div>
    </div>
  );
}
