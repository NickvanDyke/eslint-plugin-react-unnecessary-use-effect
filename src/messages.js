export const messageIds = {
  avoidInternalEffect: "avoidInternalEffect",
  avoidDerivedState: "avoidDerivedState",
  avoidInitializingState: "avoidInitializingState",
  avoidChainingState: "avoidChainingState",
  avoidManagingParentBehavior: "avoidManagingParentBehavior",
  avoidPassingStateToParent: "avoidPassingStateToParent",
  avoidResettingStateFromProps: "avoidResettingStateFromProps",
  // TODO: This would be nice, but I'm not sure it can be done accurately
  // Maybe we can accurately warn about this when the state being reacted to is one of our own `useState`s?
  // Because if we have a setter then we have a callback.
  // But, I think that would also warn about valid uses that synchronize internal state to external state.
  // avoidEventHandler: "avoidEventHandler",
};

// TODO: Could include more info in messages, like the relevant node
export const messages = {
  [messageIds.avoidInternalEffect]:
    "This effect operates entirely on internal React state, with no external dependencies. It is likely unnecessary.",
  [messageIds.avoidDerivedState]:
    'Avoid storing derived state. Compute "{{state}}" directly during render, optionally with `useMemo` if it\'s expensive.',
  [messageIds.avoidInitializingState]:
    "Avoid initializing state in an effect. Instead, pass the initial value to `useState`.",
  [messageIds.avoidChainingState]:
    "Avoid chaining state changes. When possible, update all relevant state simultaneously.",
  [messageIds.avoidManagingParentBehavior]:
    "Avoid managing parent behavior. Instead, lift this logic up to the parent component.",
  [messageIds.avoidPassingStateToParent]:
    "Avoid making parent components depend on a child's intermediate state. If the parent needs live updates, consider lifting state up.",
  [messageIds.avoidResettingStateFromProps]:
    "Avoid resetting state from props. If the prop is a key, pass it as `key` instead so React will reset the component.",
  // [messages.avoidEventHandler]:
  //   "Avoid using state as an event handler. Instead, call the event handler directly.",
};
