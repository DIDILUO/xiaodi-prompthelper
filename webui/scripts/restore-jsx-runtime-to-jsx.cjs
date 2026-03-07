#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const t = require("@babel/types");
const generate = require("@babel/generator").default;

function isJsxRuntimeCall(node, runtimeAliases) {
  return (
    t.isCallExpression(node) &&
    t.isMemberExpression(node.callee) &&
    t.isIdentifier(node.callee.object) &&
    runtimeAliases.has(node.callee.object.name) &&
    t.isIdentifier(node.callee.property) &&
    (node.callee.property.name === "jsx" || node.callee.property.name === "jsxs")
  );
}

function getObjectKeyName(key) {
  if (t.isIdentifier(key)) return key.name;
  if (t.isStringLiteral(key)) return key.value;
  if (t.isNumericLiteral(key)) return String(key.value);
  return null;
}

function toJsxName(tagArg) {
  if (t.isStringLiteral(tagArg)) return t.jsxIdentifier(tagArg.value);
  if (t.isIdentifier(tagArg)) return t.jsxIdentifier(tagArg.name);
  if (t.isMemberExpression(tagArg)) return toJsxMemberExpression(tagArg);
  return null;
}

function toJsxMemberExpression(member) {
  const objectName = t.isIdentifier(member.object)
    ? t.jsxIdentifier(member.object.name)
    : t.isMemberExpression(member.object)
      ? toJsxMemberExpression(member.object)
      : null;
  const propertyName = t.isIdentifier(member.property)
    ? t.jsxIdentifier(member.property.name)
    : null;
  if (!objectName || !propertyName) return null;
  return t.jsxMemberExpression(objectName, propertyName);
}

function toJsxAttributeName(key) {
  if (t.isIdentifier(key)) return t.jsxIdentifier(key.name);
  if (t.isStringLiteral(key)) return t.jsxIdentifier(key.value);
  if (t.isNumericLiteral(key)) return t.jsxIdentifier(String(key.value));
  return null;
}

function toJsxAttributeValue(valueNode) {
  if (t.isStringLiteral(valueNode)) return t.stringLiteral(valueNode.value);
  if (t.isBooleanLiteral(valueNode) && valueNode.value === true) return null;
  return t.jsxExpressionContainer(valueNode);
}

function toJsxChild(node) {
  if (!node) return null;
  if (t.isNullLiteral(node)) return null;
  if (t.isIdentifier(node, { name: "undefined" })) return null;
  if (t.isBooleanLiteral(node)) return null;
  if (t.isStringLiteral(node)) return t.jsxText(node.value);
  if (t.isJSXElement(node) || t.isJSXFragment(node)) return node;
  return t.jsxExpressionContainer(node);
}

function toJsxChildWithRuntime(node, runtimeAliases) {
  if (!node) return null;
  if (t.isNullLiteral(node)) return null;
  if (t.isIdentifier(node, { name: "undefined" })) return null;
  if (t.isBooleanLiteral(node)) return null;
  if (t.isStringLiteral(node)) return t.jsxText(node.value);
  if (t.isJSXElement(node) || t.isJSXFragment(node)) return node;
  if (isJsxRuntimeCall(node, runtimeAliases))
    return convertRuntimeCall(node, runtimeAliases);
  return t.jsxExpressionContainer(node);
}

function convertChildren(childrenExpr, runtimeAliases) {
  if (!childrenExpr) return [];
  const sourceNodes = t.isArrayExpression(childrenExpr)
    ? childrenExpr.elements.filter(Boolean)
    : [childrenExpr];
  const children = [];
  for (const sourceNode of sourceNodes) {
    const childNode = toJsxChildWithRuntime(sourceNode, runtimeAliases);
    if (childNode) children.push(childNode);
  }
  return children;
}

