/** An expected, user-facing failure. Route handlers turn it into `{ error: { code, message } }`. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message: string, code = "bad_request") => new AppError(400, code, message);
export const unauthorized = () => new AppError(401, "unauthorized", "Please sign in to continue.");
export const forbidden = (message: string) => new AppError(403, "forbidden", message);
export const notFound = (message = "Document not found.") => new AppError(404, "not_found", message);
