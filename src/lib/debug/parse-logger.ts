// src/lib/debug/parse-logger.ts
// Version: 1.0.0 - 2025-12-24
// Structured debug logging for parse processing — keeps route clean

export function logDataShape(label: string, data: any, maxDepth = 2) {
  console.log(`\n┌─────────────────────────────────────────────────────────────`);
  console.log(`│ 📊 DATA SHAPE: ${label}`);
  console.log(`├─────────────────────────────────────────────────────────────`);

  if (data === null) {
    console.log(`│ Value: null`);
  } else if (data === undefined) {
    console.log(`│ Value: undefined`);
  } else if (Array.isArray(data)) {
    console.log(`│ Type: Array`);
    console.log(`│ Length: ${data.length}`);
    if (data.length > 0) {
      console.log(`│ First item type: ${typeof data[0]}`);
      console.log(`│ First item shape:`, JSON.stringify(data[0], null, 2).substring(0, 200));
    }
  } else if (typeof data === 'object') {
    console.log(`│ Type: Object`);
    console.log(`│ Keys: [${Object.keys(data).join(', ')}]`);
    Object.entries(data).forEach(([key, value]) => {
      const valueType = Array.isArray(value) ? `Array(${value.length})` : typeof value;
      console.log(`│   - ${key}: ${valueType}`);
    });
  } else {
    console.log(`│ Type: ${typeof data}`);
    console.log(`│ Value: ${String(data).substring(0, 100)}`);
  }

  console.log(`└─────────────────────────────────────────────────────────────\n`);
}

export function logStep(step: string, message: string) {
  console.log(`\n[${step}] ${message}`);
}

export function logSuccess(step: string, details?: string) {
  console.log(`[${step}] ✅ ${details || 'Success'}`);
}

export function logError(step: string, message: string) {
  console.error(`[${step}] ❌ ${message}`);
}