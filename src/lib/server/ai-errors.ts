export class AiWritingError extends Error {
  constructor(
    public status: 400 | 429 | 502 | 503 | 504,
    message: string,
  ) {
    super(message);
  }
}
