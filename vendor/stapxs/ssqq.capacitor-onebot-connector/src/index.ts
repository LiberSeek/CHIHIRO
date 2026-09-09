import { registerPlugin } from '@capacitor/core';

import type { OnebotPlugin } from './definitions';

const Onebot = registerPlugin<OnebotPlugin>('Onebot', {
  web: () => import('./web').then((m) => new m.OnebotWeb()),
});

export * from './definitions';
export { Onebot };
