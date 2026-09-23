import { deepStrictEqual, ok } from "node:assert/strict";
import {
  GENERATED_RFI_DOCX_DATABASE_ERROR,
  GENERATED_RFI_DOCX_MIME_TYPE,
  GENERATED_RFI_DOCX_TENANT_ERROR,
  GENERATED_RFI_DOCX_UPLOAD_ERROR,
  GENERATED_RFI_DOCX_VALIDATION_ERROR,
  MAX_GENERATED_RFI_DOCX_SIZE_BYTES,
  saveGeneratedRfiDocxLifecycle,
  type SaveGeneratedRfiDocxDeps,
} from "./rfiGeneratedDocxLifecycle";
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
  fileName: "RFI-RFI-001-JW14404H.docx",
  existingRfi: {
    id: "doc-1",
    companyId: "company-1",
    projectId: "project-1",
    generatedDocxPath:
      "company-1/project-1/rfi/doc-1/old-generated.docx",
  },
};

function createDocxBlob(): Blob {
  return new Blob(["generated rfi docx"], {
    type: GENERATED_RFI_DOCX_MIME_TYPE,
  });
}

function createDeps(
  overrides: Partial<SaveGeneratedRfiDocxDeps> = {},
): SaveGeneratedRfiDocxDeps {
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
  "1. replacement order is upload -> scoped update -> generated index -> old cleanup",
  async () => {
    const order: string[] = [];
    const removedPaths: string[] = [];

    const result = await saveGeneratedRfiDocxLifecycle(
      { ...baseParams, docxBlob: createDocxBlob() },
      createDeps({
        uploadStorageFile: async (path, blob, contentType) => {
          order.push("upload");
          assert(path.includes("/rfi/doc-1/generated-"));
          assert(path.endsWith("-RFI-RFI-001-JW14404H.docx"));
          assertEquals(blob.size, createDocxBlob().size);
          assertEquals(contentType, GENERATED_RFI_DOCX_MIME_TYPE);
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
          assertEquals(
            payload.generated_docx_path,
            resultPathFromPayload(payload),
          );
          return { data: { id: "doc-1" }, error: null };
        },
        indexSource: async (documentId, sourceKind) => {
          order.push("index");
          assertEquals(documentId, "doc-1");
          assertEquals(sourceKind, "generated");
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
      "company-1/project-1/rfi/doc-1/old-generated.docx",
    ]);
  },
);

function resultPathFromPayload(
  payload: Record<string, unknown>,
): string {
  const value = payload.generated_docx_path;
  assert(typeof value === "string");
  assert(value.includes("/rfi/doc-1/generated-"));
  return value;
}

Deno.test("2. generated path is unique and filename is sanitised", async () => {
  const uploadedPaths: string[] = [];
  const params = {
    ...baseParams,
    fileName: "../RFI Final (Rev #1).docx",
    existingRfi: {
      ...baseParams.existingRfi,
      generatedDocxPath: undefined,
    },
    docxBlob: createDocxBlob(),
  };
  const deps = createDeps({
    uploadStorageFile: async (path) => {
      uploadedPaths.push(path);
      return { error: null };
    },
  });

  const first = await saveGeneratedRfiDocxLifecycle(params, deps);
  const second = await saveGeneratedRfiDocxLifecycle(params, deps);

  assertEquals(uploadedPaths.length, 2);
  assert(uploadedPaths[0] !== uploadedPaths[1]);
  assert(uploadedPaths[0].endsWith("-RFI-Final-Rev-1.docx"));
  assertEquals(first.fileName, "RFI-Final-Rev-1.docx");
  assertEquals(second.fileName, "RFI-Final-Rev-1.docx");
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

  const result = await saveGeneratedRfiDocxLifecycle(
    {
      ...baseParams,
      existingRfi: {
        ...baseParams.existingRfi,
        projectId: "another-project",
      },
      docxBlob: createDocxBlob(),
    },
    deps,
  );

  assertEquals(result.success, false);
  assertEquals(result.error, GENERATED_RFI_DOCX_TENANT_ERROR);
  assertEquals(calls, 0);
});

Deno.test("4. invalid filename or MIME type is rejected before upload", async () => {
  let uploadCalls = 0;
  const deps = createDeps({
    uploadStorageFile: async () => {
      uploadCalls++;
      return { error: null };
    },
  });

  const wrongExtension = await saveGeneratedRfiDocxLifecycle(
    {
      ...baseParams,
      fileName: "generated-rfi.pdf",
      docxBlob: createDocxBlob(),
    },
    deps,
  );
  const mismatchedMime = await saveGeneratedRfiDocxLifecycle(
    {
      ...baseParams,
      docxBlob: new Blob(["not docx"], { type: "application/pdf" }),
    },
    deps,
  );

  assertEquals(wrongExtension.error, GENERATED_RFI_DOCX_VALIDATION_ERROR);
  assertEquals(mismatchedMime.error, GENERATED_RFI_DOCX_VALIDATION_ERROR);
  assertEquals(uploadCalls, 0);
});

Deno.test("5. empty and oversized blobs are rejected before upload", async () => {
  let uploadCalls = 0;
  const deps = createDeps({
    uploadStorageFile: async () => {
      uploadCalls++;
      return { error: null };
    },
  });

  const emptyResult = await saveGeneratedRfiDocxLifecycle(
    {
      ...baseParams,
      docxBlob: new Blob([], { type: GENERATED_RFI_DOCX_MIME_TYPE }),
    },
    deps,
  );
  const oversizedBlob = {
    size: MAX_GENERATED_RFI_DOCX_SIZE_BYTES + 1,
    type: GENERATED_RFI_DOCX_MIME_TYPE,
  } as Blob;
  const oversizedResult = await saveGeneratedRfiDocxLifecycle(
    { ...baseParams, docxBlob: oversizedBlob },
    deps,
  );

  assertEquals(emptyResult.error, GENERATED_RFI_DOCX_VALIDATION_ERROR);
  assertEquals(oversizedResult.error, GENERATED_RFI_DOCX_VALIDATION_ERROR);
  assertEquals(uploadCalls, 0);
});

Deno.test("6. returned or thrown upload failure stops every later step", async () => {
  for (
    const uploadStorageFile of [
      async () => ({ error: new Error("raw upload failure") }),
      async (): Promise<{ error: unknown | null }> => {
        throw new Error("raw thrown upload failure");
      },
    ]
  ) {
    let databaseCalls = 0;
    let indexCalls = 0;
    let cleanupCalls = 0;

    const result = await saveGeneratedRfiDocxLifecycle(
      { ...baseParams, docxBlob: createDocxBlob() },
      createDeps({
        uploadStorageFile,
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
    assertEquals(result.error, GENERATED_RFI_DOCX_UPLOAD_ERROR);
    assertEquals(databaseCalls, 0);
    assertEquals(indexCalls, 0);
    assertEquals(cleanupCalls, 0);
  }
});

Deno.test(
  "7. returned database failures clean only the uncommitted new object",
  async () => {
    for (
      const databaseResult of [
        { data: null, error: null },
        { data: {}, error: null },
        { data: { id: "wrong-id" }, error: null },
        { data: { id: "doc-1" }, error: new Error("raw database failure") },
      ]
    ) {
      const removedPaths: string[][] = [];
      let indexCalls = 0;

      const result = await saveGeneratedRfiDocxLifecycle(
        { ...baseParams, docxBlob: createDocxBlob() },
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
      assertEquals(result.error, GENERATED_RFI_DOCX_DATABASE_ERROR);
      assertEquals(removedPaths.length, 1);
      assertEquals(removedPaths[0].length, 1);
      assert(
        removedPaths[0][0] !==
          baseParams.existingRfi.generatedDocxPath,
      );
      assertEquals(indexCalls, 0);
    }
  },
);

Deno.test(
  "8. thrown database failure cleans only the new object and never indexes",
  async () => {
    const removedPaths: string[][] = [];
    let indexCalls = 0;

    const result = await saveGeneratedRfiDocxLifecycle(
      { ...baseParams, docxBlob: createDocxBlob() },
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
    assertEquals(result.error, GENERATED_RFI_DOCX_DATABASE_ERROR);
    assertEquals(removedPaths.length, 1);
    assertEquals(removedPaths[0].length, 1);
    assert(
      removedPaths[0][0] !== baseParams.existingRfi.generatedDocxPath,
    );
    assertEquals(indexCalls, 0);
  },
);

Deno.test("9. ready and noop indexing outcomes remain successful", async () => {
  for (const status of ["ready", "noop"] as const) {
    const result = await saveGeneratedRfiDocxLifecycle(
      {
        ...baseParams,
        existingRfi: {
          ...baseParams.existingRfi,
          generatedDocxPath: undefined,
        },
        docxBlob: createDocxBlob(),
      },
      createDeps({
        indexSource: async () => ({ status }),
      }),
    );

    assertEquals(result.success, true);
    assertEquals(result.indexResult?.status, status);
    assertEquals(result.warning, undefined);
  }
});

Deno.test("10. unsupported indexing returns a fixed nonfatal warning", async () => {
  const result = await saveGeneratedRfiDocxLifecycle(
    {
      ...baseParams,
      existingRfi: {
        ...baseParams.existingRfi,
        generatedDocxPath: undefined,
      },
      docxBlob: createDocxBlob(),
    },
    createDeps({
      indexSource: async () => ({
        status: "unsupported",
        message: "Raw provider details must not be displayed.",
      }),
    }),
  );

  assertEquals(result.success, true);
  assertEquals(
    result.warning,
    "The generated RFI DOCX was saved, but its file format is unavailable to Project Advisor.",
  );
  assert(!result.warning?.includes("Raw provider"));
});

Deno.test(
  "11. retryable index failure occurs once before eligible old cleanup",
  async () => {
    const order: string[] = [];
    let indexCalls = 0;

    const result = await saveGeneratedRfiDocxLifecycle(
      { ...baseParams, docxBlob: createDocxBlob() },
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
      "The generated RFI DOCX was saved, but Project Advisor indexing is temporarily unavailable. Generate the DOCX again later to retry.",
    );
  },
);

Deno.test("12. non-retryable index failure is sanitised and nonfatal", async () => {
  let indexCalls = 0;

  const result = await saveGeneratedRfiDocxLifecycle(
    {
      ...baseParams,
      existingRfi: {
        ...baseParams.existingRfi,
        generatedDocxPath: undefined,
      },
      docxBlob: createDocxBlob(),
    },
    createDeps({
      indexSource: async () => {
        indexCalls++;
        throw new Error("raw provider secret");
      },
    }),
  );

  assertEquals(result.success, true);
  assertEquals(indexCalls, 1);
  assertEquals(
    result.warning,
    "The generated RFI DOCX was saved, but Project Advisor indexing did not complete.",
  );
  assert(!result.warning?.includes("provider secret"));
});

Deno.test("13. uploaded source sharing the old path prevents cleanup", async () => {
  let removeCalls = 0;
  const sharedPath = baseParams.existingRfi.generatedDocxPath;

  const result = await saveGeneratedRfiDocxLifecycle(
    {
      ...baseParams,
      existingRfi: {
        ...baseParams.existingRfi,
        uploadedFilePath: sharedPath,
      },
      docxBlob: createDocxBlob(),
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

Deno.test("14. signed source sharing the old path prevents cleanup", async () => {
  let removeCalls = 0;
  const sharedPath = baseParams.existingRfi.generatedDocxPath;

  const result = await saveGeneratedRfiDocxLifecycle(
    {
      ...baseParams,
      existingRfi: {
        ...baseParams.existingRfi,
        signedFilePath: sharedPath,
      },
      docxBlob: createDocxBlob(),
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

Deno.test("15. old-object cleanup failure never rolls back the save", async () => {
  const result = await saveGeneratedRfiDocxLifecycle(
    { ...baseParams, docxBlob: createDocxBlob() },
    createDeps({
      removeStorageFiles: async () => {
        throw new Error("raw cleanup provider detail");
      },
    }),
  );

  assertEquals(result.success, true);
  assertEquals(result.error, undefined);
  assertEquals(
    result.message,
    "The RFI DOCX was generated and saved successfully.",
  );
});
