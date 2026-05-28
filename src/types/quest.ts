// ========== Quest Status ==========
export type QuestStatus = 'available' | 'active' | 'completable' | 'completed' | 'failed' | 'hidden' | 'expired' | 'branching';

export const QUEST_STATUS_LABELS: Record<QuestStatus, string> = {
  available: '可接',
  active: '进行中',
  completable: '可完成',
  completed: '已完成',
  failed: '失败',
  hidden: '隐藏',
  expired: '已过期',
  branching: '分支中',
};

// ========== Objective ==========
export interface Objective {
  id: string;
  description: string;
  completed: boolean;
  hidden?: boolean;
}

// ========== Quest ==========
export interface Quest {
  id: string;
  name: string;
  status: QuestStatus;
  description: string;
  giver: string;
  objectives: Objective[];
  hiddenObjectives?: Objective[];
  rewards: QuestReward;
  penalty?: string;
  relatedLocation?: string;
  relatedNpc?: string;
  timeLimit?: string;
  consequences?: string;
}

export interface QuestReward {
  exp?: number;
  money?: { gold?: number; silver?: number; copper?: number };
  items?: string[];
  skills?: string[];
  factionStanding?: { factionId: string; change: number };
}
