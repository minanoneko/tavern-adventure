import { useState } from 'react';
import InventoryPanel from './InventoryPanel';
import SkillPanel from './SkillPanel';
import QuestPanel from './QuestPanel';
import WorldMapPanel from './WorldMapPanel';
import LogPanel from './LogPanel';
import RelationPanel from './RelationPanel';

type TabId = 'quest' | 'inventory' | 'skill' | 'map' | 'log' | 'relation';

const TABS: { id: TabId; label: string }[] = [
  { id: 'quest', label: '任务' },
  { id: 'inventory', label: '背包' },
  { id: 'skill', label: '技能' },
  { id: 'map', label: '地图' },
  { id: 'log', label: '日志' },
  { id: 'relation', label: '关系' },
];

export default function TabContainer({ initialTab }: { initialTab?: string }) {
  const [activeTab, setActiveTab] = useState<TabId>((initialTab as TabId) || 'quest');

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <div className="flex border-b border-[var(--color-tavern-border)]">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn text-sm py-2 px-3 ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'quest' && <QuestPanel />}
        {activeTab === 'inventory' && <InventoryPanel />}
        {activeTab === 'skill' && <SkillPanel />}
        {activeTab === 'map' && <WorldMapPanel />}
        {activeTab === 'log' && <LogPanel />}
        {activeTab === 'relation' && <RelationPanel />}
      </div>
    </div>
  );
}
