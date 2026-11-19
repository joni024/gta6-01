// Keyboard and mouse state. The game reads this each frame; menus read the
// "pressed this frame" edges.
export function createInput() {
  const input = {
    keys: new Set(),
    pressed: new Set(),
    mouse: { x: 0, y: 0, down: false, clicked: false },
    anyKey: false,
  };

  function onKeyDown(event) {
    if (event.repeat) return;
    input.keys.add(event.code);
    input.pressed.add(event.code);
    input.anyKey = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  }
  function onKeyUp(event) {
    input.keys.delete(event.code);
  }
  function onMouseMove(event) {
    input.mouse.x = event.clientX;
    input.mouse.y = event.clientY;
  }
  function onMouseDown(event) {
    if (event.button === 0) {
      input.mouse.down = true;
      input.mouse.clicked = true;
      input.anyKey = true;
    }
  }
  function onMouseUp(event) {
    if (event.button === 0) input.mouse.down = false;
  }
  function onBlur() {
    input.keys.clear();
    input.mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('blur', onBlur);

  input.down = (code) => input.keys.has(code);
  input.wasPressed = (code) => input.pressed.has(code);
  input.axis = () => {
    let x = 0;
    let y = 0;
    if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) x -= 1;
    if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) x += 1;
    if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) y -= 1;
    if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) y += 1;
    return { x, y };
  };
  // Call once per frame, after the update, to clear the one-frame edges.
  input.endFrame = () => {
    input.pressed.clear();
    input.mouse.clicked = false;
  };
  return input;
}
