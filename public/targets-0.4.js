"use strict";

const settingsKey = "periodTargets";
const defaultTargets = {
  mode: "parameters",
  parameters: [
    ["p_Data_Inicial", "p_Data_Final"],
    ["p_Comparacao_Inicial", "p_Comparacao_Final"]
  ],
  filters: []
};

const defaultPeriodTitles = ["Período principal", "Período de comparação"];

function normalizeAppearance(appearance) {
  const text = value => typeof value === "string" ? value.replace(/[\x00-\x1f\x7f]/g, " ").trim() : "";
  const size = value => Number.isInteger(value) && value >= 10 && value <= 20 ? value : null;
  return {
    titles: defaultPeriodTitles.map((title, index) => text(appearance?.titles?.[index]).slice(0, 70) || title),
    font: text(appearance?.font).slice(0, 80),
    titleSize: size(appearance?.titleSize),
    valueSize: size(appearance?.valueSize)
  };
}

async function dateRangeFilter(worksheet, filter) {
  if (filter.filterType !== tableau.FilterType.Range) return null;
  const { dataType } = await filter.getFieldAsync();
  if (![tableau.DataType.Date, tableau.DataType.DateTime].includes(dataType)) return null;
  const sheets = await filter.getAppliedWorksheetsAsync();
  return {
    id: filter.fieldId,
    name: filter.fieldName,
    dataType,
    shared: sheets.some(name => name !== worksheet.name)
  };
}

async function configurationCatalog(dashboard) {
  const [parameters, worksheets] = await Promise.all([
    dashboard.getParametersAsync(),
    Promise.all(dashboard.worksheets.map(async worksheet => {
      try {
        const filters = await worksheet.getFiltersAsync();
        const fields = await Promise.allSettled(filters.map(filter => dateRangeFilter(worksheet, filter)));
        return {
          name: worksheet.name,
          fields: fields.filter(result => result.status === "fulfilled" && result.value).map(result => result.value),
          unavailable: fields.some(result => result.status === "rejected")
        };
      } catch {
        return { name: worksheet.name, fields: [], unavailable: true };
      }
    }))
  ]);
  return {
    parameters: parameters.filter(parameter => parameter.dataType === tableau.DataType.Date).map(parameter => parameter.name),
    worksheets
  };
}

function validateTargetStructure(targets) {
  const isName = value => typeof value === "string" && value.trim().length > 0;
  if (!["parameters", "filters"].includes(targets?.mode) ||
      !Array.isArray(targets.parameters) || targets.parameters.length !== 2 ||
      !targets.parameters.every(pair => Array.isArray(pair) && pair.length === 2 && pair.every(isName)) ||
      !Array.isArray(targets.filters) ||
      !targets.filters.every(target => [0, 1].includes(target?.period) && isName(target.worksheet) && isName(target.field))) {
    throw new Error("Abra Configurar e salve novamente o mapeamento dos períodos.");
  }
  if (targets.mode === "parameters" && new Set(targets.parameters.flat()).size !== 4) {
    throw new Error("Selecione quatro parâmetros de data diferentes.");
  }
  if (targets.mode === "filters" &&
      (new Set(targets.filters.map(target => target.worksheet)).size !== targets.filters.length ||
      ![0, 1].every(period => targets.filters.some(target => target.period === period)))) {
    throw new Error("Selecione pelo menos uma planilha diferente para cada período.");
  }
}

function parseSavedTargets(saved) {
  const targets = JSON.parse(saved);
  validateTargetStructure(targets);
  return { ...targets, appearance: normalizeAppearance(targets.appearance) };
}

function validateTargets(targets, catalog) {
  validateTargetStructure(targets);
  if (targets.mode === "parameters") {
    const parameters = targets.parameters.flat();
    if (parameters.some(name => !catalog.parameters.includes(name))) {
      throw new Error("Selecione quatro parâmetros de data diferentes.");
    }
    return;
  }
  for (const target of targets.filters) {
    const sheet = catalog.worksheets.find(item => item.name === target.worksheet);
    if (!sheet?.fields.some(field => field.id === target.field && !field.shared)) {
      throw new Error('Revise o filtro de data da planilha "' + target.worksheet + '".');
    }
  }
}

async function resolveFilter(worksheet, fieldId) {
  const filter = (await worksheet.getFiltersAsync()).find(item => item.fieldId === fieldId);
  const field = filter && await dateRangeFilter(worksheet, filter);
  if (!field || field.shared) {
    throw new Error('Revise o filtro de intervalo em "' + worksheet.name + '". Aplique-o somente a essa planilha.');
  }
  return { worksheet, filter, field };
}

async function filterTargets(dashboard, targets, period) {
  const selected = targets.filters.filter(target => target.period === period);
  if (!selected.length) throw new Error("Selecione uma planilha para este período em Configurar.");
  return Promise.all(selected.map(target => {
    const worksheet = dashboard.worksheets.find(item => item.name === target.worksheet);
    if (!worksheet) throw new Error('A planilha "' + target.worksheet + '" não está mais no painel.');
    return resolveFilter(worksheet, target.field);
  }));
}

function nativeFilterDate(value) {
  const native = value?.nativeValue;
  if (native instanceof Date && Number.isFinite(native.getTime())) return native;
  if (typeof native !== "string") return undefined;
  const parts = /^(\d{1,4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{1,2}):(\d{1,2})(?:\.\d+)?Z?)?$/.exec(native);
  if (!parts) return undefined;
  const [, year, month, day, hour = 0, minute = 0, second = 0] = parts;
  const date = new Date(0);
  date.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
  date.setUTCHours(Number(hour), Number(minute), Number(second));
  return date;
}

function filterRange(filter) {
  return [nativeFilterDate(filter.minValue), nativeFilterDate(filter.maxValue)];
}

async function applyWorksheetRanges(jobs, first, last) {
  const completed = [];
  let current;
  try {
    for (const job of jobs) {
      current = job;
      const max = new Date(last);
      if (job.field.dataType === tableau.DataType.DateTime) max.setUTCHours(23, 59, 59);
      await job.worksheet.applyRangeFilterAsync(job.field.name, {
        min: first, max, nullOption: tableau.FilterNullOption.NonNullValues
      });
      completed.push(job);
    }
  } catch (error) {
    const restored = await Promise.allSettled(completed.map(({ worksheet, filter, field }) => {
      const [min, max] = filterRange(filter);
      const nullOption = filter.includeNullValues ? tableau.FilterNullOption.AllValues : tableau.FilterNullOption.NonNullValues;
      return Promise.resolve().then(() => worksheet.applyRangeFilterAsync(field.name, { min, max, nullOption }));
    }));
    if (restored.some(result => result.status === "rejected")) {
      throw new Error("A aplicação foi parcial. Confira os filtros nas planilhas e tente novamente.");
    }
    throw new Error('Falha ao filtrar "' + current.worksheet.name + '". ' + (error.message || ""));
  }
}
