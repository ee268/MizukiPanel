import { execFile } from "node:child_process";
import { mkdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";

const run = promisify(execFile);

function stateFile(stateDir: string): string {
  return path.join(stateDir, "workspace.json");
}

export function defaultStateDir(): string {
  return path.resolve(process.cwd(), ".local");
}

export async function readWorkspacePath(stateDir = defaultStateDir()): Promise<string | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(stateFile(stateDir), "utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "projectPath" in parsed &&
      typeof parsed.projectPath === "string"
    ) {
      return parsed.projectPath;
    }
    return null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function saveWorkspacePath(
  projectPath: string,
  stateDir = defaultStateDir(),
): Promise<void> {
  await mkdir(stateDir, { recursive: true });
  const tempFile = path.join(stateDir, `.workspace-${randomUUID()}.tmp`);
  try {
    await writeFile(tempFile, JSON.stringify({ projectPath }, null, 2), {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    await rename(tempFile, stateFile(stateDir));
  } catch (error) {
    await rm(tempFile, { force: true });
    throw error;
  }
}

export async function clearWorkspace(stateDir = defaultStateDir()): Promise<void> {
  await rm(stateFile(stateDir), { force: true });
}
export class WorkspacePickerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspacePickerError";
  }
}

export type DirectoryPicker = (initialPath?: string) => Promise<string>;

const windowsPickerScript = `
Add-Type -AssemblyName System.Windows.Forms
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = '选择 Mizuki 项目文件夹'
$dialog.ShowNewFolderButton = $false
try {
  $initial = $env:MIZUKI_PANEL_INITIAL_DIRECTORY
  if ($initial -and (Test-Path -LiteralPath $initial -PathType Container)) {
    $dialog.SelectedPath = $initial
  }
  if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
    [Console]::Write($dialog.SelectedPath)
  }
} finally {
  $dialog.Dispose()
}
`;

async function openWindowsFolderPicker(initialPath?: string): Promise<string> {
  if (process.platform !== "win32")
    throw new WorkspacePickerError("文件夹选择器目前仅支持 Windows");
  const encoded = Buffer.from(windowsPickerScript, "utf16le").toString("base64");
  try {
    const { stdout } = await run(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-STA", "-EncodedCommand", encoded],
      {
        encoding: "utf8",
        windowsHide: true,
        maxBuffer: 1024 * 1024,
        env: {
          ...process.env,
          MIZUKI_PANEL_INITIAL_DIRECTORY:
            initialPath && initialPath.length < 32768 && !initialPath.includes("\0")
              ? initialPath
              : "",
        },
      },
    );
    return stdout;
  } catch (error) {
    const failure = error as Error & { stderr?: string };
    throw new WorkspacePickerError(
      (failure.stderr || failure.message || "无法打开文件夹选择器").trim(),
    );
  }
}

let selectingDirectory = false;

export async function selectWorkspaceDirectory(
  initialPath?: string,
  picker: DirectoryPicker = openWindowsFolderPicker,
): Promise<string | null> {
  if (selectingDirectory) throw new WorkspacePickerError("文件夹选择器已经打开");
  selectingDirectory = true;
  try {
    const selected = (await picker(initialPath?.trim() || undefined)).trim();
    if (!selected) return null;
    let resolved: string;
    try {
      resolved = await realpath(selected);
    } catch {
      throw new WorkspacePickerError("选择的文件夹不存在或无法访问");
    }
    if (!(await stat(resolved)).isDirectory())
      throw new WorkspacePickerError("选择的路径不是文件夹");
    return resolved;
  } finally {
    selectingDirectory = false;
  }
}
