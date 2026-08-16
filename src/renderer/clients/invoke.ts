export const invoke = <T>(channel: string, ...args: unknown[]): Promise<T> =>
  window.electron.invoke(channel, ...args) as Promise<T>;

export const on = (channel: string, cb: (...args: never[]) => void) => window.electron.on?.(channel, cb);
