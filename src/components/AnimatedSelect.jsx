/**
 * AnimatedSelect
 *
 * A fully custom <select> replacement that supports:
 *   - CSS chevron pinned 8px from the right edge (fixes the OS-arrow positioning)
 *   - Framer Motion fade + slide-down on the options list (opacity 0→1, y -4→0)
 *   - Chevron rotates 180° when open (200ms ease)
 *   - Keyboard navigation: Enter/Space open, Escape/Tab close, arrow keys move
 *   - aria-expanded + role="listbox" for screen-reader compatibility
 *
 * Props:
 *   id        — forwarded to the trigger button (for <label htmlFor>)
 *   value     — currently selected value string
 *   onChange  — called with the new value string
 *   options   — [{ value: string, label: string }]
 *   className — extra class on the wrapper div
 *   placeholder — shown when value is ""
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import "./AnimatedSelect.css";

const dropdownVariants = {
  hidden: { opacity: 0, y: -4 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.15, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: 0.1, ease: "easeIn" },
  },
};

export default function AnimatedSelect({
  id,
  value,
  onChange,
  options = [],
  className = "",
  placeholder = "Select…",
}) {
  const [open, setOpen] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const wrapperRef = useRef(null);
  const listRef = useRef(null);

  const selectedLabel =
    options.find((o) => o.value === value)?.label ?? placeholder;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Reset focus index when closed
  useEffect(() => {
    if (!open) setFocusedIdx(-1);
  }, [open]);

  // Move DOM focus to the highlighted option
  useEffect(() => {
    if (!open || focusedIdx < 0) return;
    const items = listRef.current?.querySelectorAll("[role='option']");
    items?.[focusedIdx]?.focus();
  }, [open, focusedIdx]);

  function handleTriggerKeyDown(e) {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      // Focus first selected or first item
      const idx = Math.max(0, options.findIndex((o) => o.value === value));
      setFocusedIdx(idx);
    }
  }

  function handleOptionKeyDown(e, idx) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIdx(Math.min(idx + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIdx(Math.max(idx - 1, 0));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      select(options[idx].value);
    } else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
      wrapperRef.current?.querySelector("button")?.focus();
    }
  }

  function select(val) {
    onChange(val);
    setOpen(false);
    wrapperRef.current?.querySelector("button")?.focus();
  }

  return (
    <div
      ref={wrapperRef}
      className={`asel${className ? " " + className : ""}`}
    >
      {/* Trigger button — styled to look like .field__input */}
      <button
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={selectedLabel}
        className={`asel__trigger field__input${open ? " asel__trigger--open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="asel__value">{selectedLabel}</span>
        {/* Chevron — rotates 180° when open */}
        <motion.span
          className="asel__chevron"
          aria-hidden="true"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
        >
          {/* Inline SVG so it respects currentColor and needs no icon dep */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.span>
      </button>

      {/* Animated options list */}
      <AnimatePresence>
        {open && (
          <motion.ul
            ref={listRef}
            role="listbox"
            className="asel__list"
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {options.map((opt, idx) => (
              <li
                key={opt.value}
                role="option"
                tabIndex={-1}
                aria-selected={opt.value === value}
                className={`asel__option${opt.value === value ? " asel__option--selected" : ""}`}
                onClick={() => select(opt.value)}
                onKeyDown={(e) => handleOptionKeyDown(e, idx)}
              >
                {opt.label}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
