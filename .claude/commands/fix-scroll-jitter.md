---
description: Diagnose and fix UI scroll/layout jitter issues
allowed-tools: Read, Edit, Grep, Glob
---

# Scroll/Layout Jitter Fix Guide

You are helping diagnose and fix UI scroll jitter or layout shift issues, commonly caused by modal dialogs, dropdowns, or scroll locking mechanisms.

## User Request

$ARGUMENTS

## Step 1: Identify the Problem

### Common Symptoms
1. **Page content shifts horizontally** when opening modals/dialogs/dropdowns
2. **Scrollbar appears/disappears** causing layout jump
3. **Elements "dance"** or flicker when UI components open/close
4. **Header/navbar moves** slightly when modal opens

### Likely Culprits
```
Scroll Jitter Sources:
├── Radix UI (Dialog, DropdownMenu, AlertDialog, Sheet)
│   └── Uses react-remove-scroll → adds margin-right to body
├── Headless UI (Dialog, Popover)
│   └── Similar scroll lock mechanism
├── Custom modal implementations
│   └── Manual overflow: hidden on body
└── CSS scrollbar-gutter issues
    └── Browser inconsistencies
```

## Step 2: Search for Existing Fixes

```bash
# Check for scroll-related CSS
grep -n "scroll-lock\|margin-right\|scrollbar-gutter\|data-scroll-locked" src/**/*.css

# Check for Radix/Headless usage
grep -rn "from '@radix-ui\|from 'react-remove-scroll" src/

# Find global CSS files
find src -name "globals.css" -o -name "global.css" -o -name "base.css"
```

## Step 3: Apply the Fix

### The "Less is More" Principle

> **IMPORTANT**: Don't over-engineer the fix. Start with the simplest solution.

### Solution A: Minimal Fix (Try First)

```css
/* In globals.css or your base CSS */
body[data-scroll-locked] {
  margin-right: 0 !important;
  padding-right: 0 !important;
}
```

This works for:
- Radix UI components
- Any library using `data-scroll-locked` attribute

### Solution B: For Headless UI

```css
/* Headless UI uses different attribute */
body[data-headlessui-portal] {
  margin-right: 0 !important;
  padding-right: 0 !important;
}

/* Or target the scroll lock directly */
html.overflow-hidden,
body.overflow-hidden {
  margin-right: 0 !important;
  padding-right: 0 !important;
}
```

### Solution C: Component-Level Fix (Radix)

If CSS doesn't work, configure at component level:

```tsx
// For Radix Dialog
<Dialog.Root modal={false}>
  {/* modal={false} disables scroll lock entirely */}
</Dialog.Root>

// Or use ScrollArea with custom scroll handling
<Dialog.Content onOpenAutoFocus={(e) => e.preventDefault()}>
```

### Solution D: Disable scroll compensation entirely

```tsx
// For react-remove-scroll directly
import { RemoveScroll } from 'react-remove-scroll';

<RemoveScroll removeScrollBar={false}>
  {/* Content */}
</RemoveScroll>
```

## What NOT to Do

### Over-Engineering Examples (Avoid These)

```css
/* ❌ Too many rules */
html {
  scrollbar-gutter: stable;
}

html[data-scroll-locked],
html[style*="margin-right"] {
  margin-right: 0 !important;
}

body[style*="margin-right"] {
  margin-right: 0 !important;
}

body[style*="padding-right"] {
  padding-right: 0 !important;
}

@supports (scrollbar-gutter: stable) {
  /* Even more rules... */
}

/* ❌ Breaks scroll lock functionality */
body[data-scroll-locked] {
  overflow: visible !important;  /* Don't do this */
}
```

### Why Over-Engineering Fails

| Problem | Reason |
|---------|--------|
| Too many selectors | Specificity wars, hard to debug |
| `scrollbar-gutter` | Browser inconsistencies |
| `overflow: visible` | Breaks the scroll lock feature |
| Inline style overrides | Fragile, may break updates |

## Step 4: Verify the Fix

1. Open a modal/dialog
2. Check if page content shifts
3. Check if scrollbar behavior is correct
4. Test on different viewport sizes
5. Test with and without scrollbar visible

## Quick Reference

### Minimal CSS Fix Template

```css
/*
 * Fix scroll jitter from modal/dialog scroll locking
 *
 * Problem: Libraries like Radix UI add margin-right to body
 *          when locking scroll, causing layout shift.
 *
 * Solution: Simply remove the compensation margin/padding.
 *
 * Principle: Less is more. Don't over-engineer.
 */
body[data-scroll-locked] {
  margin-right: 0 !important;
  padding-right: 0 !important;
}
```

### Decision Tree

```
Page jitters when modal opens?
│
├─ Using Radix UI?
│  └─ Add: body[data-scroll-locked] { margin-right: 0 !important; }
│
├─ Using Headless UI?
│  └─ Add: body.overflow-hidden { margin-right: 0 !important; }
│
├─ Custom modal?
│  └─ Check if you're adding margin-right when setting overflow:hidden
│     └─ Remove that compensation logic
│
└─ Still jittering?
   └─ Check if multiple libraries are fighting each other
      └─ Consolidate to one approach
```

## Core Principle

> **The best fix is the smallest fix that works.**
>
> Scroll jitter fixes are notorious for being over-engineered.
> Start with 2-4 lines of CSS. Only add more if absolutely necessary.
> Every additional rule is a potential source of bugs.
