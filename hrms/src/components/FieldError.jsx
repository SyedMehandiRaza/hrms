import { MdOutlineError } from "react-icons/md";

// The inline error shown directly under an input (client or server message).
// Pass a react-hook-form error object (`error`) or a plain `message`.
export default function FieldError({ error, message, className = "" }) {
  const text = message || (error && error.message);
  if (!text) return null;
  return (
    <p role="alert" className={`flex items-center gap-1 text-xs text-red-500 mt-1.5 ${className}`}>
      <MdOutlineError className="shrink-0" />
      {text}
    </p>
  );
}
