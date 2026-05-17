import * as path from "path";
import * as admin from "firebase-admin";

const USERS_COLLECTION = "Users";
const DEFAULT_BATCH_SIZE = 400;
const AUTH_PAGE_SIZE = 1000;

const getArgValue = (name: string): string | null => {
  const arg = process.argv.find((value) => value.startsWith(`${name}=`));
  if (!arg) return null;
  return arg.split("=").slice(1).join("=");
};

const parseBatchSize = (): number => {
  const raw = getArgValue("--batch-size");
  if (!raw) return DEFAULT_BATCH_SIZE;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500) {
    throw new Error("--batch-size must be an integer between 1 and 500.");
  }
  return parsed;
};

const initializeFirebaseAdmin = () => {
  const serviceAccountPath = getArgValue("--service-account");
  if (serviceAccountPath) {
    const resolvedPath = path.resolve(serviceAccountPath);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const serviceAccount = require(resolvedPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log(`[init] Using service account from ${resolvedPath}`);
    return;
  }

  admin.initializeApp();
  console.log("[init] Using default Firebase Admin credentials");
};

const toFirestoreTimestamp = (
  value: string | undefined,
): admin.firestore.Timestamp | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return admin.firestore.Timestamp.fromDate(date);
};

const run = async () => {
  const applyChanges = process.argv.includes("--apply");
  const batchSize = parseBatchSize();

  initializeFirebaseAdmin();
  const db = admin.firestore();
  const auth = admin.auth();
  const usersRef = db.collection(USERS_COLLECTION);

  let authUserCount = 0;
  let willUpsertCount = 0;
  let writeCount = 0;
  let pageCount = 0;
  let missingCreationTimeCount = 0;
  let nextPageToken: string | undefined;

  console.log(
    `[start] ${applyChanges ? "APPLY" : "DRY RUN"} mode | ` +
      `batch size: ${batchSize}`,
  );

  let pendingWrites = 0;
  let batch = db.batch();
  let hasNextPage = true;
  while (hasNextPage) {
    const authPage = await auth.listUsers(AUTH_PAGE_SIZE, nextPageToken);
    pageCount += 1;
    let pageWriteCount = 0;

    for (const authUser of authPage.users) {
      authUserCount += 1;

      const createdAt = toFirestoreTimestamp(authUser.metadata.creationTime);
      const lastSignIn =
        toFirestoreTimestamp(authUser.metadata.lastSignInTime) ?? createdAt;

      if (!createdAt) {
        missingCreationTimeCount += 1;
        console.log(
          `[skip] Missing creationTime for uid=${authUser.uid}; skipped.`,
        );
        continue;
      }

      const updates: Record<string, unknown> = {
        createdAt,
        lastSignIn: lastSignIn ?? createdAt,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      willUpsertCount += 1;
      if (!applyChanges) {
        pageWriteCount += 1;
        continue;
      }

      batch.set(usersRef.doc(authUser.uid), updates, {merge: true});
      pendingWrites += 1;
      pageWriteCount += 1;

      if (pendingWrites >= batchSize) {
        await batch.commit();
        writeCount += pendingWrites;
        console.log(
          `[write] page ${pageCount}: committed ${pendingWrites} updates`,
        );
        batch = db.batch();
        pendingWrites = 0;
      }
    }

    if (applyChanges) {
      console.log(
        `[scan] page ${pageCount}: auth users ${authPage.users.length}, ` +
          `${pageWriteCount} prepared`,
      );
    } else {
      console.log(
        `[scan] page ${pageCount}: auth users ${authPage.users.length}, ` +
          `${pageWriteCount} would be updated`,
      );
    }

    nextPageToken = authPage.pageToken;
    hasNextPage = Boolean(nextPageToken);
  }

  if (applyChanges && pendingWrites > 0) {
    await batch.commit();
    writeCount += pendingWrites;
    console.log(`[write] final commit: ${pendingWrites} updates`);
  }

  console.log("[done] Backfill complete");
  console.log(`[done] Auth users scanned: ${authUserCount}`);
  console.log(`[done] User docs to upsert: ${willUpsertCount}`);
  console.log(`[done] Users updated: ${writeCount}`);
  console.log(
    "[done] Users skipped for missing creationTime: " +
      `${missingCreationTimeCount}`,
  );

  if (!applyChanges) {
    console.log("[next] Re-run with --apply to persist changes.");
  }
};

run().catch((error) => {
  console.error("[error] Backfill failed.");
  console.error(error instanceof Error ? error.message : String(error));
  console.error(
    "[hint] You may need --service-account=/path/to/key.json or " +
      "Application Default Credentials.",
  );
  process.exitCode = 1;
});
