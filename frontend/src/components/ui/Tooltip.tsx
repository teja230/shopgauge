import React from 'react';
import { useState } from 'react';

export function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span className="absolute z-10 left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-black text-white text-xs rounded shadow-lg whitespace-nowrap">
          {text}
        </span>
      )}
    </span>
  );
}
