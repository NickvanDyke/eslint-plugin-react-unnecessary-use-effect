import { findVariable } from "eslint-utils";
import {
  traverse,
  getDownstreamIdentifiers,
  getUpstreamVariables,
  isFnRef,
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

export const getEffectFnRefs = (context, node) => {
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
export function getDepArrRefs(context, node) {
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
    stateSetterRefs.some((ref) =>
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
