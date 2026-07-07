import { processAlexaMessage } from "../src/lib/ai/process-message";
import { getState } from "../src/lib/store/server-store";
import { getWorkingMemory } from "../src/lib/memory/working-memory";
import { clearPendingActions } from "../src/lib/actions/confirmation";
import { updateUiContext } from "../src/lib/store/ui-context";

clearPendingActions();
updateUiContext({ currentPath: "/chat" });

const r1 = await processAlexaMessage("Which store is best?", getState());
console.log("R1:", r1?.message?.slice(0, 80));
console.log("WM:", getWorkingMemory());
const r2 = await processAlexaMessage("yes", getState());
console.log("R2:", r2?.message?.slice(0, 120) ?? "NULL");
