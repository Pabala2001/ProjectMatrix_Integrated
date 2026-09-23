import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  HeadingLevel,
} from "docx";
import { AdvisorDraft } from "../types/projectAdvisor";

const NAVY_COLOR = "07182E";
const ORANGE_COLOR = "FF9F1C";
const TEXT_MUTED = "64748B";
const ROW_ALT_BG = "F8FAFC";

const cellBorders = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
};

export async function generateAdvisorDraftDocx(
  draft: AdvisorDraft,
  companyName: string = "ProjectMatrix Enterprise",
  projectName: string = "All Projects"
): Promise<Blob> {
  const children: any[] = [];

  // Header Table / Branding Banner
  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { fill: NAVY_COLOR },
            margins: { top: 180, bottom: 180, left: 240, right: 240 },
            borders: cellBorders,
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [
                  new TextRun({
                    text: "PROJECTMATRIX  |  MANAGEMENT ADVISOR DRAFT",
                    bold: true,
                    size: 18,
                    color: ORANGE_COLOR,
                    font: "Arial",
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.LEFT,
                spacing: { before: 60 },
                children: [
                  new TextRun({
                    text: draft.title.toUpperCase(),
                    bold: true,
                    size: 26,
                    color: "FFFFFF",
                    font: "Arial",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  children.push(headerTable);

  // Metadata Box
  const metadataTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            shading: { fill: ROW_ALT_BG },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            borders: cellBorders,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Organization:", bold: true, size: 18, font: "Arial" }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            borders: cellBorders,
            children: [
              new Paragraph({
                children: [new TextRun({ text: companyName, size: 18, font: "Arial" })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            shading: { fill: ROW_ALT_BG },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            borders: cellBorders,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Project Context:", bold: true, size: 18, font: "Arial" }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            borders: cellBorders,
            children: [
              new Paragraph({
                children: [new TextRun({ text: projectName, size: 18, font: "Arial" })],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            shading: { fill: ROW_ALT_BG },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            borders: cellBorders,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Document Category:", bold: true, size: 18, font: "Arial" }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            borders: cellBorders,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: (draft.document_type || "report").toUpperCase().replace(/_/g, " "),
                    size: 18,
                    bold: true,
                    color: NAVY_COLOR,
                    font: "Arial",
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            shading: { fill: ROW_ALT_BG },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            borders: cellBorders,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Date Generated:", bold: true, size: 18, font: "Arial" }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            borders: cellBorders,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: new Date().toLocaleDateString("en-ZA", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }),
                    size: 18,
                    font: "Arial",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  children.push(new Paragraph({ spacing: { before: 200 } }));
  children.push(metadataTable);
  children.push(new Paragraph({ spacing: { before: 300 } }));

  // Parse Markdown Content into Document Paragraphs
  const markdownLines = (draft.content_markdown || "").split("\n");

  for (let i = 0; i < markdownLines.length; i++) {
    const line = markdownLines[i].trim();
    if (!line) {
      children.push(new Paragraph({ spacing: { before: 120 } }));
      continue;
    }

    if (line.startsWith("# ")) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 300, after: 120 },
          children: [
            new TextRun({
              text: line.replace("# ", "").trim(),
              bold: true,
              size: 28,
              color: NAVY_COLOR,
              font: "Arial",
            }),
          ],
        })
      );
    } else if (line.startsWith("## ")) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 100 },
          children: [
            new TextRun({
              text: line.replace("## ", "").trim(),
              bold: true,
              size: 24,
              color: NAVY_COLOR,
              font: "Arial",
            }),
          ],
        })
      );
    } else if (line.startsWith("### ")) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 180, after: 80 },
          children: [
            new TextRun({
              text: line.replace("### ", "").trim(),
              bold: true,
              size: 20,
              color: ORANGE_COLOR,
              font: "Arial",
            }),
          ],
        })
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      const clean = line.replace(/^[-*]\s+/, "");
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { before: 40, after: 40 },
          children: parseFormattedTextRuns(clean),
        })
      );
    } else if (/^\d+\.\s+/.test(line)) {
      const clean = line.replace(/^\d+\.\s+/, "");
      children.push(
        new Paragraph({
          spacing: { before: 60, after: 60 },
          children: [
            new TextRun({ text: "• ", bold: true, color: ORANGE_COLOR }),
            ...parseFormattedTextRuns(clean),
          ],
        })
      );
    } else {
      children.push(
        new Paragraph({
          spacing: { before: 60, after: 60 },
          children: parseFormattedTextRuns(line),
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: "ProjectMatrix Advisor | Confidential Document Draft",
                    size: 16,
                    color: TEXT_MUTED,
                    font: "Arial",
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "Page ",
                    size: 16,
                    color: TEXT_MUTED,
                    font: "Arial",
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: TEXT_MUTED,
                    font: "Arial",
                  }),
                  new TextRun({
                    text: " of ",
                    size: 16,
                    color: TEXT_MUTED,
                    font: "Arial",
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    color: TEXT_MUTED,
                    font: "Arial",
                  }),
                ],
              }),
            ],
          }),
        },
        children: children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}

function parseFormattedTextRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);

  for (const part of parts) {
    if (!part) continue;

    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(
        new TextRun({
          text: part.slice(2, -2),
          bold: true,
          size: 20,
          font: "Arial",
        })
      );
    } else if (part.startsWith("*") && part.endsWith("*")) {
      runs.push(
        new TextRun({
          text: part.slice(1, -1),
          italics: true,
          size: 20,
          font: "Arial",
        })
      );
    } else if (part.startsWith("`") && part.endsWith("`")) {
      runs.push(
        new TextRun({
          text: part.slice(1, -1),
          color: NAVY_COLOR,
          size: 19,
          font: "Consolas",
        })
      );
    } else {
      runs.push(
        new TextRun({
          text: part,
          size: 20,
          font: "Arial",
        })
      );
    }
  }

  return runs;
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
