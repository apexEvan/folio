import assert from "node:assert/strict";
import path from "node:path";

// Called with a captured signature in the signing dialog. All input uses the rendered preview.
export async function checkSignatureDragging(page, shots) {
  const preview = page.locator(".signature-page");
  const stamp = page.locator(".signature-placement");
  const bounds = await preview.boundingBox();
  assert.ok(bounds);
  await preview.click({ position: { x: bounds.width / 2, y: bounds.height / 2 } });
  const before = await stamp.boundingBox();
  assert.ok(before);
  const grab = { x: before.x + before.width * 0.25, y: before.y + before.height * 0.25 };
  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  await page.mouse.move(grab.x + 35, grab.y + 45, { steps: 8 });
  const during = await stamp.boundingBox();
  if (shots) await page.screenshot({ path: path.join(shots, "signature-drag.png") });
  assert.ok(Math.abs(during.x - before.x - 35) < 1, "the preview moves before releasing the pointer");
  assert.ok(Math.abs(during.y - before.y - 45) < 1, "dragging preserves the grab offset");
  assert.ok(Math.abs(during.width - before.width) < 1, "dragging keeps the signature size");
  await page.mouse.up();
  const after = await stamp.boundingBox();
  assert.ok(Math.abs(after.x - during.x) < 1 && Math.abs(after.y - during.y) < 1,
    "releasing does not jump to a different position");

  // Pointer capture keeps dragging active outside the preview; the stamp remains within the page.
  await page.mouse.move(after.x + after.width / 2, after.y + after.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x - 50, bounds.y - 50, { steps: 5 });
  const edge = await stamp.boundingBox();
  const currentBounds = await preview.boundingBox();
  assert.ok(Math.abs(edge.x - currentBounds.x) < 1 && Math.abs(edge.y - currentBounds.y) < 1,
    `signature stays at the page edge: ${JSON.stringify({ edge, currentBounds })}`);
  await page.mouse.up();
  await preview.focus();
  await page.keyboard.press("ArrowRight");
  const nudged = await stamp.boundingBox();
  assert.ok(nudged.x > edge.x, "keyboard positioning still works after a drag");

  // Cancelled and secondary pointers must not commit or interfere with the primary drag.
  const originalStyle = await stamp.getAttribute("style");
  await preview.evaluate(element => element.addEventListener("pointerdown", event => {
    element.dataset.testPointerId = String(event.pointerId);
  }, { once: true }));
  await page.mouse.move(nudged.x + nudged.width / 2, nudged.y + nudged.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  const pointerId = Number(await preview.getAttribute("data-test-pointer-id"));
  await preview.dispatchEvent("pointercancel", { pointerId: pointerId + 1 });
  assert.notEqual(await stamp.getAttribute("style"), originalStyle, "another pointer cannot cancel this drag");
  await preview.dispatchEvent("pointercancel", { pointerId });
  await page.mouse.up();
  assert.equal(await stamp.getAttribute("style"), originalStyle, "cancellation restores the previous placement");
  await preview.click({ button: "right", position: { x: bounds.width * 0.8, y: bounds.height * 0.8 } });
  assert.equal(await stamp.getAttribute("style"), originalStyle, "right-click does not reposition the signature");
  console.log("ok  signature dragging previews movement, preserves size, clamps to the page, and keeps keyboard positioning");
}
