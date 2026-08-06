const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');
const sharedRoot = path.resolve(workspaceRoot, 'shared');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

function findSharedFile(basePath, platform) {
  const candidates = [
    platform && `${basePath}.${platform}.ts`,
    platform && `${basePath}.${platform}.tsx`,
    `${basePath}.native.ts`,
    `${basePath}.native.tsx`,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    `${basePath}.json`,
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.tsx'),
    path.join(basePath, 'index.js'),
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate));
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@shared/')) {
    const relativePath = moduleName.replace('@shared/', '');
    const basePath = path.resolve(sharedRoot, relativePath);
    const filePath = findSharedFile(basePath, platform);

    if (!filePath) {
      throw new Error(`No se encontró el archivo compartido: ${basePath}`);
    }

    return {
      type: 'sourceFile',
      filePath,
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;