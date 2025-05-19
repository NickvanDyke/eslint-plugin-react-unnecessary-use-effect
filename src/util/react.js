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

  return getRefs(context.sourceCode.getScope(effectFn));
};

// Dependency array doesn't have its own scope, so collecting refs is trickier
// NOTE: Despite different implementation from `getEffectBodyRefs`,
// I believe it behaves the same due to filtering by `findVariable`.
// TODO: Share implementation though?
// Basically use this impl for both, instead of scope.references for other?
export function getDependencyRefs(context, node) {
  if (!isUseEffect(node) || node.arguments.length < 2) {
    return null;
  }

  const depsArr = node.arguments[1];
  if (depsArr.type !== "ArrayExpression") {
    return null;
  }

  const identifiers = getDownstreamIdentifiers(context, depsArr);

  const scope = context.sourceCode.getScope(node);
  return identifiers
    .map((node) => [node, findVariable(scope, node)])
    .filter(([_node, variable]) => variable)
    .flatMap(([node, variable]) =>
      variable.references.filter((ref) => ref.identifier === node),
    );
}

export const isFnRef = (ref) =>
  ref.identifier.parent.type === "CallExpression" &&
  // ref.identifier.parent will also be CallExpression when the ref is a direct argument, which we don't want
  ref.identifier.parent.callee === ref.identifier;

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

export const getUseStateNode = (context, stateRef) => {
  return getUpstreamVariables(context, stateRef.identifier)
    .find((variable) =>
      // WARNING: Global variables (like `JSON` in `JSON.stringify()`) have an empty `defs`; fortunately `[].some() === false`.
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
