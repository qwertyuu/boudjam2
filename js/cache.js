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
  },

  async getAll() {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const request = db.transaction([this.storeName]).objectStore(this.storeName).getAllKeys();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  },

  async getCacheInfo() {
    try {
      const timestamp = await this.get('model_loaded_timestamp');
      const modelId = await this.get('model_id');

      if (!timestamp || !modelId) {
        return null;
      }

      const cacheDate = new Date(timestamp);
      const daysSince = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));

      return {
        modelId,
        timestamp,
        cacheDate: cacheDate.toLocaleString(),
        daysSince,
        isActive: true,
      };
    } catch (error) {
      console.warn('Error getting cache info:', error);
      return null;
    }
  },

  async clearModelCache() {
    try {
      await this.clear();
      console.log('✓ Model cache cleared successfully');
      console.log('ℹ The model will be re-downloaded on next load');
      return true;
    } catch (error) {
      console.error('Error clearing cache:', error);
      return false;
    }
  }
};
