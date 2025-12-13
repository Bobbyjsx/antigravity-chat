---
trigger: always_on
---

# shadcn/ui Workspace Rules

## Scope
These rules apply to all frontend UI code, components, and layout generation.

## UI Library
- Use **shadcn/ui** components as the default UI system
- Components must be installed via the shadcn CLI, not reimplemented
- Prefer Radix-based shadcn components over custom HTML

## Styling
- Use **Tailwind CSS**
- No inline styles
- No CSS files unless explicitly required
- Prefer Tailwind utility classes over custom abstractions

## Accessibility
- Preserve Radix accessibility features
- Do not remove `aria-*` attributes
- Use semantic HTML elements

## Component Usage Rules
- Import components from `@/components/ui/*`
- Do not modify generated shadcn components directly
- Extend via composition instead of mutation

## Forms
- Use `react-hook-form` where applicable
- Form validation with zod is a must
- Integrate with shadcn `Form`, `FormField`, `FormItem`
- For features that require a create and update form, 
  If all fields are the same, create one form and share between create an update with form context provider

## Theming
- Respect existing Tailwind theme tokens
- Use CSS variables for color overrides

## Framework Assumptions
- TypeScript only
- React / Next.js App Router unless stated otherwise

## Output Expectations
- Generate production-ready code
- No demo-only shortcuts
- No pseudo-code
