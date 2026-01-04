/**
 * QuarkDSL VM Test Suite
 * Run with: npx tsx lib/vm/test.ts
 */

import { execute, formatResult } from "./index";

const tests = [
  {
    name: "Simple arithmetic",
    code: `
fn main() -> int {
    let x = 5;
    let y = 3;
    return x + y * 2;
}`,
    expected: 11,
  },
  {
    name: "Array operations",
    code: `
fn main() -> int {
    let arr = [1, 2, 3, 4, 5];
    let sum = 0;
    for i in 0..5 {
        sum = sum + arr[i];
    }
    return sum;
}`,
    expected: 15,
  },
  {
    name: "Function calls",
    code: `
fn add(a: int, b: int) -> int {
    return a + b;
}

fn main() -> int {
    let result = add(10, 20);
    return result;
}`,
    expected: 30,
  },
  {
    name: "Conditionals",
    code: `
fn main() -> int {
    let x = 10;
    if x > 5 {
        return 1;
    } else {
        return 0;
    }
}`,
    expected: 1,
  },
  {
    name: "Quantum Bell state",
    code: `
fn main() -> int {
    h(0);
    cx(0, 1);
    return measure(0);
}`,
    expectedRange: [0, 1],
  },
  {
    name: "Nested loops",
    code: `
fn main() -> int {
    let sum = 0;
    for i in 0..3 {
        for j in 0..3 {
            sum = sum + 1;
        }
    }
    return sum;
}`,
    expected: 9,
  },
];

console.log("QuarkDSL VM Test Suite");
console.log("=".repeat(50));

let passed = 0;
let failed = 0;

for (const test of tests) {
  console.log(`\nTest: ${test.name}`);
  const result = execute(test.code);

  if (!result.success) {
    console.log(`  FAILED: ${result.error}`);
    failed++;
    continue;
  }

  const returnValue = result.returnValue as number;

  if (test.expected !== undefined) {
    if (returnValue === test.expected) {
      console.log(`  PASSED: returned ${returnValue}`);
      passed++;
    } else {
      console.log(`  FAILED: expected ${test.expected}, got ${returnValue}`);
      failed++;
    }
  } else if (test.expectedRange) {
    if (
      returnValue >= test.expectedRange[0] &&
      returnValue <= test.expectedRange[1]
    ) {
      console.log(`  PASSED: returned ${returnValue} (in range)`);
      passed++;
    } else {
      console.log(
        `  FAILED: expected value in range [${test.expectedRange[0]}, ${test.expectedRange[1]}], got ${returnValue}`
      );
      failed++;
    }
  }

  if (result.gateLog && result.gateLog.length > 0) {
    console.log(`  Quantum gates: ${result.gateLog.join(" -> ")}`);
  }
}

console.log("\n" + "=".repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}

