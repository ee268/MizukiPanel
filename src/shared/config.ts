export type ConfigValue =
  null | boolean | number | string | ConfigValue[] | { [key: string]: ConfigValue };

export interface ConfigDescriptor {
  key: string;
  label: string;
  group: string;
  file: string;
  exportName: string;
}
