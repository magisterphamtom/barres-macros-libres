/**
 * Barres de Macros Libres — Foundry VTT v13 / v14
 * Barres de macros flottantes, déplaçables, de 1 à 5 barres (les 5 pages de la hotbar).
 * Les emplacements sont ceux de la hotbar native (game.user.hotbar, cases 1 à 50) :
 * tout reste synchronisé avec la barre d'origine.
 */

const MOD = "barres-macros-libres";
const SLOTS_PER_ROW = 10;
const MAX_ROWS = 5;

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const getSetting = key => game.settings.get(MOD, key);
const setSetting = (key, value) => game.settings.set(MOD, key, value);

async function executeMacro(macroId) {
  const macro = game.macros.get(macroId);
  if (!macro) return;
  try {
    await macro.execute();
  } catch (err) {
    console.error(`${MOD} | Erreur dans la macro « ${macro.name} »`, err);
    ui.notifications.error(`La macro « ${macro.name} » a échoué. Détails dans la console (F12).`);
  }
}

class BarresMacros {
  constructor() {
    this.el = null;
    this.menu = null;
    this._onOutsidePointer = this._onOutsidePointer.bind(this);
  }

  /* ------------------------------------------------------------ */
  /*  Rendu                                                        */
  /* ------------------------------------------------------------ */

  render() {
    const visible = getSetting("visible");
    document.body.classList.toggle("bml-hide-native", visible && getSetting("hideNative"));

    if (!visible) {
      this._closeMenu();
      this.el?.remove();
      this.el = null;
      return;
    }
    if (!this.el) this._create();
    this._build();
    this._applyPosition();
  }

  /** Alt+M : réduit / déploie la barre (et la réactive si elle était désactivée). */
  async toggle() {
    if (!getSetting("visible")) {
      await setSetting("collapsed", false);
      return setSetting("visible", true);
    }
    return setSetting("collapsed", !getSetting("collapsed"));
  }

  _create() {
    const el = document.createElement("section");
    el.id = "bml-root";
    el.addEventListener("pointerdown", this._onPointerDown.bind(this));
    el.addEventListener("click", this._onClick.bind(this));
    el.addEventListener("contextmenu", this._onContextMenu.bind(this));
    el.addEventListener("dragstart", this._onDragStart.bind(this));
    el.addEventListener("dragover", this._onDragOver.bind(this));
    el.addEventListener("dragleave", this._onDragLeave.bind(this));
    el.addEventListener("drop", this._onDrop.bind(this));
    document.body.append(el);
    this.el = el;
  }

  _build() {
    const rows = clamp(getSetting("rows"), 1, MAX_ROWS);
    const vertical = getSetting("orientation") === "vertical";
    const locked = getSetting("locked");
    const collapsed = getSetting("collapsed");

    this.el.className = `bml ${vertical ? "vertical" : "horizontal"}${locked ? " locked" : ""}${collapsed ? " collapsed" : ""}`;
    this.el.style.setProperty("--bml-size", `${getSetting("slotSize")}px`);
    if (collapsed) this.el.replaceChildren(this._buildCollapsed(locked));
    else this.el.replaceChildren(this._buildHandle(rows, vertical, locked), this._buildRows(rows));
  }

  /** Barre réduite : une petite pastille déplaçable qui redéploie les barres au clic. */
  _buildCollapsed(locked) {
    const handle = document.createElement("header");
    handle.className = "bml-handle";
    const grip = document.createElement("i");
    grip.className = "bml-grip fa-solid fa-grip-vertical";
    grip.dataset.tooltip = locked ? "Position verrouillée" : "Glisser pour déplacer";
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.action = "expand";
    b.dataset.tooltip = "Afficher les barres de macros (Alt+M)";
    b.setAttribute("aria-label", b.dataset.tooltip);
    const i = document.createElement("i");
    i.className = "fa-solid fa-table-cells";
    b.append(i, " Macros");
    handle.append(grip, b);
    return handle;
  }

