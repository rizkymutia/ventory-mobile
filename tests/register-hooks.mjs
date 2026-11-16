/** Node-only shim for expo-file-system. It is NOT bundled into the iOS app. */
import { registerHooks } from 'node:module';
const shim = new URL('./mocks/expo-file-system.mjs', import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'expo-file-system') return { url: shim, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
