export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const {
    recoverInterruptedAdminBulkGenerateImportRunsForApp,
  } = await import("@/server/admin/admin-bulk-generate-import-service");

  void recoverInterruptedAdminBulkGenerateImportRunsForApp().catch((error) => {
    console.error("Admin bulk generate import recovery failed.", error);
  });
}
