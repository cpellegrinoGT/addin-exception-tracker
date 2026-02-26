import { useMemo, useCallback } from "react";
import { Checkbox } from "@geotab/zenith";
import type { Rule } from "../types";

interface RulePickerProps {
  rules: Rule[];
  selectedRuleIds: Set<string>;
  onToggle: (ruleId: string) => void;
}

export default function RulePicker({ rules, selectedRuleIds, onToggle }: RulePickerProps) {
  // Group rules by baseType
  const groupedRules = useMemo(() => {
    const groups: Record<string, Rule[]> = {};
    for (const rule of rules) {
      const base = rule.baseType || "Other";
      if (!groups[base]) groups[base] = [];
      groups[base].push(rule);
    }
    // Sort rules within each group
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }
    return groups;
  }, [rules]);

  const sortedBaseTypes = useMemo(() => {
    return Object.keys(groupedRules).sort();
  }, [groupedRules]);

  const handleChange = useCallback(
    (ruleId: string) => () => {
      onToggle(ruleId);
    },
    [onToggle],
  );

  if (rules.length === 0) return null;

  return (
    <div className="fut-rule-picker">
      <div className="fut-rule-picker-label">Exception Rules:</div>
      <div className="fut-rule-groups">
        {sortedBaseTypes.map((baseType) => (
          <div key={baseType} className="fut-rule-group">
            <div className="fut-rule-group-title">{baseType}</div>
            <div className="fut-rule-checkboxes">
              {groupedRules[baseType].map((rule) => (
                <Checkbox
                  key={rule.id}
                  checked={selectedRuleIds.has(rule.id)}
                  onChange={handleChange(rule.id)}
                  label={rule.name || rule.id}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
