import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { syncFromBee } from '../bee/sync';

export const BEE_SYNC_TASK = 'cartradar-bee-sync';

TaskManager.defineTask(BEE_SYNC_TASK, async () => {
  try {
    await syncFromBee();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** The OS decides when this really runs (roughly every 15+ minutes at best); the app also syncs whenever it opens. */
export async function registerBackgroundSync() {
  if (await TaskManager.isTaskRegisteredAsync(BEE_SYNC_TASK)) return;
  await BackgroundTask.registerTaskAsync(BEE_SYNC_TASK, { minimumInterval: 15 });
}
