<p align="center">
  <img src="./svelte-floating-attach.webp" alt="svelte-floating-attach" width="300" />
</p>

<h1 align="center">svelte-floating-attach</h1>

Svelte 5 <a href="https://svelte.dev/docs/svelte/@attach">attachment</a>-based wrapper for <a href="https://floating-ui.com/docs/getting-started"><code>@floating-ui/dom</code></a>. Position floating elements like tooltips, popovers, and dropdowns with automatic reactivity — no <code>$effect</code> or manual <code>update()</code> calls needed.

For middleware options, placement values, and positioning concepts, see the [Floating UI docs](https://floating-ui.com/docs/getting-started).

## Requirements

- Svelte `>=5.29.0` (attachment support)
- `@floating-ui/dom` `>=1.6.0`

## Install

```bash
npm install svelte-floating-attach @floating-ui/dom
```

`@floating-ui/dom` is a **peer dependency**, not bundled into this package. You need to install it alongside to prevent version conflicts.

## Why this library?

This library is heavily inspired by [`svelte-floating-ui`](https://github.com/fedorovvvv/svelte-floating-ui). If you're on ≤ Svelte 5.29 you should use that library instead.

`svelte-floating-attach` requires **≥ Svelte 5.29**. It uses [attachments](https://svelte.dev/docs/svelte/@attach) (`{@attach}`) API. Attachments work better than actions.

### What's different from `svelte-floating-ui`?

|                             | `svelte-floating-attach`                                                            | `svelte-floating-ui`                                                               |
| --------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Reactivity**              | Automatic — attachment re-runs when any `$state` in its arguments changes           | Manual (if using runes) — requires `$effect` + `update()` to sync prop changes     |
| **Arrow/caret positioning** | Automatic — `left`/`top` styles applied to the arrow element after each computation | Manual — you read `middlewareData.arrow` in `onComputed` and apply styles yourself |
| **`@floating-ui/dom`**      | Peer dependency — installed separately, no duplicates                               | Direct dependency — bundled in, may duplicate if you also depend on it directly    |
| **Svelte stores**           | None — plain closures                                                               | Uses `writable` stores for arrow refs and virtual elements                         |
| **Bundle footprint**        | ~5 KB compiled (re-exports from your existing `@floating-ui/dom`)                   | Bundles its own copy of `@floating-ui/dom` into the package                        |

### Automatic reactivity

Actions (`use:`) don't re-run when their arguments change. With `svelte-floating-ui`, you need a manual `$effect` to push updated options:

```svelte
<script>
  import { createFloatingActions } from 'svelte-floating-ui'
  import { flip, offset, shift } from 'svelte-floating-ui/dom'

  let { placement = $bindable('bottom') } = $props()

  const [floatingRef, floatingContent, updatePosition] = createFloatingActions({
    placement,
    middleware: [offset(8), shift(), flip()],
  })

  // Required: manually sync reactive props to the action
  $effect(() => {
    updatePosition({ placement })
  })
</script>

<button use:floatingRef>Trigger</button>
<div use:floatingContent>Content</div>
```

Attachments run in the template's reactive tracking context — when `placement` changes, the attachment tears down and re-runs with the new value. No `$effect`, no `update()`:

```svelte
<script>
  import { createFloating, flip, offset, shift } from 'svelte-floating-attach'

  let { placement = $bindable('bottom') } = $props()

  const { ref, content } = createFloating()
</script>

<button {@attach ref}>Trigger</button>
<div {@attach content({
  placement,
  middleware: [offset(8), shift(), flip()],
})}>
  Content
</div>
```

### Automatic arrow/caret positioning

In `svelte-floating-ui`, you create a writable store for the arrow element and manually apply its computed position inside `onComputed`:

```svelte
<script>
  import { createFloatingActions, arrow } from 'svelte-floating-ui'
  import { createArrowRef } from 'svelte-floating-ui'

  const arrowRef = createArrowRef()

  const [floatingRef, floatingContent] = createFloatingActions({
    middleware: [arrow({ element: arrowRef })],
    onComputed({ placement, middlewareData }) {
      // You must manually read and apply arrow styles
      const { x, y } = middlewareData.arrow
      const staticSide = { top: 'bottom', right: 'left', bottom: 'top', left: 'right' }[
        placement.split('-')[0]
      ]
      Object.assign($arrowRef.style, {
        left: x != null ? `${x}px` : '',
        top: y != null ? `${y}px` : '',
        [staticSide]: '-4px',
      })
    },
  })
</script>

<div use:floatingContent>
  Content
  <div bind:this={$arrowRef} class="arrow"></div>
</div>
```

In `svelte-floating-attach`, this is built in. The library automatically applies `left`/`top` from `middlewareData.arrow` to the arrow element after every computation, and resets stale `right`/`bottom` when placement changes:

```svelte
<script>
  import { createFloating, offset, flip, shift } from 'svelte-floating-attach'

  const { ref, content, arrow, arrowMiddleware } = createFloating()
</script>

<div {@attach content({
  placement: 'top',
  middleware: [offset(8), flip(), shift(), arrowMiddleware({ padding: 4 })],
})}>
  Content
  <div {@attach arrow} class="arrow"></div>
</div>
```

## Usage

### Basic Popover

```svelte
<script>
  import { createFloating, offset, flip, shift } from 'svelte-floating-attach'

  let show = $state(false)
  const { ref, content } = createFloating()
</script>

<button {@attach ref} onclick={() => show = !show}>
  Toggle
</button>

{#if show}
  <div {@attach content({
    placement: 'bottom',
    middleware: [offset(8), flip(), shift()],
  })}>
    Popover content
  </div>
{/if}
```

### Reactive Placement (Component Props)

A complete example showing how placement reacts to prop changes and how `onComputed` keeps the actual placement in sync when Floating UI flips it due to lack of space.

```svelte
<!-- Popover.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { Placement } from 'svelte-floating-attach'
  import { createFloating, offset, flip, shift, hide } from 'svelte-floating-attach'

  interface Props {
    /** Preferred placement — may be overridden by flip() */
    placement?: Placement
    show?: boolean
    children?: Snippet
    content?: Snippet
  }

  let {
    placement = $bindable('bottom'),
    show = $bindable(false),
    children,
    content: contentSnippet,
  }: Props = $props()

  const { ref, content: floatingContent } = createFloating()
</script>

<button {@attach ref} onclick={() => show = !show}>
  {@render children?.()}
</button>

{#if show}
  <div {@attach floatingContent({
    placement,
    middleware: [offset(8), shift(), flip(), hide()],
    onComputed: (data) => (placement = data.placement),
  })}>
    {@render contentSnippet?.()}
  </div>
{/if}
```

When the consumer passes a different `placement` prop, the attachment re-runs automatically — no `$effect` needed. The `onComputed` callback writes back the actual placement so the consumer always knows where the popover ended up (e.g., `'top'` instead of `'bottom'` after a flip).

```svelte
<!-- Consumer.svelte -->
<script>
  import Popover from './Popover.svelte'

  let placement = $state('bottom')
</script>

<select bind:value={placement}>
  <option value="top">Top</option>
  <option value="bottom">Bottom</option>
  <option value="left">Left</option>
  <option value="right">Right</option>
</select>

<Popover bind:placement>
  {#snippet content()}
    Placed at: {placement}
  {/snippet}
  Click me
</Popover>
```

### Tooltip with Arrow

The library automatically applies `left`/`top` from `middlewareData.arrow` to the arrow element, positioning it along the edge to stay centered on the reference. It also resets stale `right`/`bottom` values when placement changes.

```svelte
<script>
  import { createFloating, offset, flip, shift } from 'svelte-floating-attach'

  let show = $state(false)
  const { ref, content, arrow, arrowMiddleware } = createFloating()
</script>

<button
  {@attach ref}
  onmouseenter={() => show = true}
  onmouseleave={() => show = false}
>
  Hover me
</button>

{#if show}
  <div {@attach content({
    placement: 'top',
    middleware: [offset(8), flip(), shift(), arrowMiddleware({ padding: 4 })],
  })}>
    Tooltip text
    <div {@attach arrow} class="arrow"></div>
  </div>
{/if}
```

#### Pushing the arrow onto the edge

The library positions the arrow _along_ the correct edge (centering it on the reference) but does not push it _onto_ the edge itself — that depends on your arrow's size and visual design. Use `onComputed` to offset the arrow so it pokes out of the floating element:

```svelte
<script>
  import { createFloating, offset, flip, shift } from 'svelte-floating-attach'

  let show = $state(false)
  let arrowEl = $state()
  const { ref, content, arrow, arrowMiddleware } = createFloating()

  function onComputed(data) {
    if (!arrowEl) return

    // The side of the floating element that faces the reference:
    //   placement "top"    → arrow sits on "bottom" edge
    //   placement "bottom" → arrow sits on "top" edge
    //   placement "left"   → arrow sits on "right" edge
    //   placement "right"  → arrow sits on "left" edge
    const side = data.placement.split('-')[0]
    const oppositeSide = { top: 'bottom', right: 'left', bottom: 'top', left: 'right' }[side]

    // Nudge the arrow outward so it straddles the edge (half in, half out)
    arrowEl.style[oppositeSide] = `${-arrowEl.offsetWidth / 2}px`
  }
</script>

<button
  {@attach ref}
  onmouseenter={() => show = true}
  onmouseleave={() => show = false}
>
  Hover me
</button>

{#if show}
  <div {@attach content({
    placement: 'top',
    middleware: [offset(8), flip(), shift(), arrowMiddleware({ padding: 4 })],
    onComputed,
  })}>
    Tooltip text
    <div bind:this={arrowEl} {@attach arrow} class="arrow"></div>
  </div>
{/if}

<style>
  .arrow {
    position: absolute;
    width: 10px;
    height: 10px;
    background: inherit;
    transform: rotate(45deg);
  }
</style>
```

Without this offset the arrow stays fully inside the floating element. The offset value controls how much it pokes out — use `-offsetWidth / 2` to center it on the edge, or any other value that fits your design.

### Virtual Element

```svelte
<script>
  import { createFloating, createVirtualElement, offset } from 'svelte-floating-attach'

  const virtual = createVirtualElement({
    getBoundingClientRect: { x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 }
  })

  const { setVirtualReference, content } = createFloating()
  setVirtualReference(virtual)

  let show = $state(false)
</script>

<div
  onmouseenter={() => show = true}
  onmouseleave={() => show = false}
  onmousemove={(e) => {
    virtual.update({
      getBoundingClientRect: {
        x: e.clientX, y: e.clientY,
        top: e.clientY, left: e.clientX,
        bottom: e.clientY, right: e.clientX,
        width: 0, height: 0,
      }
    })
  }}
>
  Hover area
</div>

{#if show}
  <div {@attach content({ strategy: 'fixed', placement: 'right-start', middleware: [offset(16)] })}>
    Following cursor
  </div>
{/if}
```

## API

### `createFloating()`

Creates a floating instance. Returns:

| Property              | Type                           | Description                                                                                                                                   |
| --------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `ref`                 | `Attachment`                   | Attach to the reference/trigger element                                                                                                       |
| `content`             | `(options?) => Attachment`     | Returns an attachment for the floating element                                                                                                |
| `arrow`               | `Attachment`                   | Attach to the arrow/caret element. `left`/`top` styles are applied automatically from `middlewareData.arrow` after each position computation. |
| `arrowMiddleware`     | `(options?) => Middleware`     | Creates arrow middleware using the captured arrow element. Use in the `middleware` array passed to `content()`.                               |
| `setVirtualReference` | `(el: VirtualElement) => void` | Set a virtual element as the reference                                                                                                        |

### `FloatingContentOptions`

Options passed to `content()`. See [Floating UI docs](https://floating-ui.com/docs/computePosition) for details on `placement`, `strategy`, and `middleware`.

| Option       | Type                                                                  | Default      | Description                                                             |
| ------------ | --------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------- |
| `placement`  | [`Placement`](https://floating-ui.com/docs/computePosition#placement) | `'bottom'`   | Where to place the floating element                                     |
| `strategy`   | [`Strategy`](https://floating-ui.com/docs/computePosition#strategy)   | `'absolute'` | CSS positioning strategy                                                |
| `middleware` | [`Middleware[]`](https://floating-ui.com/docs/middleware)             | `undefined`  | Floating UI middleware array                                            |
| `autoUpdate` | `boolean \| AutoUpdateOptions`                                        | `true`       | [Auto-update](https://floating-ui.com/docs/autoUpdate) on scroll/resize |
| `onComputed` | `(data: ComputePositionReturn) => void`                               | `undefined`  | Callback after position computation                                     |

### `createVirtualElement(config)`

Creates a mutable [virtual element](https://floating-ui.com/docs/virtual-elements) for non-DOM references (e.g., cursor position). Call `.update(config)` to change the position.

### Re-exports

All middleware and types from `@floating-ui/dom` are re-exported for convenience, so you only need one import source.

## License

MIT
