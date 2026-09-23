import { deepStrictEqual, ok } from "node:assert/strict";
import {
  MAX_SIGNED_RFI_FILE_SIZE_BYTES,
  saveSignedRfiFileLifecycle,
  SIGNED_RFI_DATABASE_ERROR,
  SIGNED_RFI_TENANT_ERROR,
  SIGNED_RFI_UPLOAD_ERROR,
  SIGNED_RFI_VALIDATION_ERROR,
  type SaveSignedRfiFileDeps,
} from "./rfiSignedFileLifecycle";
import {
  ProjectAdvisorFileIndexServiceError,
} from "../../services/projectAdvisorFileIndexService";

function assertEquals<T>(actual: T, expected: T, message?: string): void {
  deepStrictEqual(actual, expected, message);
}

function assert(value: unknown, message?: string): asserts value {
  ok(value, message);
}

const baseParams = {
  documentId: "doc-1",
  companyId: "company-1",
  projectId: "project-1",
  existingRfi: {
    id: "doc-1",
    companyId: "company-1",
    projectId: "project-1",
    signedFilePath: "company-1/project-1/rfi/doc-1/old-signed.pdf",
  },
};

function createPdf(name = "signed-rfi.pdf"): File {
  return new File(["signed rfi"], name, { type: "application/pdf" });
}

function createDeps(
  overrides: Partial<SaveSignedRfiFileDeps> = {},
): SaveSignedRfiFileDeps {
  return {
    uploadStorageFile: async () => ({ error: null }),
    removeStorageFiles: async () => ({ error: null }),
    updateDatabaseRow: async () => ({
      data: { id: "doc-1" },
      error: null,
    }),
    indexSource: async () => ({
      status: "ready",
      providerDocumentName: "fileSearchStores/store/documents/doc-1",
    }),
    ...overrides,
  };
}

Deno.test(
  "1. replacement order is upload -> scoped update -> signed index -> old cleanup",
  async () => {
    const order: string[] = [];
    const removedPaths: string[] = [];

    const result = await saveSignedRfiFileLifecycle(
      { ...baseParams, file: createPdf() },
      createDeps({
        uploadStorageFile: async (path) => {
          order.push("upload");
          assert(path.includes("/rfi/doc-1/"));
          assert(path.endsWith("-signed-rfi.pdf"));
          return { error: null };
        },
        updateDatabaseRow: async (
          documentId,
          companyId,
          projectId,
          payload,
        ) => {
          order.push("update");
          assertEquals(documentId, "doc-1");
          assertEquals(companyId, "company-1");
          assertEquals(projectId, "project-1");
          assertEquals(payload.signed_status, "Signed");
          assertEquals(payload.status, "Closed");
          assertEquals(payload.signed_file_type, "application/pdf");
          return { data: { id: "doc-1" }, error: null };
        },
        indexSource: async (documentId, sourceKind) => {
          order.push("index");
          assertEquals(documentId, "doc-1");
          assertEquals(sourceKind, "signed");
          return { status: "ready" };
        },
        removeStorageFiles: async (paths) => {
          order.push("remove-old");
          removedPaths.push(...paths);
          return { error: null };
        },
      }),
    );

    assertEquals(result.success, true);
    assertEquals(order, ["upload", "update", "index", "remove-old"]);
    assertEquals(removedPaths, [
      "company-1/project-1/rfi/doc-1/old-signed.pdf",
    ]);
  },
);

Deno.test("2. replacement path is unique and filename is sanitised", async () => {
  const uploadedPaths: string[] = [];
  const deps = createDeps({
    uploadStorageFile: async (path) => {
      uploadedPaths.push(path);
      return { error: null };
    },
    removeStorageFiles: async () => ({ error: null }),
  });

  const params = {
    ...baseParams,
    existingRfi: {
      ...baseParams.existingRfi,
      signedFilePath: undefined,
    },
    file: createPdf("Signed RFI (Final) #1.pdf"),
  };

  await saveSignedRfiFileLifecycle(params, deps);
  await saveSignedRfiFileLifecycle(params, deps);

  assertEquals(uploadedPaths.length, 2);
  assert(uploadedPaths[0] !== uploadedPaths[1]);
  assert(uploadedPaths[0].endsWith("-Signed-RFI-Final-1.pdf"));
});

