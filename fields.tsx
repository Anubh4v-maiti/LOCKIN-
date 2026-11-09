"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function NumberField({
  id,
  label,
  value,
  onChange,
  unit,
  placeholder,
  min = 0,
  max,
  step = 1,
  hint,
  disabled,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  unit?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="flex items-center justify-between gap-2">
        <span>{label}</span>
        {unit ? <span className="text-[10px] font-normal text-muted-foreground">{unit}</span> : null}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="tabular-nums"
      />
      {hint ? <p className="text-[10px] leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  hint,
  required,
  autoComplete,
  minLength,
  maxLength,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
  required?: boolean;
  autoComplete?: string;
  minLength?: number;
  maxLength?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        minLength={minLength}
        maxLength={maxLength}
      />
      {hint ? <p className="text-[10px] leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
