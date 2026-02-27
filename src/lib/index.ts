import {
  arrow as arrowDom,
  autoUpdate as setupAutoUpdate,
  computePosition,
  type AutoUpdateOptions,
  type ClientRectObject,
  type ComputePositionReturn,
  type FloatingElement,
  type Middleware,
  type MiddlewareState,
  type Padding,
  type Placement,
  type ReferenceElement,
  type Strategy,
  type VirtualElement,
} from '@floating-ui/dom'
import type { Attachment } from 'svelte/attachments'

export interface FloatingContentOptions {
  placement?: Placement
  strategy?: Strategy
  middleware?: Array<Middleware | null | undefined | false>
  /**
   * false: disabled
   * true: default autoUpdate options
   * object: custom autoUpdate options
   * @default true
   */
  autoUpdate?: boolean | Partial<AutoUpdateOptions>
  /** Called after each position computation with the full result. */
  onComputed?: (data: ComputePositionReturn) => void
}

export interface FloatingInstance {
  /** Attachment for the reference/trigger element. */
  ref: Attachment
  /** Returns an attachment for the floating content element. */
  content: (options?: FloatingContentOptions) => Attachment
  /** Attachment for the arrow/caret element inside the floating content. */
  arrow: Attachment
  /**
   * Creates a middleware that positions the arrow element captured by the `arrow` attachment.
   * Use in the `middleware` array passed to `content()`.
   */
  arrowMiddleware: (options?: { padding?: Padding }) => Middleware
  /** Set a virtual element as the reference (for non-DOM references). */
  setVirtualReference: (virtualEl: VirtualElement) => void
}

/**
 * Creates a floating UI instance with attachment-based positioning.
 *
 * Returns attachments for the reference element, floating content, and optional arrow,
 * all powered by `@floating-ui/dom`. Positioning updates automatically when reactive
 * values in the attachment arguments change.
 *
 * @example
 * ```svelte
 * <script>
 *   import { createFloating, offset, flip, shift } from 'floating-ui-svelte'
 *
 *   let show = $state(false)
 *   const { ref, content } = createFloating()
 * </script>
 *
 * <button {@attach ref} onclick={() => show = !show}>Toggle</button>
 *
 * {#if show}
 *   <div {@attach content({ placement: 'bottom', middleware: [offset(6), flip(), shift()] })}>
 *     Floating content
 *   </div>
 * {/if}
 * ```
 */
export function createFloating(): FloatingInstance {
  let referenceEl: ReferenceElement | undefined
  let arrowEl: HTMLElement | SVGElement | undefined

  const ref: Attachment = (node: Element) => {
    referenceEl = node
    return () => {
      referenceEl = undefined
    }
  }

  const arrowAttachment: Attachment = (node: Element) => {
    arrowEl = node as HTMLElement | SVGElement
    return () => {
      arrowEl = undefined
    }
  }

  function arrowMiddleware(options?: { padding?: Padding }): Middleware {
    return {
      name: 'arrow',
      options,
      fn(state: MiddlewareState) {
        if (arrowEl) {
          return arrowDom({ element: arrowEl, padding: options?.padding }).fn(
            state,
          )
        }
        return {}
      },
    }
  }

  function setVirtualReference(virtualEl: VirtualElement) {
    referenceEl = virtualEl
  }

  function content(options: FloatingContentOptions = {}): Attachment {
    const {
      placement = 'bottom',
      strategy = 'absolute',
      middleware,
      autoUpdate: autoUpdateOption = true,
      onComputed,
    } = options

    return (node: Element) => {
      const floatingEl = node as FloatingElement
      let destroyed = false
      let cleanupAutoUpdate: (() => void) | undefined

      const update = () => {
        if (destroyed || !referenceEl) return
        computePosition(referenceEl, floatingEl, {
          placement,
          strategy,
          middleware: middleware?.filter(Boolean) as Middleware[] | undefined,
        }).then((result) => {
          if (destroyed) return
          Object.assign(floatingEl.style, {
            position: result.strategy,
            left: `${result.x}px`,
            top: `${result.y}px`,
          })
          onComputed?.(result)
        })
      }

      const init = () => {
        if (destroyed || !referenceEl) return
        update()
        if (autoUpdateOption !== false) {
          cleanupAutoUpdate = setupAutoUpdate(
            referenceEl,
            floatingEl,
            update,
            autoUpdateOption === true ? {} : autoUpdateOption,
          )
        }
      }

      if (referenceEl) {
        init()
      } else {
        // ref may attach later in the same render cycle
        queueMicrotask(init)
      }

      return () => {
        destroyed = true
        cleanupAutoUpdate?.()
      }
    }
  }

  return {
    ref,
    content,
    arrow: arrowAttachment,
    arrowMiddleware,
    setVirtualReference,
  }
}

/** Options for creating a virtual element with static rect values. */
export interface VirtualElementConfig {
  getBoundingClientRect: ClientRectObject
  contextElement?: Element
}

/** A virtual element whose position can be updated (e.g., to follow the cursor). */
export interface MutableVirtualElement extends VirtualElement {
  update: (config: VirtualElementConfig) => void
}

/**
 * Creates a mutable virtual element for use as a floating reference.
 * Pass to `setVirtualReference` on a `FloatingInstance`.
 *
 * @example
 * ```ts
 * const virtual = createVirtualElement({
 *   getBoundingClientRect: { x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 }
 * })
 * const { setVirtualReference, content } = createFloating()
 * setVirtualReference(virtual)
 *
 * document.addEventListener('mousemove', (e) => {
 *   virtual.update({
 *     getBoundingClientRect: {
 *       x: e.clientX, y: e.clientY,
 *       top: e.clientY, left: e.clientX,
 *       bottom: e.clientY, right: e.clientX,
 *       width: 0, height: 0,
 *     }
 *   })
 * })
 * ```
 */
export function createVirtualElement(
  config: VirtualElementConfig,
): MutableVirtualElement {
  let current = config
  return {
    getBoundingClientRect: () => current.getBoundingClientRect,
    get contextElement() {
      return current.contextElement
    },
    update(newConfig: VirtualElementConfig) {
      current = newConfig
    },
  }
}

// Re-export middleware and types from @floating-ui/dom
export {
  arrow,
  autoPlacement,
  autoUpdate,
  computePosition,
  detectOverflow,
  flip,
  hide,
  inline,
  limitShift,
  offset,
  platform,
  shift,
  size,
} from '@floating-ui/dom'

export type {
  AutoUpdateOptions,
  ClientRectObject,
  ComputePositionConfig,
  ComputePositionReturn,
  FloatingElement,
  Middleware,
  MiddlewareData,
  MiddlewareReturn,
  MiddlewareState,
  Padding,
  Placement,
  ReferenceElement,
  Strategy,
  VirtualElement,
} from '@floating-ui/dom'
