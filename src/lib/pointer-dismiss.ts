export function subscribePointerDismiss(
  onDismiss: () => void,
  isInside: (target: EventTarget | null) => boolean,
): () => void {
  if (typeof document === 'undefined') {
    return () => {};
  }

  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onDismiss();
    }
  };
  const onPointer = (event: PointerEvent) => {
    if (isInside(event.target)) {
      return;
    }
    onDismiss();
  };
  const onScroll = () => {
    onDismiss();
  };

  document.addEventListener('keydown', onKey);
  document.addEventListener('pointerdown', onPointer, true);
  document.addEventListener('scroll', onScroll, true);
  return () => {
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('pointerdown', onPointer, true);
    document.removeEventListener('scroll', onScroll, true);
  };
}

export function measureElementById(id: string): { x: number; y: number; width: number; height: number } | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const node = document.getElementById(id);
  if (!node) {
    return null;
  }
  const rect = node.getBoundingClientRect();
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

export function targetIsWithinIds(target: EventTarget | null, ids: string[]): boolean {
  if (typeof document === 'undefined' || !(target instanceof Node)) {
    return false;
  }
  return ids.some((id) => {
    const node = document.getElementById(id);
    return node === target || Boolean(node?.contains(target));
  });
}
