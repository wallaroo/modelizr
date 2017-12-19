export type Constructor<T> = new(...x: any[]) => T;

export type Class<T> = Constructor<T> & {
    prototype: T;
}