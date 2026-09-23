import type { SaveData, Resources } from './save';
import { RESOURCE_LABELS } from './resources';
import { FIRE_COST } from './rules';
import { POTTERY_COST, FIRE_FARMING_COST } from './tech';
import { SHED_UNLOCK_HUTS, SHED_STORAGE_BONUS } from './buildings';

export function resourceGap(resources: Resources, cost: Partial<Resources>): string {
  const gaps = (Object.keys(cost) as (keyof Resources)[]).flatMap(key => {
    const gap = (cost[key] ?? 0) - resources[key];
    return gap > 0 ? [`${Math.ceil(gap * 10) / 10} ${RESOURCE_LABELS[key]}`] : [];
  });
  return gaps.length ? `还差 ${gaps.join('、')}` : '资源已备齐';
}

export function nextGoal(s: SaveData): { title: string; detail: string; step: number } {
  if (!s.fireLit) return { title: '点亮第一堆篝火', detail: `小人会自动采集。攒到 ${FIRE_COST} 浆果后，点击「生火」。`, step: 1 };
  if (s.workers.length < 3) return { title: `招募采集伙伴（${s.workers.length}/3）`, detail: '先凑齐 3 人，自动分担浆果、木材和石头采集，再准备建房。', step: 2 };
  if (!s.tech.pottery) return { title: '研究制陶', detail: `准备 ${POTTERY_COST.berries} 浆果和 ${POTTERY_COST.wood} 木材，提高浆果生产能力。`, step: 3 };
  if (s.buildings.huts < SHED_UNLOCK_HUTS) return { title: `建造茅草房（${s.buildings.huts}/${SHED_UNLOCK_HUTS}）`, detail: `建造可增加人口容量；建好 ${SHED_UNLOCK_HUTS} 座后解锁仓库。`, step: 4 };
  if (!s.buildings.sheds) return { title: '建造第一座仓库', detail: `每种资源的存储容量增加 ${SHED_STORAGE_BONUS}，为村庄发展做准备。`, step: 5 };
  if (!s.tech.fireFarming) return { title: '研究火耕，迈入村庄', detail: `攒到 ${FIRE_FARMING_COST.berries} 浆果和 ${FIRE_FARMING_COST.stone} 石头，解锁村庄时代。`, step: 6 };
  return { title: '村庄已建立', detail: '本版目标已达成。继续扩建、招募，也可以导出存档保存这份进度。', step: 7 };
}
