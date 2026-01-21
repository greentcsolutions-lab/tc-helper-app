---
name: clean-code-guardian
description: Enforces modern TypeScript + Next.js 14+/15 conventions for clean, safe, maintainable real-estate SaaS code. Use on requests to write new code, implement feature, add component/hook/helper/API route, refactor logic, simplify flow, improve readability. Triggers strongly on: write, implement, add, create, new, feature, component, hook, helper, route, api, handler, refactor, simplify, improve, fix logic, extract, extraction, parse, contract, calendar, google, zod, schema, json, response shape.
---

# Clean Code Guardian – Modern TS + Next.js Conventions

You MUST follow current TypeScript (2026-era) best practices and Next.js patterns when writing new code, implementing features, or refactoring logic/behavior.  
NEVER ignore these rules without explicit user permission ("ignore guardian rules").

## Non-Negotiable TypeScript Rules (2026 standards)
- Enable & respect strict mode (tsconfig: strict: true, noImplicitAny, strictNullChecks, etc.)
- Prefer type inference when clear & safe → explicit types when it improves readability, prevents bugs, or documents intent
- NEVER use 'any' — use 'unknown' for truly dynamic values + narrow with type guards
- Prefer interfaces over type aliases for object shapes (better extensibility & error messages)
- No 'I' prefix or 'Interface' suffix for interfaces — use clean, descriptive names (e.g. User, ContractData)
- Use const assertions ('as const') for literal unions, enums alternatives, config objects
- Avoid wrapper objects (new String(), Number(), Boolean()) — use primitives
- Prefer generics with meaningful names (TData, TError) over single-letter when clarity helps

## Naming & Structure Conventions
- camelCase for variables, functions, hooks
- PascalCase for components, types, interfaces, classes
- UPPER_SNAKE_CASE for constants, env vars
- Files: kebab-case or camelCase (match your project), .ts / .tsx as appropriate
- Small focused units: functions/components ideally ≤ ~40–50 lines — extract helpers/hooks early

## API Routes & Server Code (Next.js)
- Use app router only (/app/api/**/route.ts)
- ALWAYS async/await + try/catch in handlers
- Consistent response shape: { success: boolean, data?: T, error?: string }
- NEVER leak internal errors/stack to client — safe messages only
- Validate inputs with Zod → safeParse() + 400 on failure

## Error Handling
- Explicit & safe: catch errors, log context (not full stack in prod), return user-friendly messages
- Use type guards / narrowing instead of non-null assertions (!) when possible
- Prefer Result/Option patterns (or libraries) over throwing in business logic when practical

## Domain-Specific Invariants (tchelper.app)
### Contract Extraction Output
- ALWAYS structured shape via Zod:
  ```ts
  interface ContractExtract {
    closingDate?: string;           // ISO string
    buyerName?: string;
    sellerName?: string;
    propertyAddress?: string;
    earnestMoney?: string | number;
    contingencies?: string[];
    commissionPercent?: number;
    // ... other core fields
  }

  type ExtractionResult = {
    data: ContractExtract | null;
    confidence: Partial<Record<keyof ContractExtract, 'low' | 'medium' | 'high'>>;
    flags?: string[];               // e.g. "low confidence on date"
  };