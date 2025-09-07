// src/components/admin/SearchBar.jsx
import { useState, useEffect, useCallback } from "react";

export default function SearchBar({ value = "", onChange, placeholder = "Search users…" }) {
  const [internal, setInternal] = useState(value);

  // keep in sync if parent resets value
  useEffect(() => {
    setInternal(value);
  }, [value]);

  // debounce updates to parent
  const emit = useCallback(() => {
    onChange && onChange(internal);
  }, [internal, onChange]);

  useEffect(() => {
    const t = setTimeout(emit, 200);
    return () => clearTimeout(t);
  }, [internal, emit]);

  return (
    <div className="searchbar">
      <input
        aria-label="Search users"
        placeholder={placeholder}
        value={internal}
        onChange={(e) => setInternal(e.target.value)}
      />
      {internal && (
        <button
          aria-label="Clear search"
          type="button"
          onClick={() => setInternal("")}
          className="clear-btn"
        >
          ×
        </button>
      )}
    </div>
  );
}
