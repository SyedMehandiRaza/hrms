import { useState, useRef, useEffect, forwardRef, useMemo } from "react";
import { MdKeyboardArrowDown, MdSearch } from "react-icons/md";
import { useTranslation } from "react-i18next";

const CustomDropdown = forwardRef(({ 
  options = [], 
  value, 
  onChange, 
  onBlur,
  name,
  placeholder: placeholderProp,
  className = "",
  error = false,
  disabled = false,
  isSearchable = false,
  onSearchChange,
  placement = "bottom",
  // Pulled out of `rest` so it never reaches the <select> alongside `value`
  // (React forbids both); it only seeds the internal state below.
  defaultValue,
  ...rest
}, ref) => {
  const { t } = useTranslation("common");
  const placeholder = placeholderProp ?? t("ui.selectOption");
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);
  const internalSelectRef = useRef(null);
  const searchInputRef = useRef(null);

  // Fallback for uncontrolled internal state if value is not provided
  const [internalValue, setInternalValue] = useState(value ?? defaultValue ?? "");
  const currentValue = value !== undefined ? value : internalValue;

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);

    // Intercept native select value setter so react-hook-form's reset() updates our UI
    const el = internalSelectRef.current;
    if (el) {
      const descriptor = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value');
      if (descriptor && descriptor.set) {
        const originalSet = descriptor.set;
        Object.defineProperty(el, 'value', {
          get: descriptor.get,
          set: function(val) {
            setInternalValue(val);
            originalSet.call(this, val);
          },
          configurable: true
        });
      }
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      // Clean up the overridden property just in case
      if (el) {
        delete el.value;
      }
    };
  }, []);

  // Sync refs if react-hook-form provides one. Must run AFTER the value
  // interceptor above is installed: registering the ref makes react-hook-form
  // write the field's current value into the <select>, and that write is what
  // shows an already-set value (resumed draft, returning to a step, edit form).
  // Effects run in declaration order, so this one has to stay below it.
  useEffect(() => {
    if (typeof ref === 'function') {
      ref(internalSelectRef.current);
    } else if (ref) {
      ref.current = internalSelectRef.current;
    }
  }, [ref]);

  useEffect(() => {
    if (isOpen && isSearchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    if (!isOpen) {
      setSearchTerm("");
    }
  }, [isOpen, isSearchable]);

  const selectedOption = options.find((opt) => String(opt.value) === String(currentValue));

  const handleSelect = (optionValue) => {
    setIsOpen(false);
    
    // Always update internal visual state for uncontrolled usage
    if (value === undefined) {
      setInternalValue(optionValue);
    }
    
    // Call the provided onChange prop (essential for react-hook-form)
    // We pass a synthetic-like event object that react-hook-form expects
    if (onChange) {
      onChange({
        target: {
          name,
          value: optionValue
        }
      });
    }

    // Also update the native select DOM element so validation succeeds
    if (internalSelectRef.current) {
      // Temporarily bypass our own setter if needed, or just let it run
      internalSelectRef.current.value = optionValue;
    }
  };

  const filteredOptions = useMemo(() => {
    // Exclude placeholder/prompt options (empty value options whose label is an instruction like "Select...", "Choose...", "Loading...")
    // from the selectable popup menu list.
    const validOptions = options.filter((opt) => {
      if (opt.value === "" || opt.value === null || opt.value === undefined) {
        const lbl = String(opt.label || "").trim().toLowerCase();
        if (
          lbl.includes("select") ||
          lbl.includes("choose") ||
          lbl.includes("loading") ||
          lbl.includes("please") ||
          lbl.includes("اختر") ||
          lbl.includes("تحديد") ||
          lbl.includes("تحميل") ||
          lbl.includes("رجاء")
        ) {
          return false;
        }
      }
      return true;
    });

    if (!isSearchable || !searchTerm) return validOptions;
    if (onSearchChange) return validOptions; // Bypass local filter if parent handles search
    return validOptions.filter(opt => 
      opt.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, isSearchable, searchTerm, onSearchChange]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Hidden native select for native form integration & react-hook-form */}
      <select 
        ref={internalSelectRef}
        name={name}
        onBlur={onBlur}
        onChange={onChange} // React Hook Form sets its onChange here
        className="sr-only"
        disabled={disabled}
        value={currentValue}
        {...rest}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full bg-white border rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-[#14a0b3] focus:ring-1 focus:ring-[#14a0b3] transition-all duration-200 ${
          error ? "border-red-400 bg-red-50" : "border-gray-200 hover:border-gray-300"
        } ${disabled ? "opacity-60 cursor-not-allowed bg-gray-50" : ""} ${className}`}
      >
        <span className={`block truncate ${!selectedOption ? "text-gray-400" : ""}`}>
          {/* An option may carry a shorter text for the closed box (e.g. "🇸🇦 +966"). */}
          {selectedOption ? selectedOption.selectedLabel ?? selectedOption.label : placeholder}
        </span>
        <MdKeyboardArrowDown 
          className={`text-gray-400 text-lg flex-shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} 
        />
      </button>

      {/* Dropdown Menu */}
      <div 
        className={`absolute z-50 w-full bg-white border border-gray-100 rounded-xl shadow-xl py-1.5 max-h-60 flex flex-col transform transition-all duration-200 ${
          placement === "top" ? "bottom-full mb-1.5 origin-bottom" : "top-full mt-1.5 origin-top"
        } ${
          isOpen ? "opacity-100 scale-y-100 translate-y-0" : `opacity-0 scale-y-95 ${placement === "top" ? "translate-y-2" : "-translate-y-2"} pointer-events-none`
        }`}
      >
        {isSearchable && (
          <div className="px-3 pb-2 pt-1 sticky top-0 bg-white z-10 border-b border-gray-100 shrink-0">
            <div className="relative">
              <MdSearch className="absolute start-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={t("ui.search")}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (onSearchChange) {
                    onSearchChange(e.target.value);
                  }
                }}
                className="w-full ps-8 pe-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-[#14a0b3] focus:ring-1 focus:ring-[#14a0b3]"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}
        <div className="overflow-y-auto custom-scrollbar flex-grow">
          {filteredOptions.length === 0 ? (
            <div className="px-4 py-2 text-sm text-gray-500 text-center">{t("ui.noOptions")}</div>
          ) : (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`w-full text-start px-4 py-2 text-sm transition-colors ${
                  String(option.value) === String(currentValue) 
                    ? "bg-cyan-50/50 text-[#14a0b3] font-semibold" 
                    : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                }`}
                onClick={() => handleSelect(option.value)}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
});

CustomDropdown.displayName = "CustomDropdown";
export default CustomDropdown;

