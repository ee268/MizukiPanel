export class AiWritingError extends Error {
  constructor(
    public status: 400 | 429 | 502 | 504,
    message: string,
  ) {
    super(message);
  }
}
