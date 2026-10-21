import { syncFromBee } from '../bee/sync';

export const BEE_SYNC_TASK = 'cartradar-bee-sync';

type TaskManagerModule = typeof import('expo-task-manager');
type BackgroundTaskModule = typeof import('expo-background-task');

/** These load native code and throw if it is missing (some Expo Go builds); without them there is just no background sync. */
function load(): { TaskManager: TaskManagerModule; BackgroundTask: BackgroundTaskModule } | undefined {
  try {
    return { TaskManager: require('expo-task-manager'), BackgroundTask: require('expo-background-task') };
  } catch {
    return undefined;
  }
}
const native = load();

native?.TaskManager.defineTask(BEE_SYNC_TASK, async () => {
  try {
    await syncFromBee();
    return native.BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return native.BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** The OS decides when this really runs (roughly every 15+ minutes at best); the app also syncs whenever it opens. */
export async function registerBackgroundSync() {
  if (!native) return;
  if (await native.TaskManager.isTaskRegisteredAsync(BEE_SYNC_TASK)) return;
  await native.BackgroundTask.registerTaskAsync(BEE_SYNC_TASK, { minimumInterval: 15 });
}
