/**
 * QuarkDSL Quantum Simulator
 * State vector simulation of quantum circuits
 */

export interface Complex {
  re: number;
  im: number;
}

function complex(re: number, im: number = 0): Complex {
  return { re, im };
}

function add(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

function mul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

function scale(a: Complex, s: number): Complex {
  return { re: a.re * s, im: a.im * s };
}

function magnitude2(a: Complex): number {
  return a.re * a.re + a.im * a.im;
}

export class QuantumSimulator {
  private numQubits: number;
  private stateVector: Complex[];
  private gateLog: string[] = [];

  constructor(numQubits: number = 8) {
    this.numQubits = numQubits;
    this.stateVector = new Array(1 << numQubits)
      .fill(null)
      .map(() => complex(0));
    this.stateVector[0] = complex(1); // |00...0> state
  }

  reset(): void {
    this.stateVector = new Array(1 << this.numQubits)
      .fill(null)
      .map(() => complex(0));
    this.stateVector[0] = complex(1);
    this.gateLog = [];
  }

  getGateLog(): string[] {
    return [...this.gateLog];
  }

  // Single-qubit gates
  h(qubit: number): void {
    this.gateLog.push(`H(q${qubit})`);
    const factor = 1 / Math.sqrt(2);
    this.applySingleQubitGate(qubit, [
      [complex(factor), complex(factor)],
      [complex(factor), complex(-factor)],
    ]);
  }

  x(qubit: number): void {
    this.gateLog.push(`X(q${qubit})`);
    this.applySingleQubitGate(qubit, [
      [complex(0), complex(1)],
      [complex(1), complex(0)],
    ]);
  }

  y(qubit: number): void {
    this.gateLog.push(`Y(q${qubit})`);
    this.applySingleQubitGate(qubit, [
      [complex(0), complex(0, -1)],
      [complex(0, 1), complex(0)],
    ]);
  }

  z(qubit: number): void {
    this.gateLog.push(`Z(q${qubit})`);
    this.applySingleQubitGate(qubit, [
      [complex(1), complex(0)],
      [complex(0), complex(-1)],
    ]);
  }

  rx(qubit: number, theta: number): void {
    this.gateLog.push(`RX(q${qubit}, ${theta.toFixed(3)})`);
    const c = Math.cos(theta / 2);
    const s = Math.sin(theta / 2);
    this.applySingleQubitGate(qubit, [
      [complex(c), complex(0, -s)],
      [complex(0, -s), complex(c)],
    ]);
  }

  ry(qubit: number, theta: number): void {
    this.gateLog.push(`RY(q${qubit}, ${theta.toFixed(3)})`);
    const c = Math.cos(theta / 2);
    const s = Math.sin(theta / 2);
    this.applySingleQubitGate(qubit, [
      [complex(c), complex(-s)],
      [complex(s), complex(c)],
    ]);
  }

  rz(qubit: number, theta: number): void {
    this.gateLog.push(`RZ(q${qubit}, ${theta.toFixed(3)})`);
    const c = Math.cos(theta / 2);
    const s = Math.sin(theta / 2);
    this.applySingleQubitGate(qubit, [
      [complex(c, -s), complex(0)],
      [complex(0), complex(c, s)],
    ]);
  }

  // Two-qubit gates
  cx(control: number, target: number): void {
    this.gateLog.push(`CX(q${control}, q${target})`);
    this.applyControlledGate(control, target, [
      [complex(0), complex(1)],
      [complex(1), complex(0)],
    ]);
  }

  cz(control: number, target: number): void {
    this.gateLog.push(`CZ(q${control}, q${target})`);
    this.applyControlledGate(control, target, [
      [complex(1), complex(0)],
      [complex(0), complex(-1)],
    ]);
  }

  // Measurement
  measure(qubit: number): number {
    this.gateLog.push(`MEASURE(q${qubit})`);
    let prob0 = 0;
    const n = 1 << this.numQubits;
    const mask = 1 << qubit;

    for (let i = 0; i < n; i++) {
      if ((i & mask) === 0) {
        prob0 += magnitude2(this.stateVector[i]);
      }
    }

    const result = Math.random() < prob0 ? 0 : 1;

    // Collapse state
    const norm = result === 0 ? Math.sqrt(prob0) : Math.sqrt(1 - prob0);
    for (let i = 0; i < n; i++) {
      const bitValue = (i & mask) === 0 ? 0 : 1;
      if (bitValue === result) {
        this.stateVector[i] = scale(this.stateVector[i], 1 / norm);
      } else {
        this.stateVector[i] = complex(0);
      }
    }

    return result;
  }

  private applySingleQubitGate(qubit: number, gate: Complex[][]): void {
    const n = 1 << this.numQubits;
    const mask = 1 << qubit;
    const newState = new Array(n).fill(null).map(() => complex(0));

    for (let i = 0; i < n; i++) {
      const bit = (i & mask) === 0 ? 0 : 1;
      const partner = bit === 0 ? i | mask : i & ~mask;

      if (i < partner) {
        const a0 = this.stateVector[i];
        const a1 = this.stateVector[partner];

        newState[i] = add(mul(gate[0][0], a0), mul(gate[0][1], a1));
        newState[partner] = add(mul(gate[1][0], a0), mul(gate[1][1], a1));
      }
    }

    this.stateVector = newState;
  }

  private applyControlledGate(
    control: number,
    target: number,
    gate: Complex[][]
  ): void {
    const n = 1 << this.numQubits;
    const controlMask = 1 << control;
    const targetMask = 1 << target;
    const newState = [...this.stateVector];

    for (let i = 0; i < n; i++) {
      // Only apply when control qubit is 1
      if ((i & controlMask) !== 0) {
        const targetBit = (i & targetMask) === 0 ? 0 : 1;
        const partner = targetBit === 0 ? i | targetMask : i & ~targetMask;

        if (i < partner) {
          const a0 = this.stateVector[i];
          const a1 = this.stateVector[partner];

          newState[i] = add(mul(gate[0][0], a0), mul(gate[0][1], a1));
          newState[partner] = add(mul(gate[1][0], a0), mul(gate[1][1], a1));
        }
      }
    }

    this.stateVector = newState;
  }

  // Get probabilities for all basis states
  getProbabilities(): Map<string, number> {
    const probs = new Map<string, number>();
    const n = 1 << this.numQubits;

    for (let i = 0; i < n; i++) {
      const prob = magnitude2(this.stateVector[i]);
      if (prob > 1e-10) {
        const binaryStr = i.toString(2).padStart(this.numQubits, "0");
        probs.set(binaryStr, prob);
      }
    }

    return probs;
  }

  // Sample from the quantum state
  sample(shots: number = 1024): Map<string, number> {
    const counts = new Map<string, number>();
    const probs = this.getProbabilities();
    const states = Array.from(probs.keys());
    const probValues = Array.from(probs.values());

    // Build cumulative distribution
    const cumulative: number[] = [];
    let sum = 0;
    for (const p of probValues) {
      sum += p;
      cumulative.push(sum);
    }

    for (let i = 0; i < shots; i++) {
      const r = Math.random();
      let idx = 0;
      while (idx < cumulative.length - 1 && r > cumulative[idx]) {
        idx++;
      }
      const state = states[idx];
      counts.set(state, (counts.get(state) || 0) + 1);
    }

    return counts;
  }
}
