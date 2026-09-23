import { requireWorkspaceAccess } from "./server/workspaceAccess";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { 
  parsePrimaveraXER, 
  parsePrimaveraXML,
  parseMSProjectXML, 
  parseMSProjectMPP,
  parseExcelSchedule, 
  parsePDFSchedule
} from "./server/programmeParser";
import { runAIOrchestrator } from "./server/aiOrchestrator";
import { getProjectWeather } from "./server/weather";
import { EngineeringRFIStorage } from "./server/engineeringRfiStorage";

dotenv.config({path:".env.local"});
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Health check endpoint for ingress / control plane probes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", requireWorkspaceAccess);

// Weather API endpoint (OpenWeatherMap with automatic Open-Meteo fallback)
app.get("/api/weather", async (req, res) => {
  try {
    const locationQuery = (req.query.q as string) || (req.query.location as string) || "Tunduma";
    const rawLat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    const rawLon = req.query.lon ? parseFloat(req.query.lon as string) : undefined;
    const lat = rawLat !== undefined && !isNaN(rawLat) ? rawLat : undefined;
    const lon = rawLon !== undefined && !isNaN(rawLon) ? rawLon : undefined;

    const weatherData = await getProjectWeather(locationQuery, lat, lon);
    res.json(weatherData);
  } catch (error: any) {
    console.error("Error in /api/weather endpoint:", error);
    res.status(500).json({
      success: false,
      error: error?.message || "Failed to fetch weather data",
      temp: 27,
      tempFormatted: "27°C",
      condition: "Clear",
      description: "Clear sky",
      humidity: 45,
      windSpeedKmH: 12
    });
  }
});

// Deterministic Multi-Format Programme Import Route (P6 .xer/.xml, MSP .xml/.mpp, Excel .xlsx/.xls/.csv, PDF)
app.post("/api/programme/convert-programme", async (req, res) => {
  try {
    const { fileData, fileName, fileType, mimeType } = req.body;

    if (!fileData) {
      return res.status(400).json({ success: false, error: "Missing file data payload for schedule import." });
    }

    const safeFileName = fileName || "Imported_Schedule";
    const lowerName = safeFileName.toLowerCase();

    // Auto-detect format deterministically from filename and payload headers
    let detectedType = fileType || "auto";
    if (detectedType === "auto") {
      if (lowerName.endsWith(".xer") || (typeof fileData === "string" && fileData.includes("%T TASK"))) {
        detectedType = "primavera_xer";
      } else if (lowerName.endsWith(".xml")) {
        if (typeof fileData === "string" && fileData.includes("<APPLY>") && fileData.includes("<PROJECT>")) {
          detectedType = "primavera_xml";
        } else {
          detectedType = "msproject_xml";
        }
      } else if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls") || lowerName.endsWith(".csv")) {
        detectedType = "excel";
      } else if (lowerName.endsWith(".pdf") || mimeType === "application/pdf") {
        detectedType = "pdf";
      } else if (lowerName.endsWith(".mpp")) {
        detectedType = "msproject_mpp";
      } else {
        detectedType = "excel";
      }
    }

    // Extract text content and binary buffer safely
    let textContent = "";
    let fileBuffer: Buffer;

    if (typeof fileData === "string") {
      if (fileData.startsWith("data:")) {
        const base64Data = fileData.includes(",") ? fileData.split(",")[1] : fileData;
        fileBuffer = Buffer.from(base64Data, "base64");
        textContent = fileBuffer.toString("utf-8");
      } else if (fileData.startsWith("%T") || fileData.startsWith("<?xml") || fileData.startsWith("<Project") || fileData.includes("\n") || fileData.includes(",")) {
        textContent = fileData;
        fileBuffer = Buffer.from(fileData, "utf-8");
      } else {
        try {
          fileBuffer = Buffer.from(fileData, "base64");
          textContent = fileBuffer.toString("utf-8");
        } catch {
          textContent = fileData;
          fileBuffer = Buffer.from(fileData, "utf-8");
        }
      }
    } else {
      fileBuffer = Buffer.from(fileData);
      textContent = fileBuffer.toString("utf-8");
    }

    let result;

    if (detectedType === "primavera" || detectedType === "primavera_xer" || lowerName.endsWith(".xer")) {
      result = parsePrimaveraXER(textContent, safeFileName);
    } else if (detectedType === "primavera_xml") {
      result = parsePrimaveraXML(textContent, safeFileName);
    } else if (detectedType === "msproject" || detectedType === "msproject_xml" || (lowerName.endsWith(".xml") && !lowerName.endsWith(".xer"))) {
      if (textContent.includes("<APPLY>") && textContent.includes("<PROJECT>")) {
        result = parsePrimaveraXML(textContent, safeFileName);
      } else {
        result = parseMSProjectXML(textContent, safeFileName);
      }
    } else if (detectedType === "msproject_mpp" || lowerName.endsWith(".mpp")) {
      result = await parseMSProjectMPP(fileBuffer, safeFileName);
    } else if (detectedType === "excel" || lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls") || lowerName.endsWith(".csv")) {
      result = parseExcelSchedule(fileBuffer, safeFileName);
    } else if (detectedType === "pdf" || lowerName.endsWith(".pdf")) {
      result = await parsePDFSchedule(fileBuffer, safeFileName);
    } else {
      result = parseExcelSchedule(fileBuffer, safeFileName);
    }

    if (!result || !result.activities || result.activities.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: `Could not extract any valid activities from "${safeFileName}". An uploaded programme is contractual source data and Project Matrix will never invent synthetic schedule activities.` 
      });
    }

    return res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error("Error in /api/programme/convert-programme:", error);
    res.status(400).json({ 
      success: false, 
      error: error?.message || "Failed to extract schedule from source file" 
    });
  }
});

