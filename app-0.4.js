"use strict";

const rangeButtons = [document.querySelector("#range-0"), document.querySelector("#range-1")];
const ranges = [null, null];
const form = document.querySelector("#period");
const controls = document.querySelector("#controls");
const calendars = document.querySelector("#calendars");
const start = document.querySelector("#start");
const end = document.querySelector("#end");
const status = document.querySelector("#status");
const instruction = document.querySelector("#instruction");
const monthFormat = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "UTC" });
const shortFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" });

const options = new URLSearchParams(location.search);
const preview = options.get("preview") === "1";
const dialog = options.get("picker") === "1";
let dashboard;
let targets = defaultTargets;
let workbookFormatting;
let busy = false;
let invalidSavedConfig = false;
let activeRange = null;
let visibleMonth;
let selectingEnd = false;
let keepStartDate = false;

const toIso = date => date.toISOString().slice(0, 10);
const toUtc = iso => new Date(iso + "T00:00:00Z");
const monthAt = (date, offset = 0, day = 1) => {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + offset, day);
  return result;
};
const daysFrom = (date, days) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

function localToday() {
  const date = new Date();
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

function message(text, error = false) {
  status.textContent = text;
  status.classList.toggle("error", error);
}

function formatRange(range) {
  return range.map(iso => shortFormat.format(toUtc(iso))).join(" a ");
}

function showSummary(index) {
  const summary = document.querySelector("#summary-" + index);
  const range = ranges[index];
  if (!range) {
    summary.textContent = "Selecionar datas";
    return;
  }
  const [from, through] = range.map(iso => shortFormat.format(toUtc(iso)));
  const first = document.createElement("span");
  first.className = "range-date";
  first.textContent = from;
  const last = document.createElement("span");
  last.className = "range-date";
  last.textContent = "a\u00a0" + through;
  summary.replaceChildren(first, " ", last);
}

function workbookFontFamily() {
  const worksheetStyle = workbookFormatting?.formattingSheets?.find(sheet =>
    sheet.classNameKey === tableau.ClassNameKey.Worksheet
  );
  return String(worksheetStyle?.cssProperties?.fontFamily || "");
}

function applyTypography(appearance, workbookFont) {
  const { font, titleSize, valueSize } = normalizeAppearance(appearance);
  const style = document.documentElement.style;
  const family = font ? JSON.stringify(font) : workbookFont;
  if (family) {
    style.setProperty("--period-font", family + ', "Tableau Book", "Segoe UI", system-ui, sans-serif');
  } else {
    style.removeProperty("--period-font");
  }
  for (const [property, size] of [["--period-title-size", titleSize], ["--period-value-size", valueSize]]) {
    if (size) style.setProperty(property, size + "px");
    else style.removeProperty(property);
  }
}

function showAppearance() {
  const appearance = normalizeAppearance(targets.appearance);
  appearance.titles.forEach((title, index) => {
    document.querySelector("#range-title-" + index).textContent = title;
  });
  applyTypography(appearance, workbookFontFamily());
}

function closeRange() {
  const index = activeRange;
  activeRange = null;
  controls.hidden = true;
  controls.disabled = true;
  rangeButtons[index].setAttribute("aria-expanded", "false");
  rangeButtons[index].focus();
}

function openRange(index) {
  if (activeRange === index) {
    closeRange();
    message("");
    return;
  }
  activeRange = index;
  rangeButtons.forEach((button, position) => {
    button.setAttribute("aria-expanded", String(position === index));
  });
  controls.hidden = false;
  controls.disabled = false;
  fillRange(...ranges[index].map(toUtc));
  message("");
}

function parseRange(range, requireOrder = true) {
  if (!Array.isArray(range) || range.length !== 2 ||
      !range.every(iso => typeof iso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(iso) &&
        Number.isFinite(toUtc(iso).getTime()) && toIso(toUtc(iso)) === iso) ||
      (requireOrder && range[0] > range[1])) {
    throw new Error("O calendário retornou um intervalo inválido.");
  }
  return range;
}

function setBusy(value) {
  busy = value;
  rangeButtons.forEach(button => { button.disabled = value || invalidSavedConfig; });
}

function todayRange() {
  const today = localToday();
  return [monthAt(today), today].map(toIso);
}

async function openTableauPicker(index) {
  if (busy || invalidSavedConfig) return;
  setBusy(true);
  message("");
  try {
    const url = new URL(location.href);
    url.search = "?picker=1";
    url.hash = "";
    const appearance = normalizeAppearance(targets.appearance);
    const response = await tableau.extensions.ui.displayDialogAsync(
      url.href,
      JSON.stringify({
        label: appearance.titles[index], range: ranges[index] || todayRange(),
        appearance, workbookFont: workbookFontFamily()
      }),
      { width: 530, height: 530, dialogStyle: tableau.DialogStyle.Modal }
    );
    const selection = JSON.parse(response);
    if (selection === null) return;
    const requested = parseRange(selection);
    message("Aplicando período…");
    if (targets.mode === "filters") {
      const jobs = await filterTargets(dashboard, targets, index);
      await applyWorksheetRanges(jobs, ...requested.map(toUtc));
    } else {
      await updateTableau(index, requested);
    }
    ranges[index] = requested;
    showSummary(index);
    message("");
  } catch (error) {
    if (error.errorCode !== tableau.ErrorCodes.DialogClosedByUser) {
      message(error.message || "O Tableau não conseguiu selecionar o período.", true);
    }
  } finally {
    setBusy(false);
    rangeButtons[index].focus();
  }
}

function fillRange(first, last) {
  start.value = toIso(first);
  end.value = toIso(last);
  visibleMonth = monthAt(first);
  selectingEnd = false;
  keepStartDate = false;
  render();
}

function showPreset(preset) {
  const today = localToday();
  let first = monthAt(today);
  let last = today;
  if (preset === "previous") {
    first = monthAt(today, -1);
    last = monthAt(today, 0, 0);
  }
  const rollingDays = { last7: 7, last15: 15, last30: 30 }[preset];
  if (rollingDays) {
    first = daysFrom(today, 1 - rollingDays);
  }
  fillRange(first, last);
  message("");
}

function selectDay(iso) {
  if (!selectingEnd) {
    start.value = iso;
    end.value = "";
  } else if (iso < start.value) {
    if (keepStartDate) {
      message("Escolha uma data final igual ou posterior à data inicial.", true);
      return;
    }
    end.value = start.value;
    start.value = iso;
  } else {
    end.value = iso;
  }
  selectingEnd = !selectingEnd;
  keepStartDate = false;
  message("");
  render(iso);
}

function render(focusDate) {
  const today = toIso(localToday());
  const completeRange = Boolean(start.value && end.value && start.value < end.value);
  instruction.textContent = selectingEnd ? "Selecione a data final" : "Selecione a data inicial";
  calendars.replaceChildren();

  for (const month of [visibleMonth, monthAt(visibleMonth, 1)]) {
    const section = document.createElement("section");
    section.className = "month";
    const heading = document.createElement("h2");
    heading.textContent = monthFormat.format(month);
    const grid = document.createElement("div");
    grid.className = "days";

    for (const day of ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"]) {
      const label = document.createElement("span");
      label.className = "weekday";
      label.textContent = day;
      grid.append(label);
    }

    const emptySlots = (month.getUTCDay() + 6) % 7;
    for (let index = 0; index < emptySlots; index += 1) {
      grid.append(document.createElement("span"));
    }

    const lastDay = monthAt(month, 1, 0).getUTCDate();
    for (let day = 1; day <= lastDay; day += 1) {
      const date = monthAt(month, 0, day);
      const iso = toIso(date);
      const isStart = iso === start.value;
      const isEnd = iso === end.value;
      const endpoint = isStart || isEnd;
      const inRange = iso > start.value && iso < end.value;
      const button = document.createElement("button");
      button.className = "day";
      button.type = "button";
      button.dataset.date = iso;
      const number = document.createElement("span");
      number.className = "day-number";
      number.textContent = day;
      button.append(number);
      button.classList.toggle("endpoint", endpoint);
      button.classList.toggle("range-start", completeRange && isStart);
      button.classList.toggle("range-end", completeRange && isEnd);
      button.classList.toggle("in-range", inRange);
      button.classList.toggle("today", iso === today);
      button.setAttribute("aria-label", dateFormat.format(date));
      button.setAttribute("aria-pressed", String(endpoint || inRange));
      if (iso === today) button.setAttribute("aria-current", "date");
      grid.append(button);
    }
    section.append(heading, grid);
    calendars.append(section);
  }

  if (focusDate) calendars.querySelector('[data-date="' + focusDate + '"]')?.focus();
}

function parameterDate(value) {
  const native = value.nativeValue;
  if (native instanceof Date && Number.isFinite(native.getTime())) return toIso(native);
  if (typeof native === "string" && /^\d{4}-\d{2}-\d{2}(?:$|T| )/.test(native)) {
    const iso = native.slice(0, 10);
    const date = toUtc(iso);
    if (Number.isFinite(date.getTime()) && toIso(date) === iso) return iso;
  }
  throw new Error("O Tableau retornou uma data inválida.");
}

async function loadRanges() {
  const results = await Promise.allSettled(ranges.map(async (_, index) => {
    if (targets.mode === "parameters") {
      const parameters = await getParameters(index);
      return parameters.map(parameter => parameterDate(parameter.currentValue));
    }
    const jobs = await filterTargets(dashboard, targets, index);
    const limits = jobs.map(job => filterRange(job.filter));
    const [first, last] = limits[0];
    if (!first || !last ||
        limits.some(([min, max]) => !min || !max || toIso(min) !== toIso(first) || toIso(max) !== toIso(last))) return null;
    return [first, last].map(toIso);
  }));
  results.forEach((result, index) => {
    ranges[index] = result.status === "fulfilled" ? result.value : null;
    showSummary(index);
  });
  const failure = results.find(result => result.status === "rejected");
  message(failure ? failure.reason.message : "", Boolean(failure));
}

async function configure() {
  if (!dashboard || busy) return;
  setBusy(true);
  message("");
  try {
    const catalog = await configurationCatalog(dashboard);
    const url = new URL("config-0.4.html", location.href);
    const payload = JSON.stringify({ catalog, targets, workbookFont: workbookFontFamily() });
    const result = await tableau.extensions.ui.displayDialogAsync(
      url.href, payload, { width: 560, height: 600, dialogStyle: tableau.DialogStyle.Modal }
    );
    const nextTargets = JSON.parse(result);
    if (nextTargets === null) return;
    validateTargets(nextTargets, catalog);
    const settings = tableau.extensions.settings;
    const previous = settings.get(settingsKey);
    settings.set(settingsKey, JSON.stringify(nextTargets));
    try {
      await settings.saveAsync();
    } catch (error) {
      if (previous === undefined) settings.erase(settingsKey);
      else settings.set(settingsKey, previous);
      throw error;
    }
    targets = nextTargets;
    invalidSavedConfig = false;
    showAppearance();
    await loadRanges();
  } catch (error) {
    if (error.errorCode !== tableau.ErrorCodes.DialogClosedByUser) {
      message(error.message || "O Tableau não conseguiu salvar a configuração.", true);
    }
  } finally {
    setBusy(false);
    if (invalidSavedConfig && !status.textContent) {
      message("Abra Configurar e salve novamente o mapeamento dos períodos.", true);
    }
  }
}

async function getParameters(index) {
  const parameters = await dashboard.getParametersAsync();
  return targets.parameters[index].map(name => {
    const parameter = parameters.find(item => item.name === name);
    if (!parameter || parameter.dataType !== tableau.DataType.Date) {
      throw new Error('Crie o parâmetro "' + name + '" com o tipo Data.');
    }
    return parameter;
  });
}

async function updateTableau(index, requested) {
  const parameters = await getParameters(index);
  const original = parameters.map(parameter => parameterDate(parameter.currentValue));
  // Move the end first when the new start is beyond the old end.
  const order = requested[0] > original[1] ? [1, 0] : [0, 1];
  const changed = [];
  try {
    for (const index of order) {
      if (requested[index] === original[index]) continue;
      const result = await parameters[index].changeValueAsync(toUtc(requested[index]));
      changed.push(index);
      if (parameterDate(result) !== requested[index]) {
        throw new Error('Defina os valores permitidos dos dois parâmetros como "Todos".');
      }
    }
  } catch (error) {
    try {
      for (const index of changed.reverse()) {
        const restored = await parameters[index].changeValueAsync(toUtc(original[index]));
        if (parameterDate(restored) !== original[index]) throw new Error("Data não restaurada.");
      }
    } catch {
      throw new Error("O Tableau aplicou parte da alteração. Confira os valores dos dois parâmetros e tente novamente.");
    }
    throw error;
  }
}

form.addEventListener("submit", event => {
  event.preventDefault();
  if (controls.disabled || !form.reportValidity()) return;
  if (start.value > end.value) {
    message("A data final deve ser igual ou posterior à data inicial.", true);
    end.focus();
    return;
  }
  const requested = [start.value, end.value];
  if (dialog) {
    tableau.extensions.ui.closeDialog(JSON.stringify(requested));
    return;
  }
  ranges[activeRange] = requested;
  showSummary(activeRange);
  closeRange();
  message("Prévia de aplicação · " + formatRange(requested));
});

rangeButtons.forEach((button, index) => {
  button.addEventListener("click", () => {
    if (preview) openRange(index);
    else void openTableauPicker(index);
  });
});

function cancelSelection() {
  if (dialog) {
    tableau.extensions.ui.closeDialog("null");
    return;
  }
  closeRange();
  message("");
}

document.querySelector("#cancel").addEventListener("click", cancelSelection);
form.addEventListener("keydown", event => {
  if (event.key === "Escape" && !controls.disabled) {
    event.preventDefault();
    cancelSelection();
  }
});

calendars.addEventListener("click", event => {
  const day = event.target.closest("button[data-date]");
  if (day) selectDay(day.dataset.date);
});

for (const [id, offset] of [["previous", -1], ["next", 1]]) {
  document.querySelector("#" + id).addEventListener("click", () => {
    visibleMonth = monthAt(visibleMonth, offset);
    render();
  });
}

for (const button of document.querySelectorAll("[data-preset]")) {
  button.addEventListener("click", () => showPreset(button.dataset.preset));
}

start.addEventListener("change", () => {
  const date = toUtc(start.value);
  if (Number.isFinite(date.getTime())) visibleMonth = monthAt(date);
  // The next click on the calendar completes the range started in this field.
  selectingEnd = Boolean(start.value);
  keepStartDate = selectingEnd;
  if (start.value && end.value < start.value) end.value = "";
  message("");
  render();
});

end.addEventListener("change", () => {
  selectingEnd = Boolean(start.value && !end.value);
  keepStartDate = selectingEnd;
  if (start.value && end.value && end.value < start.value) {
    selectingEnd = true;
    keepStartDate = true;
    message("Escolha uma data final igual ou posterior à data inicial.", true);
  } else {
    message("");
  }
  render();
});

async function initialize() {
  try {
    if (dialog) {
      document.body.classList.add("picker-window");
      document.querySelector(".ranges").hidden = true;
      const payload = JSON.parse(await tableau.extensions.initializeDialogAsync());
      document.querySelector("h1").textContent = payload.label;
      applyTypography(payload.appearance, payload.workbookFont);
      fillRange(...parseRange(payload.range, false).map(toUtc));
      controls.hidden = false;
      controls.disabled = false;
      message("");
      return;
    }
    if (preview) {
      document.querySelector("#demo").hidden = false;
      const today = localToday();
      ranges[0] = [monthAt(today), today].map(toIso);
      ranges[1] = [monthAt(today, -1), monthAt(today, 0, 0)].map(toIso);
    } else {
      document.body.classList.add("dashboard-control");
      if (!window.tableau?.extensions) throw new Error("A biblioteca da API do Tableau não carregou.");
      await tableau.extensions.initializeAsync({ configure });
      dashboard = tableau.extensions.dashboardContent.dashboard;
      const saved = tableau.extensions.settings.get(settingsKey);
      if (saved !== undefined && saved !== null) {
        try {
          targets = parseSavedTargets(saved);
        } catch {
          invalidSavedConfig = true;
        }
      }
      workbookFormatting = tableau.extensions.environment?.workbookFormatting;
      showAppearance();
      dashboard.addEventListener(tableau.TableauEventType.WorkbookFormattingChanged, event => {
        workbookFormatting = event.formatting;
        showAppearance();
      });
      if (invalidSavedConfig) {
        message("Abra Configurar e salve novamente o mapeamento dos períodos.", true);
      } else {
        await loadRanges();
      }
    }
    rangeButtons.forEach((button, index) => {
      showSummary(index);
      if (!preview) {
        button.setAttribute("aria-haspopup", "dialog");
        button.removeAttribute("aria-expanded");
        button.removeAttribute("aria-controls");
      }
      button.disabled = invalidSavedConfig;
    });
    if (preview) message("");
  } catch (error) {
    message((error.message || "Falha na conexão com o Tableau.") + " Confira a configuração e recarregue a extensão.", true);
  }
}

initialize();
