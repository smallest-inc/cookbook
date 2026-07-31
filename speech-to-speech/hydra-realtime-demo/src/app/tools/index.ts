import {
  isKitchenTool,
  resetKitchenState,
  runKitchenTool,
} from "./kitchen";
import { isBankTool, resetBankState, runBankTool } from "./bank";

export function resetAllTools() {
  resetKitchenState();
  resetBankState();
}

export function executeTool(
  name: string,
  args: Record<string, unknown>,
): string {
  if (isKitchenTool(name)) return runKitchenTool(name, args);
  if (isBankTool(name)) return runBankTool(name, args);
  return `Error: tool '${name}' is not implemented on the client.`;
}