  _buildHandle(rows, vertical, locked) {
    const handle = document.createElement("header");
    handle.className = "bml-handle";

    const grip = document.createElement("i");
    grip.className = "bml-grip fa-solid fa-grip-vertical";
    grip.dataset.tooltip = locked ? "Position verrouillée" : "Glisser pour déplacer";

    const makeBtn = (action, icon, tooltip, text) => {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.action = action;
      b.dataset.tooltip = tooltip;
      b.setAttribute("aria-label", tooltip);
      const i = document.createElement("i");
      i.className = icon;
      b.append(i);
      if (text) b.append(` ${text}`);
      return b;
    };

    handle.append(
      grip,
      makeBtn("rows", "fa-solid fa-layer-group", "Nombre de barres affichées", String(rows)),
      makeBtn("orientation", vertical ? "fa-solid fa-grip-lines" : "fa-solid fa-grip-lines-vertical",
        vertical ? "Passer en horizontal" : "Passer en vertical"),
      makeBtn("lock", locked ? "fa-solid fa-lock" : "fa-solid fa-lock-open",
        locked ? "Déverrouiller la position" : "Verrouiller la position"),
      makeBtn("hide", "fa-solid fa-minimize", "Réduire (Alt+M)")
    );
    return handle;
  }

  _buildRows(rows) {
    const container = document.createElement("div");
    container.className = "bml-rows";
    const hotbar = game.user.hotbar ?? {};

    for (let page = 1; page <= rows; page++) {
      const row = document.createElement("div");
      row.className = "bml-row";
      row.dataset.page = page;

      const label = document.createElement("span");
      label.className = "bml-label";
      label.textContent = page;
      label.dataset.tooltip = `Page ${page} de la hotbar`;
      row.append(label);

      for (let i = 1; i <= SLOTS_PER_ROW; i++) {
        const slot = (page - 1) * SLOTS_PER_ROW + i;
        row.append(this._buildSlot(slot, i, game.macros.get(hotbar[slot])));
      }
      container.append(row);
    }
    return container;
  }

  _buildSlot(slot, index, macro) {
    const el = document.createElement("div");
    el.className = "bml-slot";
    el.dataset.slot = slot;

    const key = document.createElement("span");
    key.className = "bml-key";
    key.textContent = index % 10;
    el.append(key);

    if (macro) {
      el.classList.add("filled");
      el.draggable = true;
      el.dataset.macroId = macro.id;
      el.dataset.tooltip = macro.name;
      el.setAttribute("aria-label", macro.name);
      const img = document.createElement("img");
      img.src = macro.img || "icons/svg/dice-target.svg";
      img.alt = "";
      img.draggable = false;
      el.prepend(img);
    }
    return el;
  }

  _applyPosition() {
    const pos = getSetting("position") ?? {};
    const rect = this.el.getBoundingClientRect();
    const left = typeof pos.left === "number" ? pos.left : (window.innerWidth - rect.width) / 2;
    const top = typeof pos.top === "number" ? pos.top : window.innerHeight - rect.height - 90;
    this._moveTo(left, top, rect);
  }

  _moveTo(left, top, rect = this.el.getBoundingClientRect()) {
    const l = clamp(left, 0, Math.max(0, window.innerWidth - rect.width));
    const t = clamp(top, 0, Math.max(0, window.innerHeight - rect.height));
    this.el.style.left = `${l}px`;
    this.el.style.top = `${t}px`;
    return { left: l, top: t };
  }

  /* ------------------------------------------------------------ */
  /*  Déplacement                                                  */
  /* ------------------------------------------------------------ */

