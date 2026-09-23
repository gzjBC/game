// game/names.ts —— 随机角色命名（ADR 007：英文名内部 ID + 音译中文显示）
// M1 用内置小表（20 个），后续可外挂 JSON 扩充。

export interface CharacterName {
  en: string;
  zh: string;
}

// 英文名（字母组合）→ 中文音译对照表
const NAME_POOL: CharacterName[] = [
  { en: 'Kelvin', zh: '凯尔文' },
  { en: 'Mara', zh: '玛拉' },
  { en: 'Tobin', zh: '托宾' },
  { en: 'Lira', zh: '莉拉' },
  { en: 'Orin', zh: '奥林' },
  { en: 'Sable', zh: '塞布尔' },
  { en: 'Nyx', zh: '尼克斯' },
  { en: 'Doran', zh: '多兰' },
  { en: 'Elva', zh: '艾尔瓦' },
  { en: 'Grom', zh: '格罗姆' },
  { en: 'Faye', zh: '法耶' },
  { en: 'Hugo', zh: '雨果' },
  { en: 'Iris', zh: '艾丽丝' },
  { en: 'Jorin', zh: '乔林' },
  { en: 'Kael', zh: '凯尔' },
  { en: 'Lumen', zh: '卢门' },
  { en: 'Mira', zh: '米拉' },
  { en: 'Nora', zh: '诺拉' },
  { en: 'Pike', zh: '派克' },
  { en: 'Rune', zh: '鲁恩' },
];

/** 从名字池随机取一个（用注入 RNG，可复现） */
export function randomName(rng: { int(min: number, max: number): number }): CharacterName {
  const i = rng.int(0, NAME_POOL.length - 1);
  return NAME_POOL[i];
}
