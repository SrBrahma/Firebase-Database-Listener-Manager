

/**
 * As RTDB packages define.
 *
 * Would use @firebase/database-types, but, it requires @firebase/logger.
 * To keep this small package small, defining it here.
*/
type EventType = "value" | "child_added" | "child_changed" | "child_moved" | "child_removed";

/** Simple type definition to be cross-platform / cross-package */
type Reference = {
  off: (event?: EventType) => any;
  [rest: string]: any;
};
type Query = Reference;

// To easily unsubscribe from Realtime Db listeners.
export class Listeners<ListenersIds extends string[] = []> {
  private unsubscribers: (() => any)[] = [];
  private listenersIds: { [listenerId: string]: number | undefined; } = {};

  /**
   * If no eventType passed, will remove the listener for all events types (ref.off() without args).
   *
   * Returns the index of the added listener.
   *
   * Defaults to undefined.
   */
  add(ref: Reference | Query, options?: { event?: EventType, id?: ListenersIds[number]; }) {
    const listenerId = options?.id;
    const fun = () => {
      ref.off(options?.event);
      if (listenerId)
        delete this.listenersIds[listenerId];
    };
    const index = this.unsubscribers.push(fun) - 1; // - 1 as .push() returns the new length.

    if (listenerId)
      this.listenersIds[listenerId] = index;

    return index;
  }

  unsubscribeFromAll() {
    this.unsubscribers.forEach(unsubscriber => unsubscriber());
    this.unsubscribers = [];
  }

  /** Do nothing if index is invalid. */
  unsubscribeByIndex(index: number | undefined) {
    if (index && this.unsubscribers[index]) {
      this.unsubscribers[index]();
      this.unsubscribers.splice(index, 1);
    }
  }

  /** Do nothing if id is invalid. */
  unsubscribeById(listenerId: ListenersIds[number]) {
    const index = this.listenersIds[listenerId];
    if (index !== undefined)
      this.unsubscribeByIndex(index);
  }

  /** Return is the given listenerId is active
   * @return boolean
   */
  isListenerActive(listenerId: ListenersIds[number]): boolean {
    return !!this.listenersIds[listenerId];
  }
}