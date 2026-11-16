'use client';

import { useEffect, useRef, useState } from 'react';

interface NumberInputProps {
  id?: string;
  className?: string;
  min?: number;
  max?: number;
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  disabled?: boolean;
}

function clamp(raw: number, min?: number, max?: number): number {
  return Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, raw));
}

export function NumberInput({ id, className, min, max, value, onChange, placeholder, disabled }: NumberInputProps) {
  const [text, setText] = useState(String(value));
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setText(String(value));
    }
  }, [value]);

  const handleChange = (raw: string) => {
    setText(raw);
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return;
    const next = clamp(parsed, min, max);
    if (next !== lastEmitted.current) {
      lastEmitted.current = next;
      onChange(next);
    }
  };

  const handleBlur = (raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    const next = Number.isFinite(parsed) ? clamp(parsed, min, max) : lastEmitted.current;
    if (next !== lastEmitted.current) {
      lastEmitted.current = next;
      onChange(next);
    }
    setText(String(next));
  };

  return (
    <input
      id={id}
      className={className}
      type="number"
      min={min}
      max={max}
      placeholder={placeholder}
      disabled={disabled}
      value={text}
      onChange={e => handleChange(e.target.value)}
      onBlur={e => handleBlur(e.target.value)}
    />
  );
}