Deno.test("3. tenant mismatch stops every mutation", async () => {
  let calls = 0;
  const deps = createDeps({
    uploadStorageFile: async () => {
      calls++;
      return { error: null };
    },
    updateDatabaseRow: async () => {
      calls++;
      return { data: { id: "doc-1" }, error: null };
    },
    indexSource: async () => {
      calls++;
      return { status: "ready" };
    },
    removeStorageFiles: async () => {
      calls++;
      return { error: null };
    },
  });

  const result = await saveSignedRfiFileLifecycle(
    {
      ...baseParams,
      existingRfi: {
        ...baseParams.existingRfi,
        companyId: "another-company",
      },
      file: createPdf(),
    },
    deps,
  );

  assertEquals(result.success, false);
  assertEquals(result.error, SIGNED_RFI_TENANT_ERROR);
  assertEquals(calls, 0);
});

Deno.test("4. invalid extension or MIME type is rejected before upload", async () => {
  let uploadCalls = 0;
  const deps = createDeps({
    uploadStorageFile: async () => {
      uploadCalls++;
      return { error: null };
    },
  });

  const wrongExtension = await saveSignedRfiFileLifecycle(
    {
      ...baseParams,
      file: new File(["text"], "signed.txt", { type: "text/plain" }),
    },
    deps,
  );
  const mismatchedMime = await saveSignedRfiFileLifecycle(
    {
      ...baseParams,
      file: new File(["not pdf"], "signed.pdf", { type: "text/plain" }),
    },
    deps,
  );

  assertEquals(wrongExtension.error, SIGNED_RFI_VALIDATION_ERROR);
  assertEquals(mismatchedMime.error, SIGNED_RFI_VALIDATION_ERROR);
  assertEquals(uploadCalls, 0);
});

Deno.test("5. empty and oversized files are rejected before upload", async () => {
  let uploadCalls = 0;
  const deps = createDeps({
    uploadStorageFile: async () => {
      uploadCalls++;
      return { error: null };
    },
  });

  const emptyResult = await saveSignedRfiFileLifecycle(
    {
      ...baseParams,
      file: new File([], "empty.pdf", { type: "application/pdf" }),
    },
    deps,
  );

  const oversizedFile = {
    name: "large.pdf",
    type: "application/pdf",
    size: MAX_SIGNED_RFI_FILE_SIZE_BYTES + 1,
  } as File;
  const oversizedResult = await saveSignedRfiFileLifecycle(
    { ...baseParams, file: oversizedFile },
    deps,
  );

  assertEquals(emptyResult.error, SIGNED_RFI_VALIDATION_ERROR);
  assertEquals(oversizedResult.error, SIGNED_RFI_VALIDATION_ERROR);
  assertEquals(uploadCalls, 0);
});

Deno.test("6. returned upload error preserves old source", async () => {
  let databaseCalls = 0;
  let indexCalls = 0;
  let cleanupCalls = 0;

  const result = await saveSignedRfiFileLifecycle(
    { ...baseParams, file: createPdf() },
    createDeps({
      uploadStorageFile: async () => ({
        error: new Error("raw upload error"),
      }),
      updateDatabaseRow: async () => {
        databaseCalls++;
        return { data: { id: "doc-1" }, error: null };
      },
      indexSource: async () => {
        indexCalls++;
        return { status: "ready" };
      },
      removeStorageFiles: async () => {
        cleanupCalls++;
        return { error: null };
      },
    }),
  );

  assertEquals(result.success, false);
  assertEquals(result.error, SIGNED_RFI_UPLOAD_ERROR);
  assertEquals(databaseCalls, 0);
  assertEquals(indexCalls, 0);
  assertEquals(cleanupCalls, 0);
});

Deno.test(
  "7. zero-row, missing-ID and wrong-ID updates clean only the new object",
  async () => {
    for (
      const databaseResult of [
        { data: null, error: null },
        { data: {}, error: null },
        { data: { id: "wrong-id" }, error: null },
        { data: { id: "doc-1" }, error: new Error("raw database error") },
      ]
    ) {
      const removedPaths: string[][] = [];
      let indexCalls = 0;

      const result = await saveSignedRfiFileLifecycle(
        { ...baseParams, file: createPdf() },
        createDeps({
          updateDatabaseRow: async () => databaseResult,
          removeStorageFiles: async (paths) => {
            removedPaths.push(paths);
            return { error: null };
          },
          indexSource: async () => {
            indexCalls++;
            return { status: "ready" };
          },
        }),
      );

      assertEquals(result.success, false);
      assertEquals(result.error, SIGNED_RFI_DATABASE_ERROR);
      assertEquals(removedPaths.length, 1);
      assertEquals(removedPaths[0].length, 1);
      assert(removedPaths[0][0] !== baseParams.existingRfi.signedFilePath);
      assertEquals(indexCalls, 0);
    }
  },
);

