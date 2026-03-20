import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

const virtualModuleId = 'virtual:admin-theme-presets';
const resolvedVirtualModuleId = `\0${virtualModuleId}`;
const presetsDir = path.resolve(__dirname, '../src/themes/presets');

const readPresets = () => fs.readdirSync(presetsDir)
  .filter((file) => file.endsWith('.json'))
  .map((file) => {
    const fullPath = path.join(presetsDir, file);
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  })
  .sort((left, right) => String(left.label).localeCompare(String(right.label), 'zh-CN'));

export const themePresetsPlugin = (): Plugin => ({
  name: 'rbac-theme-presets',
  resolveId(id) {
    if (id === virtualModuleId) {
      return resolvedVirtualModuleId;
    }
    return null;
  },
  load(id) {
    if (id !== resolvedVirtualModuleId) {
      return null;
    }

    return `export default ${JSON.stringify(readPresets(), null, 2)};`;
  },
  handleHotUpdate(ctx) {
    if (!ctx.file.startsWith(presetsDir) || !ctx.file.endsWith('.json')) {
      return;
    }

    const module = ctx.server.moduleGraph.getModuleById(resolvedVirtualModuleId);
    if (module) {
      ctx.server.moduleGraph.invalidateModule(module);
    }
    ctx.server.ws.send({ type: 'full-reload' });
  },
});
