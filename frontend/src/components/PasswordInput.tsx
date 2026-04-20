import { useState } from "react";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export function PasswordInput({ className = "", ...rest }: Props) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        {...rest}
        type={show ? "text" : "password"}
        className={`input pr-12 ${className}`}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}
