import React, { useState } from "react";
import { Search, ChevronRight, Layers, HelpCircle } from "lucide-react";
import { QUALITY_CONTROL_TEMPLATES, CATEGORIES } from "../../data/qualityControlTemplates";
import { QualityControlTemplate } from "../../types/qualityControl";

interface QualityControlTemplateLibraryProps {
  onSelectTemplate: (template: QualityControlTemplate) => void;
}

export default function QualityControlTemplateLibrary({ onSelectTemplate }: QualityControlTemplateLibraryProps) {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTemplates = QUALITY_CONTROL_TEMPLATES.filter((tpl) => {
    const matchesCategory = selectedCategory === "All" || tpl.category === selectedCategory;
    const matchesSearch =
      tpl.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tpl.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tpl.documentRef && tpl.documentRef.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-[0px_8px_24px_rgba(7,24,46,0.02)] space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search quality control templates, ref numbers, keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-[#FF9F1C] focus:ring-1 focus:ring-[#FF9F1C] outline-none text-slate-800"
            />
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold text-slate-400 font-mono">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            {QUALITY_CONTROL_TEMPLATES.length} TEMPLATES AVAILABLE
          </div>
        </div>

        {/* Category Pill Tabs */}
        <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedCategory === cat
                  ? "bg-[#FF9F1C] text-white shadow-md shadow-[#FF9F1C]/20"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Templates */}
      {filteredTemplates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-[#FF9F1C]/50 hover:shadow-[0px_12px_32px_rgba(7,24,46,0.04)] transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-full text-[9px] font-bold uppercase tracking-wider">
                    {tpl.category}
                  </span>
                  {tpl.documentRef && (
                    <span className="font-mono text-[10px] font-bold text-slate-400">
                      {tpl.documentRef}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm font-extrabold text-[#07182E] group-hover:text-[#FF9F1C] transition-colors leading-snug">
                    {tpl.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-3">
                    {tpl.description}
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3.5 mt-4 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 font-mono">
                  {tpl.checklistItems.length} Checklist Items
                </span>

                <button
                  onClick={() => onSelectTemplate(tpl)}
                  className="px-3.5 py-1.5 bg-[#FF9F1C] hover:bg-[#FFB020] text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1 hover:-translate-y-0.5 transition-all cursor-pointer"
                >
                  Open Form
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl shadow-[0px_8px_24px_rgba(7,24,46,0.01)] space-y-3">
          <HelpCircle className="w-10 h-10 text-slate-300 mx-auto" />
          <h4 className="text-sm font-extrabold text-[#07182E]">No Templates Found</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            There are no template forms matching your query in the "{selectedCategory}" category. Try adjusting your search keywords.
          </p>
        </div>
      )}
    </div>
  );
}
