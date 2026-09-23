import { PrismaClient } from "@prisma/client";
import { sync } from "../scripts/syncKnowledgeBase";

let timeoutId: NodeJS.Timeout | null = null;
let isSyncing = false;
let syncRequested = false;

/**
 * Triggers a debounced sync of the knowledge base.
 * Waits 5 seconds after the last call before executing to batch updates.
 */
export function triggerSync(prisma: PrismaClient) {
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
  
  timeoutId = setTimeout(() => {
    runSync(prisma).catch((err) => {
      console.error("Auto-sync failed:", err);
    });
  }, 5000);
}

async function runSync(prisma: PrismaClient) {
  if (isSyncing) {
    syncRequested = true;
    return;
  }
  
  isSyncing = true;
  syncRequested = false;
  
  try {
    console.log("Starting automatic knowledge base sync...");
    await sync(prisma);
  } finally {
    isSyncing = false;
    if (syncRequested) {
      // If another sync was requested while we were syncing, run again
      runSync(prisma).catch((err) => {
        console.error("Follow-up auto-sync failed:", err);
      });
    }
  }
}
