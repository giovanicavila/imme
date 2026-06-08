---
title: "Shop management"
description: "A pizza shop management application built as a study project to explore modern technologies. Features include pizza order management, a dynamic animated UI, and advanced routing with TanStack Router. Designed to deliver a seamless and engaging user experience while leveraging the latest in web development tools."
url: "https://github.com/giovanicavila/shop"
githubUrl: "https://github.com/giovanicavila/shop"
image: "/images/pizzashop.png"
featured: true
techs: ["React", "TypeScript", "TanStack Query", "TailwindCSS", "TanStack Router", "Shadcn", "animation-ui"]
---

## Overview

A pizza shop management application built as a study project to explore modern web technologies. It simulates a real-world point-of-sale and order management system with a focus on UI/UX, developer experience, and modern React patterns.

### Key Features

- **Order Management:** Create, update, and track pizza orders with real-time status updates
- **Dynamic Animated UI:** Smooth transitions, micro-interactions, and a polished visual experience using custom animations
- **Advanced Routing:** Client-side routing with TanStack Router, including nested layouts, route guards, and typed routes
- **Data Fetching:** Server state management via TanStack Query with optimistic updates and cache invalidation
- **Responsive Design:** Fully responsive layout built with TailwindCSS, optimized for both desktop and mobile

---

## Technology Stack

| Technology | Purpose |
|-----------|---------|
| React | UI framework |
| TypeScript | Type safety |
| TanStack Router | Client-side routing |
| TanStack Query | Server state & caching |
| TailwindCSS | Styling |
| Shadcn | UI primitives |
| Vite | Build tool |

---

## Why TanStack Router Instead of React Router DOM

React Router DOM v7+ has shifted toward a **framework-mode** architecture (similar to Next.js), requiring route definitions to be colocated with components and tied to a specific project structure. For a client-side SPA that doesn't need SSR, this added complexity without benefit.

**TanStack Router** was chosen for several reasons:

- **True client-side routing:** Works entirely in the browser without server dependencies
- **Type-safe routes:** Full TypeScript inference for route params, search params, and link props — no more runtime errors from mistyped URLs
- **Nested layouts:** First-class support for layout routes that persist across navigation
- **Route guards:** Built-in `beforeLoad` and `onError` hooks for auth checks and error boundaries
- **Devtools:** Integrated devtools for inspecting route tree, matches, and cache state
- **File-based or code-based:** Flexible enough to use either approach without locking into a framework

The decision reflects a core principle: **use the right tool for the architecture** — React Router DOM is excellent for framework-driven apps, but TanStack Router is superior for a pure client-side SPA.

---

## Architecture

The app follows a feature-based structure with clear separation of concerns:

```
src/
├── routes/           ← TanStack Router route tree + layout definitions
│   ├── __root.tsx    ← Root layout with navigation
│   ├── index.tsx     ← Dashboard route
│   ├── orders/
│   │   ├── index.tsx ← Orders list
│   │   └── $id.tsx   ← Order detail
│   └── menu/
│       └── index.tsx ← Menu management
├── components/       ← Shared UI components
├── hooks/            ← Custom React hooks
├── queries/          ← TanStack Query definitions
├── stores/           ← Zustand stores for local state
└── types/            ← Shared TypeScript types
```

### Data Flow

```
User Action
    │
    ▼
TanStack Router (route match + params)
    │
    ▼
Component renders → TanStack Query (GET/POST)
    │                    │
    │                    ▼
    │              API Server
    │                    │
    └────────────────────┘
           ▼
    Cache update → UI re-render (optimistic)
```

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| TanStack Router over React Router DOM | True SPA routing without framework lock-in; type-safe routes; better DX for client-only apps |
| TanStack Query over Redux/Apollo | Optimistic updates, cache invalidation, and request deduplication built-in |
| TailwindCSS over CSS Modules | Faster iteration with utility classes; consistent design tokens |
| Shadcn over full component library | Copy-pasteable primitives with full customization — no abstraction debt |
| Zustand for local state | Minimal boilerplate compared to Redux; works outside React components |
