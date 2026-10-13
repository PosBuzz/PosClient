import { PluginKind, declareValuePlugin } from '@stryker-mutator/api/plugin';

// Mutants inside log calls (`this.logger.warn(...)`, `logger.log(...)`, `console.error(...)`) change
// only diagnostic text that no test should assert, so they are noise that costs a full test run each.
const LOGGERS = new Set(['logger', 'console']);

function isLoggerObject(node) {
  if (node.type === 'Identifier') return LOGGERS.has(node.name);
  return (
    node.type === 'MemberExpression' &&
    node.object.type === 'ThisExpression' &&
    node.property.type === 'Identifier' &&
    LOGGERS.has(node.property.name)
  );
}

export const strykerPlugins = [
  declareValuePlugin(PluginKind.Ignore, 'logging', {
    shouldIgnore(path) {
      const { node } = path;
      if (
        node.type === 'CallExpression' &&
        node.callee.type === 'MemberExpression' &&
        isLoggerObject(node.callee.object)
      )
        return 'Logging call: diagnostic text only';
      return undefined;
    },
  }),
];