  _onPointerDown(event) {
    if (event.button !== 0) return;
    if (!event.target.closest(".bml-handle") || event.target.closest("button")) return;
    if (getSetting("locked")) return;
    event.preventDefault();

    const rect = this.el.getBoundingClientRect();
    const dx = event.clientX - rect.left;
    const dy = event.clientY - rect.top;
    let last = { left: rect.left, top: rect.top };
    this.el.classList.add("dragging");

    const move = e => { last = this._moveTo(e.clientX - dx, e.clientY - dy, rect); };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      this.el?.classList.remove("dragging");
      setSetting("position", last);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  /* ------------------------------------------------------------ */
  /*  Clics                                                        */
  /* ------------------------------------------------------------ */

  async _onClick(event) {
    const button = event.target.closest("button[data-action]");
    if (button) return this._onAction(button.dataset.action, button);

    const slot = event.target.closest(".bml-slot.filled");
    if (slot) return this._execute(slot.dataset.macroId);
  }

  _onAction(action, button) {
    switch (action) {
      case "rows": {
        const current = getSetting("rows");
        const rect = button.getBoundingClientRect();
        const items = Array.from({ length: MAX_ROWS }, (_, k) => ({
          label: `${k + 1} barre${k ? "s" : ""}`,
          icon: k + 1 === current ? "fa-solid fa-check" : "fa-solid fa-minus",
          active: k + 1 === current,
          action: () => setSetting("rows", k + 1)
        }));
        return this._showMenu(rect.left, rect.bottom + 4, items);
      }
      case "orientation":
        return setSetting("orientation", getSetting("orientation") === "vertical" ? "horizontal" : "vertical");
      case "lock":
        return setSetting("locked", !getSetting("locked"));
      case "hide":
        return setSetting("collapsed", true);
      case "expand":
        return setSetting("collapsed", false);
    }
  }

  _execute(macroId) {
    return executeMacro(macroId);
  }

  _onContextMenu(event) {
    const slotEl = event.target.closest(".bml-slot");
    if (!slotEl) return;
    event.preventDefault();

    const slot = Number(slotEl.dataset.slot);
    const macro = game.macros.get(slotEl.dataset.macroId);
    const items = macro
      ? [
          { label: "Exécuter", icon: "fa-solid fa-play", action: () => this._execute(macro.id) },
          { label: "Modifier la macro", icon: "fa-solid fa-pen-to-square", disabled: !macro.isOwner,
            action: () => macro.sheet.render(true) },
          { label: "Retirer de la barre", icon: "fa-solid fa-xmark",
            action: () => game.user.assignHotbarMacro(null, slot) }
        ]
      : [
          { label: "Créer une macro ici", icon: "fa-solid fa-plus", action: () => this._createMacro(slot) }
        ];
    this._showMenu(event.clientX, event.clientY, items);
  }

  async _createMacro(slot) {
    const type = game.user.can("MACRO_SCRIPT") ? CONST.MACRO_TYPES.SCRIPT : CONST.MACRO_TYPES.CHAT;
    try {
      const macro = await Macro.implementation.create({
        name: "Nouvelle macro",
        type,
        scope: "global",
        img: "icons/svg/dice-target.svg"
      });
      if (!macro) return;
      await game.user.assignHotbarMacro(macro, slot);
      macro.sheet.render(true);
    } catch (err) {
      console.error(`${MOD} |`, err);
      ui.notifications.warn("Impossible de créer la macro : vérifie tes permissions de création de macros.");
    }
  }

  /* ------------------------------------------------------------ */
  /*  Glisser-déposer                                              */
  /* ------------------------------------------------------------ */

  _onDragStart(event) {
    const slotEl = event.target.closest(".bml-slot.filled");
    if (!slotEl) return;
    const macro = game.macros.get(slotEl.dataset.macroId);
    if (!macro) return;
    const data = { type: "Macro", uuid: macro.uuid, slot: Number(slotEl.dataset.slot) };
    event.dataTransfer.setData("text/plain", JSON.stringify(data));
    event.dataTransfer.effectAllowed = "copyMove";
  }

  _onDragOver(event) {
    const slotEl = event.target.closest(".bml-slot");
    if (!slotEl) return;
    event.preventDefault();
    slotEl.classList.add("drag-over");
  }

  _onDragLeave(event) {
    event.target.closest(".bml-slot")?.classList.remove("drag-over");
  }

  async _onDrop(event) {
    const slotEl = event.target.closest(".bml-slot");
    if (!slotEl) return;
    event.preventDefault();
    slotEl.classList.remove("drag-over");

    const slot = Number(slotEl.dataset.slot);
    const TE = foundry.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
    const data = TE.getDragEventData(event);
    if (!data?.type) return;

    // Même comportement que la hotbar native : les systèmes (dnd5e, etc.)
    // peuvent créer une macro à partir d'un objet, d'un sort, d'un acteur...
    if (Hooks.call("hotbarDrop", ui.hotbar, data, slot) === false) return;
    if (data.type !== "Macro") return;

    let macro = await Macro.implementation.fromDropData(data);
    if (!macro) return;
    if (macro.compendium) {
      macro = await Macro.implementation.create(game.macros.fromCompendium(macro));
      if (!macro) return;
    }
    await game.user.assignHotbarMacro(macro, slot, { fromSlot: data.slot });
  }

  /* ------------------------------------------------------------ */
  /*  Menu contextuel                                              */
  /* ------------------------------------------------------------ */

  _showMenu(x, y, items) {
    this._closeMenu();
    const menu = document.createElement("nav");
    menu.className = "bml-menu";

    for (const item of items) {
      const b = document.createElement("button");
      b.type = "button";
      if (item.active) b.classList.add("active");
      b.disabled = !!item.disabled;
      const i = document.createElement("i");
      i.className = item.icon;
      b.append(i, ` ${item.label}`);
      b.addEventListener("click", () => {
        this._closeMenu();
        item.action();
      });
      menu.append(b);
    }

    document.body.append(menu);
    const r = menu.getBoundingClientRect();
    menu.style.left = `${clamp(x, 0, window.innerWidth - r.width)}px`;
    menu.style.top = `${clamp(y, 0, window.innerHeight - r.height)}px`;
    this.menu = menu;
    setTimeout(() => document.addEventListener("pointerdown", this._onOutsidePointer, true), 0);
  }

  _onOutsidePointer(event) {
    if (!this.menu?.contains(event.target)) this._closeMenu();
  }

  _closeMenu() {
    document.removeEventListener("pointerdown", this._onOutsidePointer, true);
    this.menu?.remove();
    this.menu = null;
  }
}

/* -------------------------------------------------------------- */
/*  Initialisation                                                */
/* -------------------------------------------------------------- */

let bars = null;
const rerender = () => bars?.render();

Hooks.once("init", () => {
  const client = (key, data) => game.settings.register(MOD, key, { scope: "client", onChange: rerender, ...data });

  client("visible", { name: "Afficher les barres de macros", config: true, type: Boolean, default: true });
  client("rows", {
    name: "Nombre de barres affichées",
    hint: "De 1 à 5 (chaque barre correspond à une page de la hotbar).",
    config: true, type: Number, default: 2,
    range: { min: 1, max: MAX_ROWS, step: 1 }
  });
  client("orientation", {
    name: "Disposition",
    config: true, type: String, default: "horizontal",
    choices: { horizontal: "Horizontale", vertical: "Verticale" }
  });
  client("slotSize", {
    name: "Taille des cases (pixels)",
    config: true, type: Number, default: 36,
    range: { min: 20, max: 72, step: 2 }
  });
  client("hideNative", {
    name: "Masquer la hotbar native",
    hint: "Les barres libres remplacent la barre de macros d'origine de Foundry (mêmes macros, mêmes emplacements). Décoche pour afficher les deux.",
    config: true, type: Boolean, default: true
  });
  client("locked", { config: false, type: Boolean, default: false });
  client("collapsed", { config: false, type: Boolean, default: false });
  game.settings.register(MOD, "position", { scope: "client", config: false, type: Object, default: {} });

  // Touches du pavé numérique : barre 1 = 1..0, barre 2 = Ctrl + 1..0, barre 3 = Alt + 1..0.
  // Barres 4 et 5 : sans touche par défaut, à définir dans « Configurer les contrôles ».
  const rowModifiers = { 1: [], 2: ["Control"], 3: ["Alt"] };
  for (let row = 1; row <= MAX_ROWS; row++) {
    for (let i = 1; i <= SLOTS_PER_ROW; i++) {
      const slot = (row - 1) * SLOTS_PER_ROW + i;
      const key = `Numpad${i % 10}`;
      game.keybindings.register(MOD, `slot${slot}`, {
        name: `Barre ${row}, case ${i % 10}`,
        editable: row in rowModifiers ? [{ key, modifiers: rowModifiers[row] }] : [],
        onDown: () => {
          const macroId = game.user.hotbar?.[slot];
          if (!macroId) return false;
          executeMacro(macroId);
          return true;
        }
      });
    }
  }

  game.keybindings.register(MOD, "toggle", {
    name: "Réduire / afficher les barres de macros",
    hint: "Alt+M en QWERTY comme en AZERTY (la touche M n'est pas au même endroit sur les deux claviers).",
    editable: [
      { key: "KeyM", modifiers: ["Alt"] },       // M en QWERTY
      { key: "Semicolon", modifiers: ["Alt"] }   // M en AZERTY
    ],
    onDown: () => { bars?.toggle(); return true; }
  });
});

Hooks.once("ready", () => {
  bars = new BarresMacros();
  game.modules.get(MOD).api = bars;
  bars.render();

  const debounced = foundry.utils.debounce(rerender, 50);
  Hooks.on("updateUser", user => { if (user.isSelf) debounced(); });
  Hooks.on("createMacro", debounced);
  Hooks.on("updateMacro", debounced);
  Hooks.on("deleteMacro", debounced);
  window.addEventListener("resize", foundry.utils.debounce(() => bars?.el && bars._applyPosition(), 100));
});
