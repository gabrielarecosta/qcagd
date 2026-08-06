const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');
const sharedRoot = path.resolve(workspaceRoot, 'shared');

const config = getDefaultConfig(projectRoot);

// Hace visible todo el repositorio a Metro, incluida la carpeta shared.
config.watchFolders = [workspaceRoot];

// Permite resolver dependencias tanto desde client-app como desde la raíz.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Traduce @shared/... a QUIMICA/shared/...
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@shared/')) {
    const relativePath = moduleName.replace('@shared/', '');
    const absolutePath = path.resolve(sharedRoot, relativePath);

    return context.resolveRequest(context, absolutePath, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;