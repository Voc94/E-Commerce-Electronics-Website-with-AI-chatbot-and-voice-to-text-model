// src/components/admin/BrandSearchSelect.jsx
import { useState, useEffect, useRef } from "react";
import { BRAND } from "../../config.js";
import { fetchWithAuth } from "../../utils/auth.js";

export default function BrandSearchSelect({ selected, onSelect, disabled }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    // debounce and fetch (including empty query => all)
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const url = BRAND.LIST(query);
        // fetchWithAuth is expected to attach Authorization: Bearer <token>
        const res = await fetchWithAuth(url);
        if (res.ok) {
          const list = await res.json();
          setSuggestions(list.slice(0, 10));
        } else {
          setSuggestions([]);
        }
      } catch (e) {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  return (
    <div className="brand-search-select">
      <label>Brand</label>
      <div className="search-wrapper">
        <input
          placeholder="Search brands..."
          value={selected ? selected.name : query}
          onChange={(e) => {
            setQuery(e.target.value);
            onSelect(null);
          }}
          disabled={disabled}
          autoComplete="off"
        />
        {loading && <div className="loader-inline">…</div>}
      </div>
      {suggestions.length > 0 && !selected && (
        <ul className="suggestions">
          {suggestions.map((b) => (
            <li
              key={b.id}
              onClick={() => {
                onSelect(b);
                setQuery("");
                setSuggestions([]);
              }}
            >
              {b.name} ({b.slug})
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <div className="selected-brand">
          <span>{selected.name}</span>
          <button
            type="button"
            onClick={() => {
              onSelect(null);
            }}
            disabled={disabled}
            aria-label="Clear brand"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
