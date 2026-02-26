import { Tabs } from "@geotab/zenith";

const TAB_ITEMS = [
  { id: "fleet", name: "Fleet Overview" },
  { id: "exceptions", name: "Exception Breakdown" },
];

interface TabBarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export default function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return <Tabs tabs={TAB_ITEMS} activeTabId={activeTab} onTabChange={onTabChange} />;
}