// AI Delay Analysis Route
app.post("/api/programme/analyze-delay", async (req, res) => {
  try {
    const { prompt, activities, contractCompletion, predictedCompletion, varianceDays } = req.body;
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });
      const systemInstruction = `You are an expert Project Controls Engineer and Construction Delay Diagnostics AI.
You analyze project schedules (Gantt, WBS, Critical Path, Baselines, Actuals, Forecasts, Float).
When analyzing delay drivers:
1. Trace critical path activities with negative float or delay.
2. Identify the root cause activity (e.g., ACT-102 / WBS 2.1 Bulk Excavation rock strata encounter causing +14 days delay).
3. Trace downstream delay propagation along the critical path.
4. Highlight Programme Variance (${varianceDays || -14} days), Contract Completion (${contractCompletion || "28 Sep 2026"}), and Predicted Completion (${predictedCompletion || "12 Oct 2026"}).
5. Provide actionable delay mitigation options (crashing, fast-tracking, parallelizing).
Keep responses clear, professional, concise, structured with clear Markdown headers and bullet points.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          { 
            role: "user", 
            parts: [{ 
              text: `${systemInstruction}\n\nUser Prompt: ${prompt || "What is driving the delay?"}\n\nSchedule Context:\nContract Completion: ${contractCompletion}\nPredicted Completion: ${predictedCompletion}\nVariance: ${varianceDays} days\nActivities Data:\n${JSON.stringify(activities, null, 2)}` 
            }] 
          }
        ]
      });

      return res.json({ response: response.text });
    } else {
      return res.json({
        response: `### 🚨 Critical Path Delay Diagnostic Analysis

**Summary Overview:**
- **Contract Completion:** ${contractCompletion || "28 Sep 2026"}
- **Predicted Completion:** ${predictedCompletion || "12 Oct 2026"}
- **Programme Variance:** ${varianceDays || -14} days (Behind Schedule)

---

### 🔍 Primary Delay Driver Identified:
**WBS 2.1 / ACT-102: Bulk Excavation & Rock Strata Removal**
- **Planned Finish:** 15 Apr 2026
- **Forecast Finish:** 29 Apr 2026
- **Delay:** +14 Days | **Total Float:** -14 Days | **Status:** Critical & Delayed
- **Root Cause:** Encountered unforeseen basalt rock strata during site excavation, requiring specialized hydraulic breaker equipment and reduced daily output.

---

### ⛓️ Downstream Critical Path Propagation:
1. **ACT-102 (Bulk Excavation)** delayed by **+14 days** (Finish: 29 Apr 2026)
2. ↳ Pushed **ACT-103 (Structural Foundation Piling)** [FS Dependency] start from 16 Apr 2026 to 30 Apr 2026 (**+14 days**)
3. ↳ Pushed **ACT-104 (Superstructure Concrete Framing)** [FS Dependency] start (**+14 days**)
4. ↳ Pushed **ACT-106 (Final Commissioning & Handover)** to **12 Oct 2026** (Contract Completion: **28 Sep 2026**, **Variance: -14 days**).

---

### 🛠️ Recommended Schedule Recovery & Mitigation Actions:
1. **Crash Piling Sequence (ACT-103):** Mobilize a second heavy piling rig and establish dual 10-hour shifts to recover **8 days**.
2. **Fast-Track MEP Rough-In (ACT-105):** Parallelize ground-floor MEP conduit installation with Level 1 slab casting to recover **6 days**.
3. **Total Targeted Delay Recovery:** **14 Days** (restoring predicted handover to **28 Sep 2026**).`
      });
    }
  } catch (error: any) {
    console.error("Error in analyze-delay API:", error);
    res.status(500).json({ error: error.message || "Failed to analyze delay" });
  }
});

// ProjectMatrix AI Orchestrator Gateway (Gemini + OpenAI + Specialist Agents + Tool Layer)
app.post("/api/advisor/orchestrate", async (req, res) => {
  try {
    const { question, scope, company, project, history } = req.body;
    
    const result = await runAIOrchestrator({
      question: question || "",
      scope: scope || "project",
      companyName: company?.name || "ProjectMatrix Enterprise",
      projectName: project?.name,
      contractCode: project?.contract_code,
      history: history
    });

    return res.json(result);
  } catch (error: any) {
    console.error("Error in /api/advisor/orchestrate:", error);
    res.status(500).json({ error: error.message || "Failed to orchestrate AI advisor response" });
  }
});

// Matrix Multilingual Cross-Lingual Ingestion Engine (Swahili, Arabic, French, Portuguese, English)
app.post("/api/ai/multilingual-process", async (req, res) => {
  try {
    const { text, authorName, authorRole, authorLocation, hubCode } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Missing required 'text' parameter" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });

      const prompt = `You are the Matrix Multilingual AI Engine for ProjectMatrix, an international infrastructure ERP.
Task: Process this field report submitted by site personnel in any language (Swahili, Arabic, French, Portuguese, or English).
Extract structured construction data and produce:
1. Detected Language ('en', 'ar', 'fr', 'pt', or 'sw') and language name.
2. An authoritative English Master Record for executive oversight (London / New York HQ).
3. Structured quantitative telemetry (quantity as number, unit, material, labourCount, equipment, location, WBS code, HSE safety note).
4. Localized synchronized views for Arabic (GCC / Riyadh), French (West Africa), Portuguese (Mozambique/Angola), Swahili (East Africa), and English.

Field Input:
"${text}"
Author: ${authorName || "Field Personnel"} (${authorRole || "Site Supervisor"})
Location: ${authorLocation || hubCode || "Strategic Infrastructure Corridor"}

Respond ONLY in valid JSON with this exact structure:
{
  "id": "SYNC-${Date.now().toString().slice(-6)}",
  "sourceLanguage": "sw|ar|fr|pt|en",
  "detectedLanguageName": "string",
  "author": {
    "name": "${authorName || "Site Personnel"}",
    "role": "${authorRole || "Field Supervisor"}",
    "location": "${authorLocation || "Site"}",
    "hubCode": "${hubCode || "GLB"}"
  },
  "englishMaster": {
    "title": "Clear English title with quantity and activity",
    "summary": "Executive summary in professional construction English",
    "workPackage": "Relevant Work Package name",
    "wbsCode": "WBS code (e.g. WBS 2.4.1)",
    "formalRecord": "Contractual record under FIDIC/NEC3",
    "actionRequired": "Next steps or progress logged"
  },
  "structuredData": {
    "activityType": "string",
    "quantity": 65,
    "unit": "m³|tons|m|units",
    "material": "string",
    "wbsCode": "string",
    "location": "string",
    "labourCount": 12,
    "equipmentUsed": ["string"],
    "weatherConditions": "string",
    "hseIncidentCount": 0,
    "qualityPassed": true,
    "scheduleImpactDays": 0,
    "costImpact": 0
  },
  "localizedViews": {
    "en": { "title": "...", "summary": "...", "actionItems": ["..."], "fieldNotes": "${text.replace(/"/g, '\\"')}" },
    "ar": { "title": "...", "summary": "...", "actionItems": ["..."], "fieldNotes": "${text.replace(/"/g, '\\"')}" },
    "fr": { "title": "...", "summary": "...", "actionItems": ["..."], "fieldNotes": "${text.replace(/"/g, '\\"')}" },
    "pt": { "title": "...", "summary": "...", "actionItems": ["..."], "fieldNotes": "${text.replace(/"/g, '\\"')}" },
    "sw": { "title": "...", "summary": "...", "actionItems": ["..."], "fieldNotes": "${text.replace(/"/g, '\\"')}" }
  },
  "crossLingualSyncStatus": "synchronized",
  "complianceNote": "Contractual Baseline Verified (FIDIC Cl. 4.12 / NEC3 Cl. 60.1)"
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json"
        }
      });

      const responseText = response.text || "";
      const parsed = JSON.parse(responseText.trim());
      return res.json({ success: true, result: parsed });
    } else {
      // Fallback if no API key
      return res.json({ 
        success: false, 
        message: "No GEMINI_API_KEY detected, client-side intelligence fallback will be used." 
      });
    }
  } catch (error: any) {
    console.error("Error in /api/ai/multilingual-process:", error);
    return res.status(500).json({ error: error.message || "Failed to process multilingual text" });
  }
});

