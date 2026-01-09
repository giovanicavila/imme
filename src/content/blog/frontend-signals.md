---
title: "Signals in Frontend: The Reactive Revolution You Didn't Know You Needed"
description: "Why Vue and Angular embraced signals while React said 'nah, we're good'"
publishedAt: 2026-01-09
tags: ["signals", "reactivity", "vue", "angular", "react", "state-management"]
---

## The State of State Management

Let's face it: managing state in frontend applications is like herding cats. You've got data flying around, components updating at random, and somewhere in the middle of it all, you're trying to figure out why your UI is showing last week's data. Sound familiar? Of course it does. You're a frontend developer, after all.

But what if I told you there was a pattern that could make reactive state management feel... natural? A pattern so elegant that Vue and Angular jumped on board without hesitation, while React looked at it and said, "Thanks, but we've got our own thing going"? Welcome to the world of Signals.

## Signals: Reactivity That Just Works

Think of signals as smart variables that know when they've changed and automatically tell everyone who cares. It's like having a gossip network in your code, but instead of spreading rumors, it's spreading truth—and doing it efficiently.

```typescript
// Vue 3 with signals
import { signal, computed, effect } from '@vue/reactivity'

const count = signal(0)
const double = computed(() => count.value * 2)

effect(() => {
  console.log(`Count is ${count.value}, double is ${double.value}`)
})

count.value++ // Automatically logs: "Count is 1, double is 2"
```

Look at that beauty! No hooks, no dependencies array, no mental gymnastics about when something should update. It just... works.

## The Framework Wars: Who's Using What?

Now, before we dive deeper, let's talk about who's doing what in the signal space. Spoiler alert: it's not as simple as "everyone loves signals."

### Angular: The Early Adopter

