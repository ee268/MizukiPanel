export class FeatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeatureError";
  }
}
