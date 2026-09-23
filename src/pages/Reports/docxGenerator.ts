import { assertOperationalAction } from "../../integration/operationalAccess";
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
  ImageRun
} from "docx";
import { ReportFormData } from "./types";
import { supabase } from "../../lib/supabase";

const NAVY_COLOR = "07182E";
const ORANGE_COLOR = "FF9F1C";
const ROW_ALT_BG = "F8FAFC";

const cellBorders = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
};

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const base64Clean = base64.replace(/^data:image\/[^;]+;base64,/, "").trim();
  const binaryString = window.atob(base64Clean);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") {
      resolve({ width: 0, height: 0 });
      return;
    }
    const img = document.createElement("img");
    img.onload = () => resolve({ width: img.naturalWidth || img.width || 0, height: img.naturalHeight || img.height || 0 });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = dataUrl;
  });
}

async function prepareImageForDocx(
  imgStr?: string,
  options: { maxWidth?: number; maxHeight?: number } = {}
): Promise<{ buffer: ArrayBuffer; width: number; height: number } | null> {
  if (!imgStr || typeof imgStr !== "string" || !imgStr.trim()) {
    return null;
  }

  const maxWidth = options.maxWidth || 160;
  const maxHeight = options.maxHeight || 80;

  try {
    let dataUrl = imgStr;

    // If string is a storage path (not data URL and not remote URL)
    if (!imgStr.startsWith("data:") && !imgStr.startsWith("http:") && !imgStr.startsWith("https:") && !imgStr.startsWith("blob:")) {
      let downloadedBlob: Blob | null = null;
      const bucketsToTry = ["report-images", "reports"];

      for (const bucket of bucketsToTry) {
        try {
          const { data, error } = await supabase.storage.from(bucket).download(imgStr);
          if (data && !error) {
            downloadedBlob = data;
            break;
          }
        } catch (e) {
          // continue
        }
      }

      if (!downloadedBlob) {
        for (const bucket of bucketsToTry) {
          try {
            const { data } = await supabase.storage.from(bucket).createSignedUrl(imgStr, 3600);
            if (data?.signedUrl) {
              const res = await fetch(data.signedUrl);
              if (res.ok) {
                downloadedBlob = await res.blob();
                break;
              }
            }
          } catch (e) {
            // continue
          }
        }
      }

      if (downloadedBlob) {
        dataUrl = await blobToDataUrl(downloadedBlob);
      } else {
        console.warn("Could not download storage path image for report docx:", imgStr);
        return null;
      }
    } else if (imgStr.startsWith("http:") || imgStr.startsWith("https:") || imgStr.startsWith("blob:")) {
      try {
        const res = await fetch(imgStr);
        if (res.ok) {
          const blob = await res.blob();
          dataUrl = await blobToDataUrl(blob);
        }
      } catch (e) {
        console.warn("Could not fetch remote image URL for report docx:", imgStr);
      }
    }

    if (!dataUrl || !dataUrl.startsWith("data:image")) {
      return null;
    }

    const dims = await getImageDimensions(dataUrl);
    const buffer = base64ToArrayBuffer(dataUrl);

    let width = dims.width || maxWidth;
    let height = dims.height || maxHeight;

    if (width > 0 && height > 0) {
      const scale = Math.min(maxWidth / width, maxHeight / height, 1);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    } else {
      width = maxWidth;
      height = maxHeight;
    }

    return { buffer, width, height };
  } catch (err) {
    console.error("prepareImageForDocx error:", err);
    return null;
  }
}

function createTextCell(
  text: string,
  options?: { bold?: boolean; shading?: string; widthPct?: number; color?: string }
): TableCell {
    assertOperationalAction("create", "pages/Reports/docxGenerator.ts");
  const children = text.split("\n").map(
    (line) =>
      new Paragraph({
        children: [
          new TextRun({
            text: line,
            bold: options?.bold || false,
            color: options?.color || "1E293B",
            size: 18, // 9pt
            font: "Inter",
          }),
        ],
      })
  );

  return new TableCell({
    borders: cellBorders,
    shading: options?.shading ? { fill: options.shading } : undefined,
    width: options?.widthPct ? { size: options.widthPct, type: WidthType.PERCENTAGE } : undefined,
    margins: { top: 120, bottom: 120, left: 160, right: 160 },
    children,
  });
}

