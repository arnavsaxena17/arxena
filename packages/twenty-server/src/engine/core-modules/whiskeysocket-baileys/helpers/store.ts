import makeInMemoryStore, { AuthenticationState } from 'baileys';
import MAIN_LOGGER from 'baileys/lib/Utils/logger';

const logger = MAIN_LOGGER.child({});
logger.level = 'trace';

type Store = ReturnType<typeof makeInMemoryStore>;

export const makeStore = (): Store => {
  const store = makeInMemoryStore({ 
    logger,
    auth: {
      creds: {} as AuthenticationState['creds'],
      keys: {
        get: async (type, ids) => {
          const data: { [_: string]: any } = {};
          await Promise.all(
            ids.map(async (id) => {
              logger.trace(`got key ${type}:${id} from store`);
              data[id] = {}; // Initialize with empty object since we don't have actual storage
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks = Object.entries(data).map(([id]) => {
            logger.trace(`stored key ${id} in store`);
          });
          await Promise.all(tasks);
        }
      }
    }
  });
  return store;
};
