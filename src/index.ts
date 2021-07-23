/**
 * As RTDB packages define.
 *
 * Would use @firebase/database-types, but, it requires @firebase/logger.
 * To keep this small package small, defining it here.
*/
type EventType = 'value' | 'child_added' | 'child_changed' | 'child_moved' | 'child_removed';

/** Simple type definition to be cross-platform / cross-package */
type Reference = {
  off: (event?: EventType, callback?: () => any) => any;
  once: (event: EventType, ...rest: any) => Promise<any>;
  [rest: string]: any;
};
// type Query = Reference;

// To easily unsubscribe from Realtime Db listeners.
export class Listeners<ListenersIds extends string[] = []> {

  private defaultWatchFirstLoad;
  constructor(options?: {
    /** Will apply it for all add() */
    watchFirstLoad?: boolean;
  }) {
    this.defaultWatchFirstLoad = options?.watchFirstLoad ?? false;
  }
  private nextInnerId = 0;

  // Converts the listenerId to its innerId
  private listenersIds: { [listenerId: string]: number; } = {};

  private unsubscribers: { [innerId: number]: (() => any); } = {};

  // Points to the firstLoadListener unsubscriber. Execute it if cleaning up out of proper firstLoad execution.
  private watchingFirstLoad: { [innerId: number]: () => void; } = {};



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
  add<T extends (Reference | Reference[])>(ref: T, options?: {
    /* When running a unsubscriber and if no eventType option was passed here,
    * will remove the listener for all events types (ref.off() without args). */
    event?: EventType;
    /** An id string you may set to specifically turn the listener off with unsubscribeById() */
    listenerId?: T extends Reference ? ListenersIds[number] : never;
    /** Will call the onAllFirstLoaded() callback when all the other listeners that
     * also uses this option have first loaded.
     *
     * It uses a once() to listen for the new data. It uses the event option as event. If none entered,
     * will default to `value`. If an error occurs, it will just be ignored for now.
     *
     * Defaults to `false` or the value set in the constructor.
     * */
    watchFirstLoad?: boolean;
  }): void {

    const fun = (ref: Reference) => {

      const innerId = this.nextInnerId;
      // const listenerId = options?.listenerId
      // const watchFirstLoad = options.
      const { listenerId, event, watchFirstLoad = this.defaultWatchFirstLoad } = options || {};

      // The function to unsubscribe this listener.
      // This will also remove the firstLoad listener, as uses the same ref and event.
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
        const firstLoadUnsubscriber = () => ref.off(event, callback);
        const callback = () => {
          this.listenerFirstLoaded(innerId);
          firstLoadUnsubscriber();
        };
        // using .on instead of .once because https://github.com/invertase/react-native-firebase/issues/4865
        ref.on(event ?? 'value', callback);
        this.watchingFirstLoad[innerId] = firstLoadUnsubscriber;
      }

      this.nextInnerId++;
    };
    Array.isArray(ref) ? (ref as Reference[]).forEach(ref => fun(ref)) : fun(ref as Reference);
  }




  unsubscribeFromAll() {
    Object.values(this.unsubscribers).forEach(unsubscriber => unsubscriber());
  }

  private unsubscribeByInnerId(innerId: number) {
    this.unsubscribers[innerId]();
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