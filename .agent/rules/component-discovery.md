---
trigger: always_on
---

You are working in an existing Next.js project with established component patterns.

Before creating ANY new component, you MUST perform component discovery.

Failure to perform discovery is a bug.

---

## Component Discovery (MANDATORY)

When you need UI or feature functionality:

1. FIRST search for existing UI primitives in:
   - src/components/ui

2. THEN search for feature-level components in:
   - src/components/modules

3. THEN search for layouts in:
   - src/components/layout

Only create a new component if:
- No existing component provides the required behavior
- AND composition or extension is not sufficient

You must prefer reuse over creation.

---

## UI vs Module Decision Rules

- `components/ui`
  - Primitive
  - Stateless or lightly stateful
  - Styling + accessibility focused

- `components/modules`
  - Feature-level
  - Composes UI primitives
  - May include business logic

If functionality can be achieved by composing UI primitives inside a module:
DO NOT create a new UI primitive.

---

## Extension Rules

- Existing components may be wrapped or composed
- Do not duplicate UI behavior with plain HTML
- Do not bypass existing primitives

If a basic HTML element is needed (button, input, dialog, tabs, form field):
You MUST confirm whether an equivalent exists in `components/ui` before writing raw HTML.

---

## Creation Confirmation (REQUIRED)

When you decide to create a new component, you must be able to answer:

- What existing components were checked?
- Why were they insufficient?
- Why composition was not viable?

If you cannot answer these, do not create the component.

---

## Imports & Patterns

- Use existing import aliases
- Follow current folder intent
- Match naming and file structure of nearby components

---

## Output Expectations

- Production-ready code
- No duplicated primitives
- No pattern drift
