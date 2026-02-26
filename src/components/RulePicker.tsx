import { useMemo, useCallback, useState, useRef, useEffect } from "react";
import type { Rule } from "../types";

interface RulePickerProps {
  rules: Rule[];
  selectedRuleIds: Set<string>;
  onToggle: (ruleId: string) => void;
}

export default function RulePicker({ rules, selectedRuleIds, onToggle }: RulePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Group rules by baseType
  const groupedRules = useMemo(() => {
    const groups: Record<string, Rule[]> = {};
    for (const rule of rules) {
      const base = rule.baseType || "Other";
      if (!groups[base]) groups[base] = [];
      groups[base].push(rule);
    }
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }
    return groups;
  }, [rules]);

  const sortedBaseTypes = useMemo(() => {
    return Object.keys(groupedRules).sort();
  }, [groupedRules]);

  const handleToggle = useCallback(
    (ruleId: string) => {
      onToggle(ruleId);
    },
    [onToggle],
  );

  if (rules.length === 0) return null;

  const count = selectedRuleIds.size;
  const label = count === 0
    ? "Select Exception Rules..."
    : `${count} rule${count === 1 ? "" : "s"} selected`;

  return (
    <div className="fut-rule-picker" ref={containerRef}>
      <button
        className="fut-rule-dropdown-trigger"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <span>{label}</span>
        <span className={`fut-rule-dropdown-arrow${open ? " open" : ""}`}>&#9662;</span>
      </button>

      {open && (
        <div className="fut-rule-dropdown-menu">
          {sortedBaseTypes.map((baseType) => (
            <div key={baseType} className="fut-rule-dropdown-group">
              <div className="fut-rule-dropdown-group-title">{baseType}</div>
              {groupedRules[baseType].map((rule) => {
                const checked = selectedRuleIds.has(rule.id);
                return (
                  <label key={rule.id} className="fut-rule-dropdown-item">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggle(rule.id)}
                    />
                    <span>{rule.name || rule.id}</span>
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
