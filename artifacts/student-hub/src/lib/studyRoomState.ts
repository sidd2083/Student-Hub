/**
 * Module-level flag shared between ActiveRoomContext and TimerContext.
 *
 * Because TimerProvider wraps ActiveRoomProvider in the component tree,
 * TimerContext cannot call useActiveRoom() directly. This tiny module lets
 * ActiveRoomContext notify TimerContext synchronously without a dependency cycle.
 *
 * Usage:
 *   - ActiveRoomContext calls setInActiveRoom(true) on join, false on leave/kick.
 *   - TimerContext calls isInActiveRoom() before saving study minutes.
 */
let _inActiveRoom = false;

export function setInActiveRoom(value: boolean): void {
  _inActiveRoom = value;
}

export function isInActiveRoom(): boolean {
  return _inActiveRoom;
}
