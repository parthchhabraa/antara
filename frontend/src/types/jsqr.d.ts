// jsqr ships no TypeScript types of its own and there's no @types/jsqr
// package — a minimal ambient declaration for the one function this app
// actually calls (see AddFriendSheet.tsx), not a full re-implementation of
// its types.
declare module "jsqr" {
  interface QRCodePoint {
    x: number;
    y: number;
  }

  interface QRCode {
    data: string;
    location: {
      topLeftCorner: QRCodePoint;
      topRightCorner: QRCodePoint;
      bottomLeftCorner: QRCodePoint;
      bottomRightCorner: QRCodePoint;
    };
  }

  function jsQR(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    options?: { inversionAttempts?: "dontInvert" | "onlyInvert" | "attemptBoth" | "invertFirst" }
  ): QRCode | null;

  export default jsQR;
}