function convertProps(propsNode) {
  const attributes = [];
  let childrenExpr = null;

  if (!propsNode || t.isNullLiteral(propsNode)) {
    return { attributes, childrenExpr };
  }

  if (!t.isObjectExpression(propsNode)) {
    attributes.push(t.jsxSpreadAttribute(propsNode));
    return { attributes, childrenExpr };
  }

  for (const prop of propsNode.properties) {
    if (t.isSpreadElement(prop)) {
      attributes.push(t.jsxSpreadAttribute(prop.argument));
      continue;
    }
    if (!t.isObjectProperty(prop)) continue;

    const keyName = getObjectKeyName(prop.key);
    if (!prop.computed && keyName === "children") {
      childrenExpr = prop.value;
      continue;
    }

    if (prop.computed) {
      attributes.push(
        t.jsxSpreadAttribute(t.objectExpression([t.objectProperty(prop.key, prop.value, true)]))
      );
      continue;
    }

    const attrName = toJsxAttributeName(prop.key);
    if (!attrName) continue;
    attributes.push(t.jsxAttribute(attrName, toJsxAttributeValue(prop.value)));
  }

  return { attributes, childrenExpr };
}

function isFragmentTag(tagArg, runtimeAliases) {
  return (
    t.isMemberExpression(tagArg) &&
    t.isIdentifier(tagArg.object) &&
    runtimeAliases.has(tagArg.object.name) &&
    t.isIdentifier(tagArg.property, { name: "Fragment" })
  );
}

function convertRuntimeCall(callNode, runtimeAliases) {
  const [tagArg, propsArg] = callNode.arguments;
  const { attributes, childrenExpr } = convertProps(propsArg);
  const children = convertChildren(childrenExpr, runtimeAliases);

  if (isFragmentTag(tagArg, runtimeAliases)) {
    return t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), children);
  }

  const tagName = toJsxName(tagArg);
  if (!tagName) return callNode;

  const selfClosing = children.length === 0;
  const opening = t.jsxOpeningElement(tagName, attributes, selfClosing);
  const closing = selfClosing ? null : t.jsxClosingElement(tagName);
  return t.jsxElement(opening, closing, children, selfClosing);
}

function restoreFileToJsx(filePath) {
  const absolutePath = path.resolve(filePath);
  const sourceCode = fs.readFileSync(absolutePath, "utf8");
  const ast = parser.parse(sourceCode, {
    sourceType: "module",
    plugins: ["jsx"],
    errorRecovery: false
  });

  const runtimeAliases = new Set(["jsxRuntime"]);
  traverse(ast, {
    VariableDeclarator(pathRef) {
      if (!t.isIdentifier(pathRef.node.id)) return;
      if (!t.isIdentifier(pathRef.node.init)) return;
      if (!runtimeAliases.has(pathRef.node.init.name)) return;
      runtimeAliases.add(pathRef.node.id.name);
    }
  });

  traverse(ast, {
    CallExpression(pathRef) {
      if (!isJsxRuntimeCall(pathRef.node, runtimeAliases)) return;
      pathRef.replaceWith(convertRuntimeCall(pathRef.node, runtimeAliases));
    }
  });

  traverse(ast, {
    ImportDeclaration(pathRef) {
      if (pathRef.node.source.value !== "react/jsx-runtime") return;
      pathRef.remove();
    }
  });

  traverse(ast, {
    VariableDeclarator(pathRef) {
      if (!t.isIdentifier(pathRef.node.id)) return;
      const declaratorName = pathRef.node.id.name;
      if (!runtimeAliases.has(declaratorName) || declaratorName === "jsxRuntime")
        return;
      const binding = pathRef.scope.getBinding(declaratorName);
      if (!binding || binding.referencePaths.length > 0) return;
      pathRef.remove();
    }
  });

  const output = generate(ast, {
    jsescOption: { minimal: true },
    retainLines: false,
    compact: false,
    comments: true
  }).code;

  fs.writeFileSync(absolutePath, `${output}\n`, "utf8");
}

function main() {
  const targets = process.argv.slice(2);
  if (targets.length === 0) {
    console.error("Usage: node scripts/restore-jsx-runtime-to-jsx.cjs <file...>");
    process.exit(1);
  }

  for (const target of targets) {
    restoreFileToJsx(target);
    console.log(`restored: ${target}`);
  }
}

main();
