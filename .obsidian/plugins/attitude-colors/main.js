var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => AttitudeColorsPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var FRONTMATTER_KEY = "attitude";
var AttitudeColorsPlugin = class extends import_obsidian.Plugin {
  observers = [];
  applyTimer = null;
  onload() {
    this.app.workspace.onLayoutReady(() => this.refresh());
    this.registerEvent(this.app.metadataCache.on("changed", () => this.scheduleApply()));
    this.registerEvent(this.app.workspace.on("layout-change", () => this.refresh()));
    this.registerEvent(this.app.vault.on("rename", () => this.scheduleApply()));
    this.registerEvent(this.app.vault.on("delete", () => this.scheduleApply()));
    this.registerMarkdownCodeBlockProcessor("attitude", (source, el, ctx) => this.renderSlider(el, ctx.sourcePath));
  }
  onunload() {
    this.disconnectObservers();
    if (this.applyTimer !== null)
      window.clearTimeout(this.applyTimer);
    this.forEachTitleEl((el) => this.clearColor(el));
  }
  // full refresh: re-hook the observers (explorer element may have been
  // rebuilt), then recolor
  refresh() {
    this.disconnectObservers();
    this.watchExplorers();
    this.applyColors();
  }
  // the explorer rerenders in bursts (expanding folders, sorting, virtual
  // scroll), so coalesce into one recolor pass
  scheduleApply() {
    if (this.applyTimer !== null)
      window.clearTimeout(this.applyTimer);
    this.applyTimer = window.setTimeout(() => {
      this.applyTimer = null;
      this.applyColors();
    }, 50);
  }
  watchExplorers() {
    for (const leaf of this.app.workspace.getLeavesOfType("file-explorer")) {
      const target = leaf.view?.containerEl;
      if (!target)
        continue;
      const observer = new MutationObserver(() => this.scheduleApply());
      observer.observe(target, { childList: true, subtree: true });
      this.observers.push(observer);
    }
  }
  disconnectObservers() {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];
  }
  renderSlider(el, sourcePath) {
    const container = el.createDiv({ cls: "attitude-slider-block" });
    const hostile = container.createEl("span", { text: "Hostile", cls: "attitude-slider-end attitude-slider-hostile" });
    hostile.style.color = "hsl(0, 75%, 45%)";
    hostile.style.marginRight = "0.5em";
    const slider = container.createEl("input", { type: "range", cls: "attitude-slider" });
    slider.min = "0";
    slider.max = "100";
    slider.step = "1";
    slider.style.verticalAlign = "middle";
    const ally = container.createEl("span", { text: "Ally", cls: "attitude-slider-end attitude-slider-ally" });
    ally.style.color = "hsl(120, 75%, 45%)";
    ally.style.marginLeft = "0.5em";
    const label = container.createEl("span", { cls: "attitude-slider-value" });
    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    const current = file instanceof import_obsidian.TFile ? this.attitudeOf(file) : null;
    slider.value = String(current ?? 50);
    const paint = () => {
      label.setText(" " + slider.value);
      slider.style.accentColor = "hsl(" + Math.round(Number(slider.value) * 1.2) + ", 75%, 45%)";
    };
    paint();
    slider.addEventListener("input", paint);
    slider.addEventListener("change", () => {
      const target = this.app.vault.getAbstractFileByPath(sourcePath);
      if (!(target instanceof import_obsidian.TFile))
        return;
      this.app.fileManager.processFrontMatter(target, (frontmatter) => {
        const key = Object.keys(frontmatter).find((k) => k.toLowerCase() === FRONTMATTER_KEY) ?? "Attitude";
        frontmatter[key] = Number(slider.value);
      });
    });
  }
  attitudeOf(file) {
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    if (!frontmatter)
      return null;
    for (const key of Object.keys(frontmatter)) {
      if (key.toLowerCase() !== FRONTMATTER_KEY)
        continue;
      const value = Number(frontmatter[key]);
      if (!isNaN(value))
        return Math.max(0, Math.min(100, value));
    }
    return null;
  }
  applyColors() {
    const colors = /* @__PURE__ */ new Map();
    for (const file of this.app.vault.getMarkdownFiles()) {
      const attitude = this.attitudeOf(file);
      if (attitude !== null)
        colors.set(file.path, "hsl(" + Math.round(attitude * 1.2) + ", 75%, 45%)");
    }
    this.forEachTitleEl((el) => {
      const path = el.getAttribute("data-path");
      const color = path !== null ? colors.get(path) : void 0;
      if (color !== void 0)
        this.setColor(el, color);
      else
        this.clearColor(el);
    });
  }
  forEachTitleEl(fn) {
    for (const leaf of this.app.workspace.getLeavesOfType("file-explorer")) {
      const container = leaf.view?.containerEl;
      if (!container)
        continue;
      container.querySelectorAll(".nav-file-title[data-path]").forEach(fn);
    }
  }
  setColor(el, color) {
    el.style.setProperty("--nav-item-color", color);
    el.style.color = color;
  }
  clearColor(el) {
    el.style.removeProperty("--nav-item-color");
    el.style.removeProperty("color");
  }
};
