const editors = new Set<() => Promise<boolean>>();
export function registerEditor(flush: () => Promise<boolean>) {
  editors.add(flush);
  return () => {
    editors.delete(flush);
  };
}
export async function flushEditors() {
  return (await Promise.all([...editors].map((flush) => flush()))).every(Boolean);
}
