// game/rng.ts —— 注入式伪随机数生成器（ADR 010：禁止裸 Math.random() 用于可复现逻辑）
// mulberry32：轻量、可复现，同 seed 同序列。世界种子来自 crypto 真随机（仅存档创建时一次）。

export class SeededRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** 返回 [0, 1) 的浮点数 */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** 返回 [min, max] 的整数（含两端） */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** 从数组中随机取一个元素 */
  pick<T>(arr: T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }
}
