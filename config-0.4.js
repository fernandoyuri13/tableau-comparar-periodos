"use strict";

const form = document.querySelector("#config");
const mode = document.querySelector("#mode");
const status = document.querySelector("#status");
const labels = defaultPeriodTitles;
let catalog;
let previousTargets;

function option(select, value, label) {
  select.add(new Option(label, value));
}

function makeRow(container, label, description) {
  const row = document.createElement("label");
  const title = document.createElement("span");
  title.textContent = label;
  const select = document.createElement("select");
  row.append(title, select);
  if (description) {
    const hint = document.createElement("small");
    hint.textContent = description;
    row.append(hint);
  }
  container.append(row);
  return select;
}

function renderParameters(targets) {
  const rows = document.querySelector("#parameter-rows");
  return labels.map((label, period) => {
    const group = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = label;
    group.append(legend);
    rows.append(group);
    return ["Data inicial", "Data final"].map((name, index) => {
      const select = makeRow(group, name);
      option(select, "", "Selecione um parâmetro");
      for (const parameter of catalog.parameters) option(select, parameter, parameter);
      const savedName = targets.parameters[period][index];
      if (catalog.parameters.includes(savedName)) select.value = savedName;
      return select;
    });
  });
}

function renderFilters(targets) {
  const rows = document.querySelector("#filter-rows");
  if (!catalog.worksheets.length) rows.textContent = "Este painel não contém planilhas.";
  return catalog.worksheets.map(worksheet => {
    const fields = worksheet.fields.filter(field => !field.shared);
    let hint = "";
    if (!fields.length) {
      hint = worksheet.unavailable ? "Não foi possível ler todos os filtros."
        : "Adicione um filtro de intervalo de datas exclusivo desta planilha.";
    }
    const select = makeRow(rows, worksheet.name, hint);
    option(select, "", "Não filtrar");
    select.disabled = !fields.length;
    labels.forEach((label, period) => {
      if (!fields.length) return;
      const group = document.createElement("optgroup");
      group.label = label;
      select.append(group);
      fields.forEach(field => group.append(new Option(field.name, JSON.stringify([period, field.id]))));
    });
    const target = targets.filters.find(item => item.worksheet === worksheet.name);
    if (target && fields.some(field => field.id === target.field)) {
      select.value = JSON.stringify([target.period, target.field]);
    }
    return { worksheet: worksheet.name, select };
  });
}

function showMode() {
  document.querySelector("#parameter-controls").hidden = mode.value !== "parameters";
  document.querySelector("#filter-controls").hidden = mode.value !== "filters";
  status.textContent = "";
}

mode.addEventListener("change", showMode);
document.querySelector("#cancel").addEventListener("click", () => tableau.extensions.ui.closeDialog("null"));

async function initializeConfig() {
  try {
    const payload = JSON.parse(await tableau.extensions.initializeDialogAsync());
    ({ catalog, targets: previousTargets } = payload);
    const appearance = normalizeAppearance(previousTargets.appearance);
    const titleInputs = labels.map((_, index) => document.querySelector("#title-" + index));
    const font = document.querySelector("#font");
    const titleSize = document.querySelector("#title-size");
    const valueSize = document.querySelector("#value-size");
    titleInputs.forEach((input, index) => { input.value = appearance.titles[index]; });
    font.value = appearance.font;
    if (payload.workbookFont) font.placeholder = payload.workbookFont;
    titleSize.value = appearance.titleSize ?? "";
    valueSize.value = appearance.valueSize ?? "";
    const parameters = renderParameters(previousTargets);
    const filters = renderFilters(previousTargets);
    mode.value = previousTargets.mode;
    form.addEventListener("submit", event => {
      event.preventDefault();
      const targets = {
        ...previousTargets,
        mode: mode.value,
        appearance: normalizeAppearance({
          titles: titleInputs.map(input => input.value),
          font: font.value,
          titleSize: titleSize.valueAsNumber,
          valueSize: valueSize.valueAsNumber
        })
      };
      if (mode.value === "parameters") {
        targets.parameters = parameters.map(pair => pair.map(select => select.value));
      } else {
        targets.filters = filters.filter(row => row.select.value).map(({ worksheet, select }) => {
          const [period, field] = JSON.parse(select.value);
          return { worksheet, period, field };
        });
      }
      try {
        validateTargets(targets, catalog);
        tableau.extensions.ui.closeDialog(JSON.stringify(targets));
      } catch (error) {
        status.textContent = error.message;
        status.classList.add("error");
      }
    });
    form.hidden = false;
    showMode();
  } catch (error) {
    status.textContent = error.message || "Falha ao abrir a configuração.";
    status.classList.add("error");
  }
}

initializeConfig();
