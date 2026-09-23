// game/resources.ts —— 资源定义（M1：三种资源）
export type ResourceKey = 'berries' | 'wood' | 'stone';

export type Resources = Record<ResourceKey, number>;

export const RESOURCE_LABELS: Record<ResourceKey, string> = {
  berries: '浆果',
  wood: '木材',
  stone: '石头',
};

export function createResources(): Resources {
  return { berries: 0, wood: 0, stone: 0 };
}

/** 加资源（受存储上限截断，M2：仓库扩容机制） */
export function addResource(r: Resources, storage: Resources, key: ResourceKey, n: number): Resources {
  const next = r[key] + n;
  return { ...r, [key]: Math.min(next, storage[key]) };
}
