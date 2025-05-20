import { messageIds, messages } from "./messages.js";
import { getUpstreamVariables } from "./util/ast.js";
import {
  isFnRef,
  isPropRef,
  isPropsUsedToResetAllState,
  isStateRef,
  isUseEffect,
  getEffectBodyRefs,
  getDependencyRefs,
  getUseStateNode,
  getCallExpr,
} from "./util/react.js";

export const name = "you-might-not-need-an-effect";

// TODO: Include `useLayoutEffect`?
// TODO: Possible to detect when `useSyncExternalStore` should be preferred?

export const rule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Catch unnecessary React useEffect hooks.",
      url: "https://react.dev/learn/you-might-not-need-an-effect",
    },
    schema: [],
    messages: messages,
  },
  create: (context) => ({
    CallExpression: (node) => {
      if (!isUseEffect(node)) {
        return;
      }

      const effectFnRefs = getEffectBodyRefs(context, node);
      const depsRefs = getDependencyRefs(context, node);

      if (!effectFnRefs || !depsRefs || effectFnRefs.length === 0) {
        return;
      }

      const isInternalEffect = effectFnRefs
        // Only functions because they actually have effects.
        // Notably this also filters out refs that are local parameters, like `items` in `list.filter((item) => ...)`.
        .filter((ref) => isFnRef(ref))
        .concat(depsRefs)
        .every((ref) => isStateRef(context, ref) || isPropRef(context, ref));

      if (isInternalEffect) {
        context.report({
          node,
          messageId: messageIds.avoidInternalEffect,
        });
      }

      if (isPropsUsedToResetAllState(context, effectFnRefs, depsRefs, node)) {
        context.report({
          node: node,
          messageId: messageIds.avoidResettingStateFromProps,
        });
      }

      effectFnRefs
        // Analyze only state setters and prop callbacks
        .filter(
          (ref) =>
            isFnRef(ref) &&
            (isStateRef(context, ref) || isPropRef(context, ref)),
        )
        .forEach((ref) => {
          const callExpr = getCallExpr(ref);
          const isDepInArgs = callExpr.arguments.some((arg) =>
            getUpstreamVariables(context, arg).some((variable) =>
              depsRefs.some(
                (depRef) => depRef.identifier.name === variable.name,
              ),
            ),
          );

          if (isInternalEffect) {
            if (isStateRef(context, ref)) {
              const useStateNode = getUseStateNode(context, ref);
              // TODO: Should be: Either this is the only call to the state setter, or the args are all internal (including intermediates).
              // Needs to be outside `isInternalEffect` check for the former.
              // Does it matter whether the args are in the deps array?
              // I guess so, to differentiate between derived and chain state updates?
              if (isDepInArgs) {
                context.report({
                  node: callExpr,
                  messageId: messageIds.avoidDerivedState,
                  data: { state: useStateNode.id.elements[0].name },
                });
              } else if (
                depsRefs.some(
                  (ref) => isStateRef(context, ref) || isPropRef(context, ref),
                )
              ) {
                // TODO: Is this a correct assumption by now?
                // Should I flag this whenever the call expr argument is *only* the state?
                // Like this seems more appropriate than "derived" state.
                context.report({
                  node: callExpr,
                  messageId: messageIds.avoidChainingState,
                });
              } else {
                context.report({
                  node: callExpr,
                  messageId: messageIds.avoidInitializingState,
                });
              }
            }
          }

          // I'm pretty sure we can flag this regardless of the arguments, including none...
          //
          // Because we are either:
          // 1. Passing live state updates to the parent
          // 2. Using state as an event handler to pass final state to the parent
          //
          // Both are bad. However I'm not yet sure how we could differentiate #2 to give a better warning.
          //
          // TODO: Can we thus safely assume that state is used as an event handler when the ref is a prop?
          // Normally we can't warn about that because we don't know what the event handler does externally.
          // But when it's a prop, it's internal.
          // I guess it could still be valid when the dep is external state? Or in that case,
          // the issue is the state should be lifted to the parent?
          if (isPropRef(context, ref)) {
            context.report({
              node: callExpr,
              messageId: messageIds.avoidParentChildCoupling,
            });
          }
        });
    },
  }),
};
