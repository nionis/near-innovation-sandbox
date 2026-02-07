import platform from '@/platform'

export default class BaseStorage {
  constructor() {}

  public getStorageType() {
    return platform.getStorageType()
  }

  public async setItem<T>(key: string, value: T): Promise<void> {
    return this.setItemNow(key, value)
  }

  public async setItemNow<T>(key: string, value: T): Promise<void> {
    return platform.setStoreValue(key, value)
  }

  // getItem 需要保证如果数据不存在，返回默认值的同时，也要将默认值写入存储
  public async getItem<T>(key: string, initialValue: T): Promise<T> {
    let value: any = await platform.getStoreValue(key)
    if (value === undefined || value === null) {
      value = initialValue
      this.setItemNow(key, value)
    }
    return value
  }

  public async removeItem(key: string): Promise<void> {
    return platform.delStoreValue(key)
  }

  public async getAll(): Promise<{ [key: string]: any }> {
    return platform.getAllStoreValues()
  }

  public async setAll(data: { [key: string]: any }) {
    return platform.setAllStoreValues(data)
  }

  // TODO: 这些数据也应该实现数据导出与导入
  public async setBlob(key: string, value: string) {
    return platform.setStoreBlob(key, value)
  }
  public async getBlob(key: string): Promise<string | null> {
    return platform.getStoreBlob(key)
  }
  public async delBlob(key: string) {
    return platform.delStoreBlob(key)
  }
  public async getBlobKeys(): Promise<string[]> {
    return platform.listStoreBlobKeys()
  }
  // subscribe(key: string, callback: any, initialValue: any): Promise<void>
}
