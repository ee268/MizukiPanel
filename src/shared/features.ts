export interface FeatureDataDescriptor {
  key: string;
  module: string;
  label: string;
  file: string;
  variable: string;
  shape: "array" | "object";
}
