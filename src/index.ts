import type { EventType, } from '@firebase/database-types';

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
  add(ref: Reference | Query, options?: { eventType?: EventType, listenerId?: ListenersIds[number]; }) {
    const listenerId = options?.listenerId;
    const index = this.unsubscribers.push(() => {
      ref.off(options?.eventType);
      if (listenerId)
        delete this.listenersIds[listenerId];
    }) - 1; // - 1 as .push() returns the new length.

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
}