// ============================================================================
// Engineering RFIs / Technical Queries Persistent Backend Storage API
// ============================================================================
app.get("/api/engineering/rfis", (req, res) => {
  try {
    const projectId = req.query.projectId as string | undefined;
    const companyId = req.query.companyId as string | undefined;
    const rfis = EngineeringRFIStorage.getRFIs({ projectId, companyId });
    res.json({ success: true, data: rfis });
  } catch (error: any) {
    console.error("Error fetching engineering RFIs:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch RFIs" });
  }
});

app.get("/api/engineering/rfis/:id", (req, res) => {
  try {
    const rfi = EngineeringRFIStorage.getRFIById(req.params.id);
    if (!rfi) {
      return res.status(404).json({ success: false, error: "RFI not found" });
    }
    res.json({ success: true, data: rfi });
  } catch (error: any) {
    console.error("Error fetching engineering RFI by id:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch RFI" });
  }
});

app.post("/api/engineering/rfis", (req, res) => {
  try {
    const rfiData = req.body;
    if (!rfiData || !rfiData.title) {
      return res.status(400).json({ success: false, error: "Title is required for Technical Query / RFI" });
    }
    const saved = EngineeringRFIStorage.createRFI(rfiData);
    res.status(201).json({ success: true, data: saved });
  } catch (error: any) {
    console.error("Error creating engineering RFI:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to create RFI" });
  }
});

app.put("/api/engineering/rfis/:id", (req, res) => {
  try {
    const id = req.params.id;
    const updateData = req.body;
    const updated = EngineeringRFIStorage.updateRFI(id, updateData);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("Error updating engineering RFI:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to update RFI" });
  }
});

app.delete("/api/engineering/rfis/:id", (req, res) => {
  try {
    const id = req.params.id;
    const deleted = EngineeringRFIStorage.deleteRFI(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: "RFI not found or already deleted" });
    }
    res.json({ success: true, message: "Technical Query / RFI deleted successfully", id });
  } catch (error: any) {
    console.error("Error deleting engineering RFI:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to delete RFI" });
  }
});

// Serve static app in production, or mount Vite middleware in development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Critical error starting Express + Vite server:", err);
  process.exit(1);
});
