/**
 * IndexedDB helper for caching model files
 */
export const cacheDB = {
  dbName: 'MinistralModelCache',
  storeName: 'models',

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  },

  async get(key) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const request = db.transaction([this.storeName]).objectStore(this.storeName).get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  },

  async set(key, value) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const request = db.transaction([this.storeName], 'readwrite').objectStore(this.storeName).put(value, key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  },

  async clear() {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const request = db.transaction([this.storeName], 'readwrite').objectStore(this.storeName).clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }
};
