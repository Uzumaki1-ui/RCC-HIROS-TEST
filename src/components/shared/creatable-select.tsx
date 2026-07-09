"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, X, Check } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface CreatableSelectProps {
  items: Array<{ id: string; name: string; active?: boolean }>;
  value: string; // ID of currently selected item, or empty string for new
  inputValue: string; // Current text input value
  onValueChange: (id: string, name: string, isNew: boolean) => void;
  onInputChange: (text: string) => void;
  placeholder?: string;
  createLabel?: string; // e.g. "Create department" or "Create position"
  disabled?: boolean;
  className?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function CreatableSelect({
  items,
  value,
  inputValue,
  onValueChange,
  onInputChange,
  placeholder = "Type to search or create...",
  createLabel = "Create",
  disabled = false,
  className = "",
}: CreatableSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Determine if an existing item is currently selected (locked state)
  const selectedItem = value
    ? items.find((item) => item.id === value) ?? null
    : null;
  const isLocked = !!selectedItem;

  // Determine if current input represents a NEW item to be created
  const trimmedInput = inputValue.trim();
  const hasExactMatch = items.some(
    (item) => item.name.toLowerCase() === trimmedInput.toLowerCase()
  );
  const isNewItem = trimmedInput.length > 0 && !hasExactMatch && !value;

  // Filter active items by input text (case-insensitive)
  const activeItems = items.filter((item) => item.active !== false);
  const filteredItems = activeItems.filter((item) =>
    item.name.toLowerCase().includes(trimmedInput.toLowerCase())
  );

  // ─── Click-outside detection ──────────────────────────────────────────────

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onInputChange(e.target.value);
    if (!open) setOpen(true);
  };

  const handleInputFocus = () => {
    if (!isLocked) {
      setOpen(true);
    }
  };

  const handleSelectExisting = (item: { id: string; name: string }) => {
    onValueChange(item.id, item.name, false);
    onInputChange(item.name);
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleCreateNew = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onValueChange("", trimmed, true);
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    onValueChange("", "", false);
    onInputChange("");
    // Focus input after clearing
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const trimmed = inputValue.trim();
    const hasMatch = items.some(
      (item) => item.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (e.key === "Enter" && trimmed && !hasMatch && !value) {
      e.preventDefault();
      handleCreateNew();
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input area */}
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={isLocked ? selectedItem!.name : inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={isLocked}
          className={`
            w-full border rounded-lg px-3 py-2 text-sm
            bg-rcc-surface placeholder:text-rcc-text-muted
            focus:outline-none focus:ring-2 focus:ring-rcc-accent focus:border-rcc-accent
            disabled:opacity-50 disabled:cursor-not-allowed
            ${isLocked ? "border-rcc-border bg-rcc-bg/40 text-rcc-text-primary cursor-default pr-8" : "border-rcc-border text-rcc-text-primary pr-3"}
          `}
        />

        {/* Locked state: clear button */}
        {isLocked && (
          <div className="absolute right-2 flex items-center">
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              className="p-0.5 rounded hover:bg-rcc-bg/60 text-rcc-text-muted hover:text-rcc-text-primary transition-colors"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* New item badge */}
        {isNewItem && !isLocked && (
          <div className="absolute right-2 flex items-center">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold leading-none bg-rcc-accent/15 text-rcc-accent border border-rcc-accent/25">
              NEW
            </span>
          </div>
        )}
      </div>

      {/* Dropdown */}
      {open && !isLocked && !disabled && (
        <div className="absolute z-50 mt-1 w-full bg-rcc-surface border border-rcc-border rounded-lg shadow-lg overflow-hidden">
          <div className="max-h-60 overflow-y-auto">
            {/* Filtered existing items */}
            {filteredItems.length > 0 &&
              filteredItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`
                    w-full flex items-center gap-2 px-3 py-2 text-sm text-left
                    hover:bg-rcc-bg/60 transition-colors
                    ${value === item.id ? "bg-rcc-accent/8 text-rcc-accent" : "text-rcc-text-primary"}
                  `}
                  onClick={() => handleSelectExisting(item)}
                >
                  <span className="flex-1 truncate">{item.name}</span>
                  {value === item.id && (
                    <Check className="h-3.5 w-3.5 text-rcc-accent shrink-0" />
                  )}
                </button>
              ))}

            {/* Create option — shown when input has text and no exact match */}
            {trimmedInput && !hasExactMatch && (
              <button
                type="button"
                className={`
                  w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left
                  border-t border-rcc-border/50
                  bg-rcc-accent/5 hover:bg-rcc-accent/10 transition-colors
                  border-l-2 border-l-rcc-accent
                `}
                onClick={handleCreateNew}
              >
                <Plus className="h-3.5 w-3.5 text-rcc-accent shrink-0" />
                <span className="text-rcc-accent font-medium">
                  {createLabel}
                </span>
                <span className="text-rcc-accent/80 truncate">
                  &lsquo;{trimmedInput}&rsquo;
                </span>
              </button>
            )}

            {/* Empty state — no items at all */}
            {filteredItems.length === 0 && !trimmedInput && (
              <div className="px-3 py-4 text-sm text-rcc-text-muted text-center">
                No items available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