Angular 16 introduced signals as a first-class citizen, and they went all-in. After years of RxJS complexity (which, let's be honest, scared more developers than it helped), signals were like a breath of fresh air.

```typescript
// Angular signals
import { signal, computed } from '@angular/core'

export class CounterComponent {
  count = signal(0)
  doubleCount = computed(() => this.count() * 2)
  
  increment() {
    this.count.update(value => value + 1)
  }
}
```

```html
<!-- Template automatically updates -->
<p>Count: {{ count() }}</p>
<p>Double: {{ doubleCount() }}</p>
<button (click)="increment()">Increment</button>
```

Angular saw signals as a way to simplify their reactivity model and make zone.js optional. Smart move.

### Vue: The Natural Evolution

Vue 3's reactivity system was already signal-like under the hood with `ref` and `reactive`. They just made it official and more explicit.

```typescript
// Vue 3 composition API (essentially signals)
import { ref, computed, watchEffect } from 'vue'

const count = ref(0)
const double = computed(() => count.value * 2)

watchEffect(() => {
  console.log(`Count changed to ${count.value}`)
})
```

For Vue developers, signals weren't a revolution—they were just making explicit what was already there. It's like finally putting a name to that friend you've known for years.

### React: The Rebel

And then there's React. React looked at signals, shrugged, and said, "We're good with our unidirectional data flow, thanks."

```typescript
// React - no built-in signals
import { useState, useEffect } from 'react'

function Counter() {
  const [count, setCount] = useState(0)
  const double = count * 2
  
  useEffect(() => {
    console.log(`Count changed to ${count}`)
  }, [count])
  
  return (
    <div>
      <p>Count: {count}</p>
      <p>Double: {double}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  )
}
```

But here's the kicker: React's "no signals" stance isn't ignorance—it's intentional. They've built an entire ecosystem around immutable updates and component re-renders. And you know what? It works pretty damn well.

## The Benefits: Why Signals Are Like Magic

So why are Vue and Angular so excited about signals? Let me count the ways:

### 1. Fine-Grained Reactivity

Signals update only what needs to update. No re-rendering entire component trees because one value changed.

```typescript
// Only the specific DOM nodes watching 'count' update
const count = signal(0)
const firstName = signal('John')
const lastName = signal('Doe')

// This only re-runs when firstName or lastName change
const fullName = computed(() => `${firstName.value} ${lastName.value}`)

// Changing count doesn't trigger fullName to recompute
count.value++
```

It's like having a laser instead of a shotgun. Precise, efficient, and satisfying.

### 2. No Dependency Arrays

Remember React's dependency arrays? Those lovely little brackets of doom where you forget one dependency and spend hours debugging?

```typescript
// React - dependency array hell
useEffect(() => {
  fetchData(userId, organizationId, filterType)
}, [userId, organizationId, filterType]) // Don't forget any!
```

With signals, the system automatically tracks dependencies. It's like having a personal assistant who remembers everything for you.

```typescript
// Signals - automatic dependency tracking
effect(() => {
  fetchData(userId.value, organizationId.value, filterType.value)
}) // That's it. No array needed.
```

### 3. Simpler Mental Model

Signals are just values that notify observers. No complex lifecycles, no render phases, no reconciliation. Just pure, beautiful reactivity.

```typescript
const temperature = signal(20)
const isCold = computed(() => temperature.value < 18)
const isHot = computed(() => temperature.value > 25)

effect(() => {
  if (isCold.value) console.log('Bundle up!')
  if (isHot.value) console.log('Stay hydrated!')
})

temperature.value = 30 // Automatically logs "Stay hydrated!"
```

## The Problems: Why React Said "Nope"

But signals aren't all sunshine and rainbows. There are legitimate reasons React avoided them:

### 1. Breaking the Unidirectional Data Flow

React's philosophy is simple: data flows down, events flow up. It's predictable, it's traceable, it's debuggable.

```typescript
// React's predictable flow
function Parent() {
  const [data, setData] = useState(0)
  return <Child data={data} onUpdate={setData} />
}
```

Signals introduce a more "magical" two-way binding that can make data flow harder to trace.

```typescript
// Signals - where did this update come from?
const globalState = signal(0)

// Somewhere in Component A
globalState.value++

// Component B automatically updates
// But good luck finding where that update originated
```

### 2. The Framework Lock-In

Signals often tie you deeply to a framework's reactivity system. React's hooks are portable (ish), but signals? They're part of the framework DNA.

### 3. Learning Curve and Migration Pain

For existing React codebases, adopting signals would mean rewriting everything. And for what? React's model already works. Is it perfect? No. But it's predictable and well-understood.

## React's Philosophy: Freedom Over Magic

Here's where React gets interesting. They didn't adopt signals as a core feature, but they didn't ban them either. Want to use signals in React? Go ahead. There are libraries for that.

```typescript
// Using @preact/signals in React
import { signal, computed } from '@preact/signals-react'

const count = signal(0)
const double = computed(() => count.value * 2)

function Counter() {
  return (
    <div>
      <p>Count: {count}</p>
      <p>Double: {double}</p>
      <button onClick={() => count.value++}>Increment</button>
    </div>
  )
}
```

React's stance is: "We'll give you primitives. You decide how to use them." It's the JavaScript way—flexibility over prescription.

### The Best of Both Worlds

Want fine-grained reactivity in React? Use a signals library like `@preact/signals-react` or `jotai` or `zustand`. Want to stick with hooks? Cool, do that. React doesn't care. It's like a choose-your-own-adventure book, but for state management.

```typescript
// Mix and match as you please
import { signal } from '@preact/signals-react'
import { useState } from 'react'

function MixedComponent() {
  // Signal for fine-grained reactivity
  const globalCounter = signal(0)
  
  // Hook for component-local state
  const [localState, setLocalState] = useState('')
  
  // Use whatever makes sense for your use case
  return (
    <div>
      <p>Global: {globalCounter}</p>
      <input value={localState} onChange={e => setLocalState(e.target.value)} />
    </div>
  )
}
```

## The Verdict: It's All About Trade-offs

So who's right? Vue and Angular with their signal embrace, or React with its signal ambivalence? 

Plot twist: they're both right.

Vue and Angular needed signals because their frameworks benefited from automatic fine-grained reactivity. It made sense for their architectures, their philosophies, and their communities.

React didn't need signals because they already had a mental model that worked. Sure, it has its quirks (hello, dependency arrays), but it's predictable, debuggable, and scales well.

## Choose Your Own Adventure

At the end of the day, signals are just another tool in the frontend developer's toolbox. They're not a silver bullet, and they're not mandatory. They're an option—a damn good one for certain use cases.

If you're working with Vue or Angular, embrace signals. They're baked into the framework now, and they'll make your life easier.

If you're in React land, experiment with signal libraries if you want. Or don't. Stick with hooks. Mix and match. React gives you the freedom to choose, and that freedom is valuable.

The frontend world is big enough for multiple approaches. Signals, hooks, observables, state machines—they all have their place. The trick is knowing when to use what.

So go forth, dear developer. Try signals if you're curious. Stick with what works if you're not. And remember: the best state management solution is the one that helps you ship quality software without losing your mind.

Happy coding, and may your state always be predictable (unless you're using signals, in which case, may it be automatically reactive)!