export async function generateTechnicalReportDocx(data: ReportFormData): Promise<Blob> {
  // 1. Resolve images asynchronously
  const companyLogoImg = await prepareImageForDocx(data.company_logo, { maxWidth: 160, maxHeight: 80 });
  const clientLogoImg = await prepareImageForDocx(data.client_logo, { maxWidth: 160, maxHeight: 80 });
  const prepSigImg = await prepareImageForDocx(data.doc_control?.prepared_by_signature, { maxWidth: 140, maxHeight: 60 });
  const revSigImg = await prepareImageForDocx(data.doc_control?.reviewed_by_signature, { maxWidth: 140, maxHeight: 60 });

  // Resolve site pictures if any
  const sitePicImgs: { caption?: string; img: { buffer: ArrayBuffer; width: number; height: number } }[] = [];
  if (data.site_pictures && data.site_pictures.length > 0) {
    for (const pic of data.site_pictures) {
      if (pic.image) {
        const resolved = await prepareImageForDocx(pic.image, { maxWidth: 240, maxHeight: 180 });
        if (resolved) {
          sitePicImgs.push({
            caption: pic.caption || pic.notes,
            img: resolved
          });
        }
      }
    }
  }

  // 2. Build Cover Elements
  const coverElements: any[] = [
    new Paragraph({ children: [new TextRun("")] }),
    new Paragraph({ children: [new TextRun("")] }),
  ];

  const logoChildren: any[] = [];
  if (companyLogoImg) {
    logoChildren.push(
      new ImageRun({
        data: companyLogoImg.buffer,
        transformation: {
          width: companyLogoImg.width,
          height: companyLogoImg.height,
        },
      } as any)
    );
  }
  if (clientLogoImg) {
    if (logoChildren.length > 0) {
      logoChildren.push(new TextRun("\t\t\t\t\t\t")); // spacing tabs
    }
    logoChildren.push(
      new ImageRun({
        data: clientLogoImg.buffer,
        transformation: {
          width: clientLogoImg.width,
          height: clientLogoImg.height,
        },
      } as any)
    );
  }

  if (logoChildren.length > 0) {
    coverElements.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: logoChildren,
      })
    );
  }

  coverElements.push(
    new Paragraph({ children: [new TextRun("")] }),
    new Paragraph({ children: [new TextRun("")] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: (data.contractor_name || "CONTRACTOR").toUpperCase(),
          bold: true,
          size: 24, // 12pt
          color: ORANGE_COLOR,
          font: "Inter",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: (data.report_title || `${data.category} ${data.frequency} Report`).toUpperCase(),
          bold: true,
          size: 48, // 24pt
          color: NAVY_COLOR,
          font: "Inter",
        }),
      ],
    }),
    new Paragraph({ children: [new TextRun("")] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Report Number: ${data.report_number || "N/A"}`,
          bold: true,
          size: 28, // 14pt
          color: "475569",
          font: "Inter",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Date: ${data.report_date || new Date().toISOString().split("T")[0]}`,
          bold: true,
          size: 24, // 12pt
          color: "475569",
          font: "Inter",
        }),
      ],
    }),
    new Paragraph({ children: [new TextRun("")] }),
    new Paragraph({ children: [new TextRun("")] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "PROJECT METADATA",
          bold: true,
          size: 18,
          color: "94A3B8",
          font: "Inter",
        }),
      ],
    }),
    new Paragraph({ children: [new TextRun("")] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "PROJECT FOCUS:\n",
          bold: true,
          size: 20,
          color: "64748B",
          font: "Inter",
        }),
        new TextRun({
          text: data.project_name || "Project Name",
          bold: true,
          size: 26,
          color: NAVY_COLOR,
          font: "Inter",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Contract Number: ${data.contract_number || "N/A"}\n`,
          bold: true,
          size: 22,
          color: "334155",
          font: "Inter",
        }),
        new TextRun({
          text: `Client: ${data.client_name || "Client Representative"}`,
          bold: true,
          size: 22,
          color: "334155",
          font: "Inter",
        }),
      ],
    }),
    new Paragraph({ children: [new TextRun("")] }),
    new Paragraph({ children: [new TextRun("")] })
  );

  // 3. Main Document Section Elements
  const mainElements: any[] = [
    // Document Control Sheet Title
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [
        new TextRun({
          text: "DOCUMENT CONTROL SHEET",
          bold: true,
          size: 28,
          color: NAVY_COLOR,
          font: "Inter",
        }),
      ],
    }),
    new Paragraph({ children: [new TextRun("")] }),

    // Document Control Table
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            createTextCell("Revision", { bold: true, shading: ROW_ALT_BG, widthPct: 20 }),
            createTextCell("Date", { bold: true, shading: ROW_ALT_BG, widthPct: 20 }),
            createTextCell("Prepared By", { bold: true, shading: ROW_ALT_BG, widthPct: 20 }),
            createTextCell("Reviewed By", { bold: true, shading: ROW_ALT_BG, widthPct: 20 }),
            createTextCell("Approved By", { bold: true, shading: ROW_ALT_BG, widthPct: 20 }),
          ],
        }),
        new TableRow({
          children: [
            createTextCell(data.doc_control?.revision_number || "00"),
            createTextCell(data.doc_control?.revision_date || data.report_date),
            createTextCell(data.doc_control?.prepared_by || data.doc_control?.prepared_print_name || data.contractor_name),
            createTextCell(data.doc_control?.reviewed_by || data.doc_control?.reviewed_print_name || "Project Manager"),
            createTextCell(data.doc_control?.approved_by || data.client_name),
          ],
        }),
      ],
    }),
    new Paragraph({ children: [new TextRun("")] }),
    new Paragraph({ children: [new TextRun("")] }),

    // Approvals & Signatures Section
    new Paragraph({
      children: [
        new TextRun({
          text: "Approvals & Signatures",
          bold: true,
          size: 22,
          color: NAVY_COLOR,
          font: "Inter",
        }),
      ],
    }),
    new Paragraph({ children: [new TextRun("")] }),

    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            createTextCell("Role", { bold: true, shading: ROW_ALT_BG, widthPct: 20 }),
            createTextCell("Print Name & Title", { bold: true, shading: ROW_ALT_BG, widthPct: 40 }),
            createTextCell("Signature", { bold: true, shading: ROW_ALT_BG, widthPct: 20 }),
            createTextCell("Date", { bold: true, shading: ROW_ALT_BG, widthPct: 20 }),
          ],
        }),
        new TableRow({
          children: [
            createTextCell("Prepared By", { bold: true }),
            createTextCell(`${data.doc_control?.prepared_print_name || "Prepared By"}\n${data.doc_control?.prepared_title || "Site Engineer"}`),
            new TableCell({
              borders: cellBorders,
              children: prepSigImg
                ? [
                    new Paragraph({
                      children: [
                        new ImageRun({
                          data: prepSigImg.buffer,
                          transformation: { width: prepSigImg.width, height: prepSigImg.height },
                        } as any),
                      ],
                    }),
                  ]
                : [new Paragraph({ children: [new TextRun("")] })],
            }),
            createTextCell(data.doc_control?.prepared_date || data.report_date),
          ],
        }),
        new TableRow({
          children: [
            createTextCell("Reviewed By", { bold: true }),
            createTextCell(`${data.doc_control?.reviewed_print_name || "Reviewed By"}\n${data.doc_control?.reviewed_title || "Project Manager"}`),
            new TableCell({
              borders: cellBorders,
              children: revSigImg
                ? [
                    new Paragraph({
                      children: [
                        new ImageRun({
                          data: revSigImg.buffer,
                          transformation: { width: revSigImg.width, height: revSigImg.height },
                        } as any),
                      ],
                    }),
                  ]
                : [new Paragraph({ children: [new TextRun("")] })],
            }),
            createTextCell(data.doc_control?.reviewed_date || data.report_date),
          ],
        }),
      ],
    }),

    // Page Break before main report body
    new Paragraph({ pageBreakBefore: true }),

    // Executive Summary / Introduction
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 100 },
      children: [new TextRun({ text: "1. Executive Summary & Overview", bold: true, size: 24, color: NAVY_COLOR })],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: data.introduction || "No summary provided." })],
    }),
  ];

  // Weekly Achievements Table
  if (data.frequency === "Weekly" && data.weekly_achievements && data.weekly_achievements.length > 0) {
    mainElements.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 100 },
        children: [new TextRun({ text: "2. Weekly Physical Achievements", bold: true, size: 24, color: NAVY_COLOR })],
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              createTextCell("Task Description", { bold: true, shading: ROW_ALT_BG, widthPct: 35 }),
              createTextCell("Location", { bold: true, shading: ROW_ALT_BG, widthPct: 20 }),
              createTextCell("Planned Qty", { bold: true, shading: ROW_ALT_BG, widthPct: 15 }),
              createTextCell("Actual Qty", { bold: true, shading: ROW_ALT_BG, widthPct: 15 }),
              createTextCell("% Complete", { bold: true, shading: ROW_ALT_BG, widthPct: 15 }),
            ],
          }),
          ...data.weekly_achievements.map((wa) =>
            new TableRow({
              children: [
                createTextCell(wa.task_description || "-"),
                createTextCell(wa.location_section || "-"),
                createTextCell(`${wa.planned_qty || '0'} ${wa.unit || ''}`),
                createTextCell(`${wa.actual_qty || '0'} ${wa.unit || ''}`),
                createTextCell(wa.completion_pct || "0%"),
              ],
            })
          ),
        ],
      }),
      new Paragraph({ text: "", spacing: { after: 200 } })
    );
  }

  // Planned vs Actual Progress (Weekly)
  if (data.frequency === "Weekly" && data.planned_vs_actual) {
    mainElements.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 100 },
        children: [new TextRun({ text: "3. Weekly Planned vs Actual Progress Summary", bold: true, size: 24, color: NAVY_COLOR })],
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              createTextCell(`Weekly Planned: ${data.planned_vs_actual.planned_pct || '0%'}`, { bold: true, widthPct: 50 }),
              createTextCell(`Weekly Actual: ${data.planned_vs_actual.actual_pct || '0%'}`, { bold: true, widthPct: 50 }),
            ],
          }),
          new TableRow({
            children: [
              createTextCell(`Cumulative Planned: ${data.planned_vs_actual.cumulative_planned_pct || '0%'}`, { bold: true, widthPct: 50 }),
              createTextCell(`Cumulative Actual: ${data.planned_vs_actual.cumulative_actual_pct || '0%'}`, { bold: true, widthPct: 50 }),
            ],
          }),
        ],
      }),
      new Paragraph({ text: "", spacing: { after: 200 } })
    );
  }

  // Monthly Milestones (Monthly Reports)
  if (data.frequency === "Monthly" && data.monthly_milestones && data.monthly_milestones.length > 0) {
    mainElements.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 100 },
        children: [new TextRun({ text: "2. Monthly Key Milestones", bold: true, size: 24, color: NAVY_COLOR })],
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              createTextCell("Milestone Name", { bold: true, shading: ROW_ALT_BG, widthPct: 40 }),
              createTextCell("Target Date", { bold: true, shading: ROW_ALT_BG, widthPct: 20 }),
              createTextCell("Status", { bold: true, shading: ROW_ALT_BG, widthPct: 20 }),
              createTextCell("% Complete", { bold: true, shading: ROW_ALT_BG, widthPct: 20 }),
            ],
          }),
          ...data.monthly_milestones.map((m) =>
            new TableRow({
              children: [
                createTextCell(m.milestone_name || "-"),
                createTextCell(m.target_date || "-"),
                createTextCell(m.status || "Ongoing"),
                createTextCell(m.completion_pct || "0%"),
              ],
            })
          ),
        ],
      }),
      new Paragraph({ text: "", spacing: { after: 200 } })
    );
  }

  // Major Risks & Delays (Monthly Reports)
  if (data.frequency === "Monthly" && data.major_risks_and_delays && data.major_risks_and_delays.length > 0) {
    mainElements.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 100 },
        children: [new TextRun({ text: "3. Major Project Risks & Delays Log", bold: true, size: 24, color: NAVY_COLOR })],
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              createTextCell("Risk Description", { bold: true, shading: ROW_ALT_BG, widthPct: 35 }),
              createTextCell("Impact", { bold: true, shading: ROW_ALT_BG, widthPct: 15 }),
              createTextCell("Mitigation Action", { bold: true, shading: ROW_ALT_BG, widthPct: 35 }),
              createTextCell("Owner", { bold: true, shading: ROW_ALT_BG, widthPct: 15 }),
            ],
          }),
          ...data.major_risks_and_delays.map((r) =>
            new TableRow({
              children: [
                createTextCell(r.risk_description || "-"),
                createTextCell(r.impact_level || "Medium"),
                createTextCell(r.mitigation_action || "-"),
                createTextCell(r.owner || "-"),
              ],
            })
          ),
        ],
      }),
      new Paragraph({ text: "", spacing: { after: 200 } })
    );
  }

  // Environmental Metrics
  if (data.category === "Environmental" && data.environmental_metrics) {
    mainElements.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 100 },
        children: [new TextRun({ text: "2. Environmental Compliance & Metrics", bold: true, size: 24, color: NAVY_COLOR })],
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              createTextCell(`Waste Disposed (kg): ${data.environmental_metrics.waste_disposed_kg || '0'}`, { bold: true, widthPct: 50 }),
              createTextCell(`Water Consumption (L): ${data.environmental_metrics.water_consumption_litres || '0'}`, { bold: true, widthPct: 50 }),
            ],
          }),
          new TableRow({
            children: [
              createTextCell(`Air Quality Status: ${data.environmental_metrics.air_quality_status || 'Compliant'}`, { bold: true, widthPct: 50 }),
              createTextCell(`Noise Level Status: ${data.environmental_metrics.noise_level_status || 'Compliant'}`, { bold: true, widthPct: 50 }),
            ],
          }),
        ],
      }),
      new Paragraph({ text: "", spacing: { after: 200 } })
    );
  }

  // OHS Metrics
  if (data.category === "Occupational Health and Safety" && data.ohs_metrics) {
    mainElements.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 100 },
        children: [new TextRun({ text: "2. Occupational Health & Safety (OHS) Metrics", bold: true, size: 24, color: NAVY_COLOR })],
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              createTextCell(`Safe Man Hours: ${data.ohs_metrics.safe_man_hours || '0'}`, { bold: true, widthPct: 50 }),
              createTextCell(`Near Misses: ${data.ohs_metrics.near_misses_count || '0'}`, { bold: true, widthPct: 50 }),
            ],
          }),
          new TableRow({
            children: [
              createTextCell(`First Aid Incidents: ${data.ohs_metrics.first_aid_incidents || '0'}`, { bold: true, widthPct: 50 }),
              createTextCell(`PPE Compliance: ${data.ohs_metrics.ppe_compliance_pct || '100%'}`, { bold: true, widthPct: 50 }),
            ],
          }),
        ],
      }),
      new Paragraph({ text: "", spacing: { after: 200 } })
    );
  }

  // Activities Log
  mainElements.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 100 },
      children: [new TextRun({ text: "Technical Activities & Operational Log", bold: true, size: 24, color: NAVY_COLOR })],
    })
  );

  if (data.technical_activities && data.technical_activities.length > 0) {
    mainElements.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              createTextCell("Activity Description", { bold: true, shading: ROW_ALT_BG, widthPct: 60 }),
              createTextCell("Quantity", { bold: true, shading: ROW_ALT_BG, widthPct: 20 }),
              createTextCell("Status", { bold: true, shading: ROW_ALT_BG, widthPct: 20 }),
            ],
          }),
          ...data.technical_activities.map((act) =>
            new TableRow({
              children: [
                createTextCell(act.description || "-"),
                createTextCell(`${act.quantity || "1"} ${act.unit || ""}`),
                createTextCell(act.status || "Ongoing"),
              ],
            })
          ),
        ],
      })
    );
  } else {
    mainElements.push(new Paragraph({ text: "No activities recorded for this report period." }));
  }

  // Site Photographs Gallery (if any)
  if (sitePicImgs.length > 0) {
    mainElements.push(
      new Paragraph({ text: "", spacing: { after: 200 } }),
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 100 },
        children: [new TextRun({ text: "Site Photographs & Progress Visuals", bold: true, size: 24, color: NAVY_COLOR })],
      })
    );

    const picRows: TableRow[] = [];
    for (let i = 0; i < sitePicImgs.length; i += 2) {
      const pic1 = sitePicImgs[i];
      const pic2 = sitePicImgs[i + 1];

      const cells: TableCell[] = [
        new TableCell({
          borders: cellBorders,
          width: { size: 50, type: WidthType.PERCENTAGE },
          margins: { top: 120, bottom: 120, left: 160, right: 160 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  data: pic1.img.buffer,
                  transformation: { width: pic1.img.width, height: pic1.img.height },
                } as any),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: pic1.caption || "Site Photograph",
                  size: 16,
                  color: "475569",
                  font: "Inter",
                }),
              ],
            }),
          ],
        }),
      ];

      if (pic2) {
        cells.push(
          new TableCell({
            borders: cellBorders,
            width: { size: 50, type: WidthType.PERCENTAGE },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new ImageRun({
                    data: pic2.img.buffer,
                    transformation: { width: pic2.img.width, height: pic2.img.height },
                  } as any),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: pic2.caption || "Site Photograph",
                    size: 16,
                    color: "475569",
                    font: "Inter",
                  }),
                ],
              }),
            ],
          })
        );
      } else {
        cells.push(
          new TableCell({
            borders: cellBorders,
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun("")] })],
          })
        );
      }

      picRows.push(new TableRow({ children: cells }));
    }

    mainElements.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: picRows,
      })
    );
  }

  // 4. Construct Document
  const doc = new Document({
    sections: [
      // Section 1: Cover Page
      {
        properties: {},
        children: coverElements,
      },
      // Section 2: Document Control & Main Content
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              bottom: 1440,
              left: 1440,
              right: 1440,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `${data.project_name || "Project"} | ${data.category} ${data.frequency} Report ${data.report_number || ""}`,
                    size: 16,
                    color: "64748B",
                    font: "Inter",
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
                    text: `${data.contractor_name || "Contractor"} © 2026 - Confidential & Certified Matrix\t\tPage `,
                    size: 16,
                    color: "64748B",
                    font: "Inter",
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: "64748B",
                    font: "Inter",
                  }),
                  new TextRun({
                    text: " of ",
                    size: 16,
                    color: "64748B",
                    font: "Inter",
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    color: "64748B",
                    font: "Inter",
                  }),
                ],
              }),
            ],
          }),
        },
        children: mainElements,
      },
    ],
  });

  return await Packer.toBlob(doc);
}
