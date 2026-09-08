// Augment Express Request with the authenticated user id (set by auth middleware).
export {};

declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}
