const fs = require('fs/promises');
const path = require('path');

const seedFile = path.join(process.cwd(), 'data', 'seed.json');
const runtimeFile = process.env.DATA_STORE_PATH
  ? path.resolve(process.env.DATA_STORE_PATH)
  : path.join('/tmp', 'mw-recruitment-data.json');

let cachedStore = null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function persist(data) {
  await fs.mkdir(path.dirname(runtimeFile), { recursive: true });
  await fs.writeFile(runtimeFile, JSON.stringify(data, null, 2), 'utf8');
}

async function loadSeed() {
  const rawSeed = await fs.readFile(seedFile, 'utf8');
  return JSON.parse(rawSeed);
}

async function ensureStore() {
  if (cachedStore) {
    return cachedStore;
  }
  try {
    const raw = await fs.readFile(runtimeFile, 'utf8');
    cachedStore = JSON.parse(raw);
    return cachedStore;
  } catch (error) {
    const seed = await loadSeed();
    const snapshot = clone(seed);
    cachedStore = snapshot;
    await persist(snapshot);
    return cachedStore;
  }
}

async function loadData() {
  const store = await ensureStore();
  return clone(store);
}

async function saveData(nextStore) {
  const snapshot = clone(nextStore);
  cachedStore = snapshot;
  await persist(snapshot);
  return clone(snapshot);
}

async function updateData(updater) {
  const store = clone(await ensureStore());
  const result = await updater(store);
  const updatedStore = result || store;
  return saveData(updatedStore);
}

module.exports = {
  loadData,
  saveData,
  updateData,
  runtimeFile
};
