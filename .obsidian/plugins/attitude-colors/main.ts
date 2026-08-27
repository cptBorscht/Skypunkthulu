// Attitude Colors - tints File Explorer note titles from a frontmatter
// "attitude" value (0-100), mapped to an HSL hue from 0 (red) to 120 (green).
//
// A fenced code block of type "attitude" in any note renders a slider bound
// to that note's attitude property:
//   ```attitude
//   ```
//
// Deploy: copy manifest.json and main.js into
//   <vault>/.obsidian/plugins/attitude-colors/
// then enable "Attitude Colors" under Settings -> Community plugins.

import { Plugin, TFile } from "obsidian";

const FRONTMATTER_KEY = "attitude";

export default class AttitudeColorsPlugin extends Plugin {
	private observers: MutationObserver[] = [];
	private applyTimer: number | null = null;

	onload() {
		// initial pass once the workspace (and the file explorer) exists
		this.app.workspace.onLayoutReady(() => this.refresh());

		// frontmatter edited (the slider writes here)
		this.registerEvent(this.app.metadataCache.on("changed", () => this.scheduleApply()));

		// panes opened/closed/moved - the explorer may be a fresh element
		this.registerEvent(this.app.workspace.on("layout-change", () => this.refresh()));

		// renames change the data-path the colors are keyed on
		this.registerEvent(this.app.vault.on("rename", () => this.scheduleApply()));
		this.registerEvent(this.app.vault.on("delete", () => this.scheduleApply()));

		// ```attitude``` blocks render as a slider bound to the note's property
		this.registerMarkdownCodeBlockProcessor("attitude", (source, el, ctx) =>
			this.renderSlider(el, ctx.sourcePath));
	}

	onunload() {
		this.disconnectObservers();
		if (this.applyTimer !== null)
			window.clearTimeout(this.applyTimer);
		this.forEachTitleEl((el) => this.clearColor(el));
	}

	// full refresh: re-hook the observers (explorer element may have been
	// rebuilt), then recolor
	private refresh() {
		this.disconnectObservers();
		this.watchExplorers();
		this.applyColors();
	}

	// the explorer rerenders in bursts (expanding folders, sorting, virtual
	// scroll), so coalesce into one recolor pass
	private scheduleApply() {
		if (this.applyTimer !== null)
			window.clearTimeout(this.applyTimer);
		this.applyTimer = window.setTimeout(() => {
			this.applyTimer = null;
			this.applyColors();
		}, 50);
	}

	private watchExplorers() {
		for (const leaf of this.app.workspace.getLeavesOfType("file-explorer")) {
			const target = leaf.view?.containerEl;
			if (!target)
				continue;
			// childList only: our own inline-style writes never retrigger it
			const observer = new MutationObserver(() => this.scheduleApply());
			observer.observe(target, { childList: true, subtree: true });
			this.observers.push(observer);
		}
	}

	private disconnectObservers() {
		this.observers.forEach((observer) => observer.disconnect());
		this.observers = [];
	}

	private renderSlider(el: HTMLElement, sourcePath: string) {
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
		const current = file instanceof TFile ? this.attitudeOf(file) : null;
		slider.value = String(current ?? 50);

		// live feedback while dragging: value label + slider tinted to match
		const paint = () => {
			label.setText(" " + slider.value);
			slider.style.accentColor = "hsl(" + Math.round(Number(slider.value) * 1.2) + ", 75%, 45%)";
		};
		paint();
		slider.addEventListener("input", paint);

		// commit on release; the resulting metadata "changed" event recolors
		// the File Explorer automatically
		slider.addEventListener("change", () => {
			const target = this.app.vault.getAbstractFileByPath(sourcePath);
			if (!(target instanceof TFile))
				return;
			this.app.fileManager.processFrontMatter(target, (frontmatter) => {
				// reuse whichever casing the note already has for the key
				const key = Object.keys(frontmatter)
					.find((k) => k.toLowerCase() === FRONTMATTER_KEY) ?? "Attitude";
				frontmatter[key] = Number(slider.value);
			});
		});
	}

	private attitudeOf(file: TFile): number | null {
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

	private applyColors() {
		const colors = new Map<string, string>();
		for (const file of this.app.vault.getMarkdownFiles()) {
			const attitude = this.attitudeOf(file);
			if (attitude !== null)
				colors.set(file.path, "hsl(" + Math.round(attitude * 1.2) + ", 75%, 45%)");
		}

		this.forEachTitleEl((el) => {
			const path = el.getAttribute("data-path");
			const color = path !== null ? colors.get(path) : undefined;
			if (color !== undefined)
				this.setColor(el, color);
			else
				this.clearColor(el);
		});
	}

	private forEachTitleEl(fn: (el: HTMLElement) => void) {
		for (const leaf of this.app.workspace.getLeavesOfType("file-explorer")) {
			const container = leaf.view?.containerEl;
			if (!container)
				continue;
			container.querySelectorAll<HTMLElement>(".nav-file-title[data-path]").forEach(fn);
		}
	}

	private setColor(el: HTMLElement, color: string) {
		// themes draw nav text with --nav-item-color; plain color is a fallback
		el.style.setProperty("--nav-item-color", color);
		el.style.color = color;
	}

	private clearColor(el: HTMLElement) {
		el.style.removeProperty("--nav-item-color");
		el.style.removeProperty("color");
	}
}
