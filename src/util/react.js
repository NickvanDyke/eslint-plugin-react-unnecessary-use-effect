import { findVariable } from "eslint-utils";
import {
  traverse,
  getDownstreamIdentifiers,
  getUpstreamVariables,
} from "./ast.js";

export const isReactFunctionalComponent = (node) =>
  (node.type === "FunctionDeclaration" ||
    (node.type === "VariableDeclarator" &&
      node.init.type === "ArrowFunctionExpression")) &&
  node.id.type === "Identifier" &&
  node.id.name[0].toUpperCase() === node.id.name[0];

export const isUseState = (node) =>
  node.init &&
  node.init.type === "CallExpression" &&
  node.init.callee.name === "useState" &&
  node.id.type === "ArrayPattern" &&
  node.id.elements.length === 2 &&
  node.id.elements.every((el) => el.type === "Identifier");

export const isUseEffect = (node) =>
  (node.type === "CallExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "useEffect") ||
  (node.callee.type === "MemberExpression" &&
    node.callee.object.name === "React" &&
    node.callee.property.name === "useEffect");

export const getEffectFn = (node) => {
  if (!isUseEffect(node) || node.arguments.length < 1) {
    return null;
  }

  const effectFn = node.arguments[0];
  if (
    effectFn.type !== "ArrowFunctionExpression" &&
    effectFn.type !== "FunctionExpression"
  ) {
    return null;
  }

  return effectFn;
};

// NOTE: When `MemberExpression` (even nested ones), a `Reference` is only the root object, not the function.
// TODO: And what about e.g. we have a .filter((param) => ...)?
export const getEffectBodyRefs = (context, node) => {
  if (!isUseEffect(node) || node.arguments.length < 1) {
    return null;
  }

  const effectFn = getEffectFn(node);
  if (!effectFn) {
    return null;
  }

  const getRefs = (scope) =>
    scope.references.concat(
      scope.childScopes.flatMap((childScope) => getRefs(childScope)),
    );
  // .filter(
  //   (ref) =>
  //     isPropRef(context, ref) ||
  //     // Filters out e.g. `element` in `list.filter((element) => ...)`.
  //     // As well as arguments inside functions declared inside the effect. Which I guess is fine?
  //     // AND it seems, when set as `def.type === 'Variable'` references to the functions themselves declared inside the effect?
  //     // They have `def.type` === 'Function' or something apparently.
  //     // TODO: Is there a more narrow way to filter out the first one? Seems prone to false positives.
  //     // TODO: May be better to do that filtering outside of this more general function.
  //     // This is an issue because the results of this function are used directly for isInternalEffect.
  //     // Maybe we should just apply the isFnRef before that too? Seems appropriate.
  //     // NOTE: `ref.resolved` is undefined for global variables, e.g. `console` in `console.log()`
  //     (ref.resolved?.defs ?? []).every((def) => def.type !== "Parameter"),
  // );

  return getRefs(context.sourceCode.getScope(effectFn));
};

// Dependency array doesn't have its own scope, so collecting refs is trickier
// NOTE: Despite different implementation from `getEffectBodyRefs`,
// I believe it behaves the same due to filtering by `findVariable`.
// TODO: Share implementation though?
// Basically use this impl for both, instead of scope.references for other?
// Hmm maybe not; not traversing CallExpr.arguments could be a problem for that use.
// e.g. when a prop is passed to a state setter.
// Or maybe that's fine? We'll still analyze the state setter, where we then explicitly check its arguments.
export function getDependencyRefs(context, node) {
  if (!isUseEffect(node) || node.arguments.length < 2) {
    return null;
  }

  const depsArr = node.arguments[1];
  if (depsArr.type !== "ArrayExpression") {
    return null;
  }

  return getDownstreamIdentifiers(context, depsArr)
    .map((node) => [
      node,
      findVariable(context.sourceCode.getScope(node), node),
    ])
    .filter(([_node, variable]) => variable)
    .flatMap(([node, variable]) =>
      // TODO: Is the filter necessary?
      variable.references.filter((ref) => ref.identifier === node),
    );
}

export const isFnRef = (ref) => getCallExpr(ref) !== undefined;

export const isStateRef = (context, ref) =>
  getUseStateNode(context, ref) !== undefined;

export const isPropRef = (context, ref) =>
  getUpstreamVariables(context, ref.identifier).some((variable) =>
    variable.defs.some(
      (def) =>
        def.type === "Parameter" &&
        isReactFunctionalComponent(
          def.node.type === "ArrowFunctionExpression"
            ? def.node.parent
            : def.node,
        ),
    ),
  );

export const getCallExpr = (ref, current = ref.identifier.parent) => {
  if (current.type === "CallExpression") {
    // We've reached the top - confirm that the ref is the (eventual) callee, as opposed to an argument.
    let node = ref.identifier;
    while (node.parent.type === "MemberExpression") {
      node = node.parent;
    }

    if (current.callee === node) {
      return current;
    }
  }

  if (current.type === "MemberExpression") {
    return getCallExpr(ref, current.parent);
  }

  return undefined;
};

export const getUseStateNode = (context, ref) => {
  return getUpstreamVariables(context, ref.identifier)
    .find((variable) =>
      // NOTE: Global variables (like `JSON` in `JSON.stringify()`) have an empty `defs`; fortunately `[].some() === false`.
      // Also, I'm not sure so far when `defs.length > 1`... haven't seen it with shadowed variables or even redeclared variables with `var`.
      variable.defs.some(
        (def) => def.type === "Variable" && isUseState(def.node),
      ),
    )
    ?.defs.find((def) => def.type === "Variable" && isUseState(def.node))?.node;
};

export const isPropsUsedToResetAllState = (
  context,
  effectFnRefs,
  depsRefs,
  useEffectNode,
) => {
  const stateSetterRefs = effectFnRefs
    .filter((ref) => isFnRef(ref))
    .filter((ref) => isStateRef(context, ref));

  return (
    depsRefs.some((ref) => isPropRef(context, ref)) &&
    stateSetterRefs.length > 0 &&
    stateSetterRefs.every((ref) =>
      isStateSetterCalledWithDefaultValue(context, ref),
    ) &&
    stateSetterRefs.length ===
      countUseStates(context, useEffectNode.parent.parent)
  );
};

const isStateSetterCalledWithDefaultValue = (context, setterRef) => {
  const callExpr = setterRef.identifier.parent;
  const useStateDefaultValue = getUseStateNode(context, setterRef).init
    .arguments?.[0];
  return (
    context.sourceCode.getText(callExpr.arguments[0]) ===
    context.sourceCode.getText(useStateDefaultValue)
  );
};

const countUseStates = (context, componentNode) => {
  let count = 0;

  traverse(context, componentNode, (node) => {
    if (isUseState(node)) {
      count++;
    }
  });

  return count;
};
