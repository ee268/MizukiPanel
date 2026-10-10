import { SyntaxEditor } from "./SyntaxEditor";

export function TypeScriptEditor({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <SyntaxEditor
      language="typescript"
      ariaLabel="TypeScript 配置编辑器"
      value={value}
      onChange={onChange}
      disabled={disabled}
      height="520px"
      minHeight="520px"
      maxHeight="520px"
    />
  );
}
