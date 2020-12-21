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
  once: (event?: EventType, ...rest: any) => Promise<any>;
  [rest: string]: any;
};
type Query = Reference;

// To easily unsubscribe from Realtime Db listeners.
export class Listeners<ListenersIds extends string[] = []> {
  private nextInnerId = 0;

  // Converts the listenerId to its innerId
  private listenersIds: { [listenerId: string]: number; } = {};

  private unsubscribers: { [innerId: number]: (() => any); } = {};

  // points to the respective promise, but won't do anything with it for now.
  private watchingFirstLoad: { [innerId: number]: Promise<any>; } = {};

  private unsubscribeByInnerId(innerId: number) {
    this.unsubscribers[innerId]();
  }

  /** The external callback to be called when all watchedFirstLoad listeners are done */
  private onAllFirstLoadedCb: (() => void) | null = null;

  private checkLoadingAndTriggerCb() {
    if (Object.keys(this.watchingFirstLoad).length === 0)
      this.onAllFirstLoadedCb?.();
  }

  private listenerFirstLoaded(innerId: number) {
    delete this.watchingFirstLoad[innerId];
    this.checkLoadingAndTriggerCb();
  }


  /** After you set all your listeners with the watchFirstLoad option in add(),
   * call this function with your callback to be called when your watched listeners are
   * loaded for the first time.
   *
   * If they are already loaded when this function is called or if no watched listener was added,
   * this will trigger the cb immediately.
   */
  onAllFirstLoaded(cb: () => void) {
    this.onAllFirstLoadedCb = () => {
      this.onAllFirstLoadedCb = null;
      cb();
    };
    this.checkLoadingAndTriggerCb();
  }


  /**
   * Adds a listener which can be later smartly unsubscribed.
   */
  add(ref: Reference | Query, options?: {
    /* When running a unsubscriber and if no eventType option was passed here,
    * will remove the listener for all events types (ref.off() without args). */
    event?: EventType,
    /** An id string you may set to specifically turn the listener off with unsubscribeById() */
    listenerId?: ListenersIds[number];
    /** Defaults to false */
    watchFirstLoad?: boolean;
  }): void {
    const innerId = this.nextInnerId;
    // const listenerId = options?.listenerId
    // const watchFirstLoad = options.
    const { listenerId, event, watchFirstLoad } = options || {};

    // The function to unsubscribe this listener.
    const unsubscriber = () => {
      ref.off(event);
      if (listenerId)
        delete this.listenersIds[listenerId];
      if (watchFirstLoad)
        delete this.watchingFirstLoad[innerId]; // It may already not exist anymore
    };

    this.unsubscribers[innerId] = unsubscriber;

    if (listenerId)
      this.listenersIds[listenerId] = innerId;

    if (watchFirstLoad) {
      this.watchingFirstLoad[innerId] =
        ref.once(event).then(() => this.listenerFirstLoaded(innerId));

    }

    this.nextInnerId++;
  }


  unsubscribeFromAll() {
    Object.values(this.unsubscribers).forEach(unsubscriber => unsubscriber());
  }

  /** Do nothing if id is invalid. */
  unsubscribeByListenerId(listenerId: ListenersIds[number]) {
    const innerId = this.listenersIds[listenerId] as number | undefined;
    if (innerId)
      this.unsubscribeByInnerId(innerId);
  }

  /** Given the listenerId, returns if its listener is active */
  isListenerActive(listenerId: ListenersIds[number]): boolean {
    return !!this.listenersIds[listenerId];
  }
}