Deno.test(
  "8. thrown database failure cleans only the new object and never indexes",
  async () => {
    const removedPaths: string[][] = [];
    let indexCalls = 0;

    const result = await saveSignedRfiFileLifecycle(
      { ...baseParams, file: createPdf() },
      createDeps({
        updateDatabaseRow: async () => {
          throw new Error("raw thrown database failure");
        },
        removeStorageFiles: async (paths) => {
          removedPaths.push(paths);
          return { error: null };
        },
        indexSource: async () => {
          indexCalls++;
          return { status: "ready" };
        },
      }),
    );

    assertEquals(result.success, false);
    assertEquals(result.error, SIGNED_RFI_DATABASE_ERROR);
    assertEquals(removedPaths.length, 1);
    assertEquals(removedPaths[0].length, 1);
    assert(removedPaths[0][0] !== baseParams.existingRfi.signedFilePath);
    assertEquals(indexCalls, 0);
  },
);

Deno.test(
  "9. retryable index failure is nonfatal, occurs once, then old cleanup runs",
  async () => {
    const order: string[] = [];
    let indexCalls = 0;

    const result = await saveSignedRfiFileLifecycle(
      { ...baseParams, file: createPdf() },
      createDeps({
        uploadStorageFile: async () => {
          order.push("upload");
          return { error: null };
        },
        updateDatabaseRow: async () => {
          order.push("update");
          return { data: { id: "doc-1" }, error: null };
        },
        indexSource: async () => {
          order.push("index");
          indexCalls++;
          throw new ProjectAdvisorFileIndexServiceError(
            "GEMINI_TIMEOUT",
            true,
          );
        },
        removeStorageFiles: async () => {
          order.push("remove-old");
          return { error: null };
        },
      }),
    );

    assertEquals(result.success, true);
    assertEquals(indexCalls, 1);
    assertEquals(order, ["upload", "update", "index", "remove-old"]);
    assertEquals(
      result.warning,
      "The signed RFI was saved, but Project Advisor indexing is temporarily unavailable. Upload the signed file again later to retry.",
    );
  },
);

Deno.test("10. unsupported indexing returns a nonfatal warning", async () => {
  const result = await saveSignedRfiFileLifecycle(
    {
      ...baseParams,
      existingRfi: {
        ...baseParams.existingRfi,
        signedFilePath: undefined,
      },
      file: createPdf(),
    },
    createDeps({
      indexSource: async () => ({
        status: "unsupported",
        message: "Provider details must not be shown directly.",
      }),
    }),
  );

  assertEquals(result.success, true);
  assertEquals(
    result.warning,
    "The signed RFI was saved, but its file format is unavailable to Project Advisor.",
  );
});

Deno.test("11. uploaded source sharing old path prevents old cleanup", async () => {
  let removeCalls = 0;
  const sharedPath = baseParams.existingRfi.signedFilePath;

  const result = await saveSignedRfiFileLifecycle(
    {
      ...baseParams,
      existingRfi: {
        ...baseParams.existingRfi,
        uploadedFilePath: sharedPath,
      },
      file: createPdf(),
    },
    createDeps({
      removeStorageFiles: async () => {
        removeCalls++;
        return { error: null };
      },
    }),
  );

  assertEquals(result.success, true);
  assertEquals(removeCalls, 0);
});

Deno.test("12. generated source sharing old path prevents old cleanup", async () => {
  let removeCalls = 0;
  const sharedPath = baseParams.existingRfi.signedFilePath;

  const result = await saveSignedRfiFileLifecycle(
    {
      ...baseParams,
      existingRfi: {
        ...baseParams.existingRfi,
        generatedDocxPath: sharedPath,
      },
      file: createPdf(),
    },
    createDeps({
      removeStorageFiles: async () => {
        removeCalls++;
        return { error: null };
      },
    }),
  );

  assertEquals(result.success, true);
  assertEquals(removeCalls, 0);
});

Deno.test("13. cleanup failure never exposes raw errors or rolls back save", async () => {
  const result = await saveSignedRfiFileLifecycle(
    { ...baseParams, file: createPdf() },
    createDeps({
      removeStorageFiles: async () => {
        throw new Error("raw cleanup provider detail");
      },
    }),
  );

  assertEquals(result.success, true);
  assertEquals(result.error, undefined);
  assertEquals(result.message, "The signed RFI file was uploaded successfully.");
});
