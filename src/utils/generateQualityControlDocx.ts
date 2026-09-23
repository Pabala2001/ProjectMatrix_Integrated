import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ImageRun,
  HeadingLevel,
} from "docx";
import { QualityControlRecord, QualityControlTemplate } from "../types/qualityControl";

// Helper to convert Base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
  const binaryString = window.atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

const borderStyleNone = { style: BorderStyle.NONE, size: 0, color: "auto" };
const borderStyleThin = { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" };
const borderStyleThick = { style: BorderStyle.SINGLE, size: 12, color: "111111" };

export function generateQualityControlDocx(
  record: QualityControlRecord,
  template: QualityControlTemplate
): Promise<{ blob: Blob; filename: string }> {
  return new Promise((resolve, reject) => {
    try {
      const docChildren: any[] = [];

      // Try processing logo if available
      let logoImageRun: any = null;
      if (record.companyLogoBase64) {
        try {
          const arrayBuffer = base64ToArrayBuffer(record.companyLogoBase64);
          logoImageRun = new ImageRun({
            data: arrayBuffer,
            transformation: {
              width: 80,
              height: 50,
            },
          } as any);
        } catch (imgErr) {
          console.error("Failed to parse base64 logo for DOCX", imgErr);
        }
      }

      // 1. HEADER LOGO & DOCUMENT META TABLE
      const headerTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 25, type: WidthType.PERCENTAGE },
                borders: {
                  top: borderStyleThick,
                  bottom: borderStyleThick,
                  left: borderStyleThick,
                  right: borderStyleThin,
                },
                children: logoImageRun
                  ? [new Paragraph({ children: [logoImageRun], alignment: AlignmentType.CENTER })]
                  : [
                      new Paragraph({
                        children: [new TextRun({ text: "[ LOGO ]", bold: true, size: 20, color: "888888" })],
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: {
                  top: borderStyleThick,
                  bottom: borderStyleThick,
                  left: borderStyleThin,
                  right: borderStyleThin,
                },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: (record.companyName || "CONTRACTOR QUALITY MANAGEMENT").toUpperCase(),
                        bold: true,
                        size: 24,
                      }),
                    ],
                    alignment: AlignmentType.CENTER,
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "QUALITY CONTROL INSPECTION SYSTEM",
                        size: 16,
                        color: "555555",
                      }),
                    ],
                    alignment: AlignmentType.CENTER,
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: template.title.toUpperCase(),
                        bold: true,
                        size: 26,
                        color: "1F2937",
                      }),
                    ],
                    alignment: AlignmentType.CENTER,
                  }),
                ],
              }),
              new TableCell({
                width: { size: 25, type: WidthType.PERCENTAGE },
                borders: {
                  top: borderStyleThick,
                  bottom: borderStyleThick,
                  left: borderStyleThin,
                  right: borderStyleThick,
                },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: `Ref: ${record.formReference || template.documentRef || "N/A"}`, bold: true, size: 16 }),
                    ],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: `Rev: ${record.revision || template.revision || "0"}`, size: 16 }),
                    ],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: `Date: ${record.revisionDate || template.revisionDate || "N/A"}`, size: 16 }),
                    ],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: `Status: ${record.status}`, bold: true, size: 16, color: record.status === "Approved" ? "10B981" : record.status === "Rejected" ? "EF4444" : "F59E0B" }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      });

      docChildren.push(headerTable);
      docChildren.push(new Paragraph({ text: "" })); // Spacing

      // 2. PROJECT INFORMATION SUB-TABLE
      const projectMetaTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                borders: { top: borderStyleThick, bottom: borderStyleThin, left: borderStyleThick, right: borderStyleThin },
                children: [new Paragraph({ children: [new TextRun({ text: "Project Name:", bold: true, size: 18 }), new TextRun({ text: ` ${record.projectName || "N/A"}`, size: 18 })] })],
              }),
              new TableCell({
                borders: { top: borderStyleThick, bottom: borderStyleThin, left: borderStyleThin, right: borderStyleThick },
                children: [new Paragraph({ children: [new TextRun({ text: "Project Number:", bold: true, size: 18 }), new TextRun({ text: ` ${record.projectNumber || "N/A"}`, size: 18 })] })],
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                borders: { top: borderStyleThin, bottom: borderStyleThin, left: borderStyleThick, right: borderStyleThin },
                children: [new Paragraph({ children: [new TextRun({ text: "Contract Number:", bold: true, size: 18 }), new TextRun({ text: ` ${record.contractNumber || "N/A"}`, size: 18 })] })],
              }),
              new TableCell({
                borders: { top: borderStyleThin, bottom: borderStyleThin, left: borderStyleThin, right: borderStyleThick },
                children: [new Paragraph({ children: [new TextRun({ text: "Contractor Name:", bold: true, size: 18 }), new TextRun({ text: ` ${record.contractor || "N/A"}`, size: 18 })] })],
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                borders: { top: borderStyleThin, bottom: borderStyleThick, left: borderStyleThick, right: borderStyleThin },
                children: [new Paragraph({ children: [new TextRun({ text: "Location / Chainage:", bold: true, size: 18 }), new TextRun({ text: ` ${record.location || "N/A"}`, size: 18 })] })],
              }),
              new TableCell({
                borders: { top: borderStyleThin, bottom: borderStyleThick, left: borderStyleThin, right: borderStyleThick },
                children: [new Paragraph({ children: [new TextRun({ text: "Item/Element Reference:", bold: true, size: 18 }), new TextRun({ text: ` ${record.item || "N/A"}`, size: 18 })] })],
              }),
            ],
          }),
        ],
      });

      docChildren.push(projectMetaTable);
      docChildren.push(new Paragraph({ text: "" })); // Spacing

      // 3. FORM CUSTOM FIELDS SECTION
      if (template.customFields && template.customFields.length > 0) {
        docChildren.push(
          new Paragraph({
            children: [new TextRun({ text: "TECHNICAL SPECIFICATIONS & OBSERVATIONS", bold: true, size: 20, color: "111827" })],
            heading: HeadingLevel.HEADING_2,
          })
        );

        const specRows: TableRow[] = [];
        // Chunk custom fields into pairs
        for (let i = 0; i < template.customFields.length; i += 2) {
          const field1 = template.customFields[i];
          const field2 = template.customFields[i + 1];

          const val1 = record.fields[field1.name] !== undefined ? String(record.fields[field1.name]) : "N/A";
          const val2 = field2 ? (record.fields[field2.name] !== undefined ? String(record.fields[field2.name]) : "N/A") : "";

          specRows.push(
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 25, type: WidthType.PERCENTAGE },
                  borders: { top: borderStyleThin, bottom: borderStyleThin, left: borderStyleThick, right: borderStyleThin },
                  children: [new Paragraph({ children: [new TextRun({ text: field1.label, bold: true, size: 16 })] })],
                }),
                new TableCell({
                  width: { size: 25, type: WidthType.PERCENTAGE },
                  borders: { top: borderStyleThin, bottom: borderStyleThin, left: borderStyleThin, right: borderStyleThin },
                  children: [new Paragraph({ children: [new TextRun({ text: val1, size: 16 })] })],
                }),
                new TableCell({
                  width: { size: 25, type: WidthType.PERCENTAGE },
                  borders: { top: borderStyleThin, bottom: borderStyleThin, left: borderStyleThin, right: borderStyleThin },
                  children: [new Paragraph({ children: [new TextRun({ text: field2 ? field2.label : "", bold: true, size: 16 })] })],
                }),
                new TableCell({
                  width: { size: 25, type: WidthType.PERCENTAGE },
                  borders: { top: borderStyleThin, bottom: borderStyleThin, left: borderStyleThin, right: borderStyleThick },
                  children: [new Paragraph({ children: [new TextRun({ text: val2, size: 16 })] })],
                }),
              ],
            })
          );
        }

        const specTable = new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: specRows,
        });

        docChildren.push(specTable);
        docChildren.push(new Paragraph({ text: "" })); // Spacing
      }

      // 4. CHECKLIST TABLE
      docChildren.push(
        new Paragraph({
          children: [new TextRun({ text: "QUALITY ASSURANCE INSPECTION CHECKLIST", bold: true, size: 20, color: "111827" })],
          heading: HeadingLevel.HEADING_2,
        })
      );

      const hasMeasurements = template.hasMeasurementColumns;
      const checklistHeaders = [
        new TableCell({
          width: { size: hasMeasurements ? 50 : 60, type: WidthType.PERCENTAGE },
          shading: { fill: "F3F4F6" },
          borders: { top: borderStyleThick, bottom: borderStyleThick, left: borderStyleThick, right: borderStyleThin },
          children: [new Paragraph({ children: [new TextRun({ text: "Operation / Inspection Item", bold: true, size: 16 })] })],
        }),
      ];

      if (hasMeasurements) {
        checklistHeaders.push(
          new TableCell({
            width: { size: 12, type: WidthType.PERCENTAGE },
            shading: { fill: "F3F4F6" },
            borders: { top: borderStyleThick, bottom: borderStyleThick, left: borderStyleThin, right: borderStyleThin },
            children: [new Paragraph({ children: [new TextRun({ text: "Specified", bold: true, size: 16 })], alignment: AlignmentType.CENTER })],
          }),
          new TableCell({
            width: { size: 12, type: WidthType.PERCENTAGE },
            shading: { fill: "F3F4F6" },
            borders: { top: borderStyleThick, bottom: borderStyleThick, left: borderStyleThin, right: borderStyleThin },
            children: [new Paragraph({ children: [new TextRun({ text: "Actual", bold: true, size: 16 })], alignment: AlignmentType.CENTER })],
          })
        );
      }

      checklistHeaders.push(
        new TableCell({
          width: { size: 8, type: WidthType.PERCENTAGE },
          shading: { fill: "F3F4F6" },
          borders: { top: borderStyleThick, bottom: borderStyleThick, left: borderStyleThin, right: borderStyleThin },
          children: [new Paragraph({ children: [new TextRun({ text: "Yes", bold: true, size: 16 })], alignment: AlignmentType.CENTER })],
        }),
        new TableCell({
          width: { size: 8, type: WidthType.PERCENTAGE },
          shading: { fill: "F3F4F6" },
          borders: { top: borderStyleThick, bottom: borderStyleThick, left: borderStyleThin, right: borderStyleThin },
          children: [new Paragraph({ children: [new TextRun({ text: "No", bold: true, size: 16 })], alignment: AlignmentType.CENTER })],
        }),
        new TableCell({
          width: { size: 8, type: WidthType.PERCENTAGE },
          shading: { fill: "F3F4F6" },
          borders: { top: borderStyleThick, bottom: borderStyleThick, left: borderStyleThin, right: borderStyleThin },
          children: [new Paragraph({ children: [new TextRun({ text: "N/A", bold: true, size: 16 })], alignment: AlignmentType.CENTER })],
        }),
        new TableCell({
          width: { size: hasMeasurements ? 14 : 16, type: WidthType.PERCENTAGE },
          shading: { fill: "F3F4F6" },
          borders: { top: borderStyleThick, bottom: borderStyleThick, left: borderStyleThin, right: borderStyleThick },
          children: [new Paragraph({ children: [new TextRun({ text: "Comments / Remarks", bold: true, size: 16 })] })],
        })
      );

      const checklistTableRows: TableRow[] = [
        new TableRow({ children: checklistHeaders }),
      ];

      record.checklistRows.forEach((row) => {
        const rowCells = [
          new TableCell({
            borders: { top: borderStyleThin, bottom: borderStyleThin, left: borderStyleThick, right: borderStyleThin },
            children: [new Paragraph({ children: [new TextRun({ text: row.item, size: 16 })] })],
          }),
        ];

        if (hasMeasurements) {
          rowCells.push(
            new TableCell({
              borders: { top: borderStyleThin, bottom: borderStyleThin, left: borderStyleThin, right: borderStyleThin },
              children: [new Paragraph({ children: [new TextRun({ text: row.specified || "-", size: 16 })], alignment: AlignmentType.CENTER })],
            }),
            new TableCell({
              borders: { top: borderStyleThin, bottom: borderStyleThin, left: borderStyleThin, right: borderStyleThin },
              children: [new Paragraph({ children: [new TextRun({ text: row.actual || "-", size: 16 })], alignment: AlignmentType.CENTER })],
            })
          );
        }

        rowCells.push(
          new TableCell({
            borders: { top: borderStyleThin, bottom: borderStyleThin, left: borderStyleThin, right: borderStyleThin },
            children: [new Paragraph({ children: [new TextRun({ text: row.acceptable === "Yes" ? "✓" : "", bold: true, size: 16 })], alignment: AlignmentType.CENTER })],
          }),
          new TableCell({
            borders: { top: borderStyleThin, bottom: borderStyleThin, left: borderStyleThin, right: borderStyleThin },
            children: [new Paragraph({ children: [new TextRun({ text: row.acceptable === "No" ? "✗" : "", bold: true, size: 16 })], alignment: AlignmentType.CENTER })],
          }),
          new TableCell({
            borders: { top: borderStyleThin, bottom: borderStyleThin, left: borderStyleThin, right: borderStyleThin },
            children: [new Paragraph({ children: [new TextRun({ text: row.acceptable === "N/A" ? "N/A" : "", size: 16 })], alignment: AlignmentType.CENTER })],
          }),
          new TableCell({
            borders: { top: borderStyleThin, bottom: borderStyleThin, left: borderStyleThin, right: borderStyleThick },
            children: [new Paragraph({ children: [new TextRun({ text: row.comments || "", size: 16 })] })],
          })
        );

        checklistTableRows.push(new TableRow({ children: rowCells }));
      });

      const checklistTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: checklistTableRows,
      });

      docChildren.push(checklistTable);
      docChildren.push(new Paragraph({ text: "" })); // Spacing

      // 5. SIGNATURE & SIGNOFF FIELD TABLE
      docChildren.push(
        new Paragraph({
          children: [new TextRun({ text: "APPROVALS & AUTHORIZATION SIGNOFF", bold: true, size: 20, color: "111827" })],
          heading: HeadingLevel.HEADING_2,
        })
      );

      const signoffTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: { top: borderStyleThick, bottom: borderStyleThick, left: borderStyleThick, right: borderStyleThin },
                children: [
                  new Paragraph({ children: [new TextRun({ text: "CONTRACTOR REPRESENTATIVE", bold: true, size: 16, color: "4B5563" })] }),
                  new Paragraph({ text: "" }),
                  new Paragraph({ children: [new TextRun({ text: "Name: ", bold: true, size: 16 }), new TextRun({ text: record.contractorSignatureName || "_______________________", size: 16 })] }),
                  new Paragraph({ children: [new TextRun({ text: "Signature: ", bold: true, size: 16 }), new TextRun({ text: record.contractorSignatureName ? "[SIGNED CLIENT-SIDE]" : "_______________________", size: 16, color: "888888" })] }),
                  new Paragraph({ children: [new TextRun({ text: "Date: ", bold: true, size: 16 }), new TextRun({ text: record.signoffDate || "_______________________", size: 16 })] }),
                ],
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: { top: borderStyleThick, bottom: borderStyleThick, left: borderStyleThin, right: borderStyleThick },
                children: [
                  new Paragraph({ children: [new TextRun({ text: "RESIDENT ENGINEER / RE", bold: true, size: 16, color: "4B5563" })] }),
                  new Paragraph({ text: "" }),
                  new Paragraph({ children: [new TextRun({ text: "Name: ", bold: true, size: 16 }), new TextRun({ text: record.residentEngineerSignatureName || "_______________________", size: 16 })] }),
                  new Paragraph({ children: [new TextRun({ text: "Signature: ", bold: true, size: 16 }), new TextRun({ text: record.residentEngineerSignatureName ? "[APPROVED CLIENT-SIDE]" : "_______________________", size: 16, color: "888888" })] }),
                  new Paragraph({ children: [new TextRun({ text: "Date: ", bold: true, size: 16 }), new TextRun({ text: record.signoffDate || "_______________________", size: 16 })] }),
                ],
              }),
            ],
          }),
        ],
      });

      docChildren.push(signoffTable);

      // Create doc
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: docChildren,
          },
        ],
      });

      // Generate filename: QC_[Form_Title]_[Project]_[Date].docx
      const cleanTitle = template.title.replace(/[^a-zA-Z0-9]/g, "_");
      const cleanProject = (record.projectName || "Project").replace(/[^a-zA-Z0-9]/g, "_");
      const dateStr = record.signoffDate || new Date().toISOString().split("T")[0];
      const filename = `QC_${cleanTitle}_${cleanProject}_${dateStr}.docx`;

      Packer.toBlob(doc).then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        resolve({ blob, filename });
      }).catch((packerErr) => {
        console.error("Packer error", packerErr);
        reject(packerErr);
      });
    } catch (err) {
      console.error("DOCX generation crash", err);
      reject(err);
    }
  });
}
