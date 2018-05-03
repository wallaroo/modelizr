export type IFieldObject<T extends object> = {
  [K in keyof T]?: T[K]
}