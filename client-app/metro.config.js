const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, '../shared');

const config = getDefaultConfig(projectRoot);

// Permite que Metro acceda a la carpeta compartida.
config.watchFolders = [sharedRoot];

// Permite que los archivos de shared usen las dependencias de client-app.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

// Traduce @shared/... a la ubicación real ../shared/...
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@shared/')) {
    const relativePath = moduleName.replace('@shared/', '');
    const absolutePath = path.resolve(sharedRoot, relativePath);

    return context.resolveRequest(context, absolutePath, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;