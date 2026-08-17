    // ==========================================================================
    // MODULO: FILTROS, AGRUPACION Y RESUMEN
    // Filtros dinamicos por campo, agrupacion, agregaciones y tarjetas de indicadores.
    // ==========================================================================

    const isSpecialNumericFilterField = (field) => {
      return field && field.name && ['familias_beneficiadas', 'area_riego'].includes(normalizeFieldName(field.name));
    };

    const isSpecialNumericFilterName = (name) => {
      return ['familias_beneficiadas', 'area_riego'].includes(normalizeFieldName(name));
    };

    const compareNumericValue = (rowValue, op, filterValue, filterValueTo) => {
      const numeric = parseNumber(rowValue);
      const value = parseNumber(filterValue);
      const valueTo = parseNumber(filterValueTo);
      if (numeric === null) return false;
      switch (op) {
        case '>=':
          return value !== null && numeric >= value;
        case '<=':
          return value !== null && numeric <= value;
        case '>':
          return value !== null && numeric > value;
        case '<':
          return value !== null && numeric < value;
        case '=':
          return value !== null && numeric === value;
        case 'between':
          return value !== null && valueTo !== null && numeric >= Math.min(value, valueTo) && numeric <= Math.max(value, valueTo);
        default:
          return true;
      }
    };

    const getDynamicFilterFields = () => {
      const listFields = fieldDefinitions.filter(field => field.name && isListField(field));
      const numericFields = fieldDefinitions.filter(field => field.name && isSpecialNumericFilterField(field));
      const fields = [...listFields];
      numericFields.forEach((field) => {
        if (!fields.some(item => normalizeFieldName(item.name) === normalizeFieldName(field.name))) {
          fields.push(field);
        }
      });
      if (fields.length) return fields;
      return fieldDefinitions.filter(field => field.name && !isNumericField(field) && !['__rowId', '__sourceLabel', '__sourceSheet', '__sourceCategory', '__documentos'].includes(field.name)).slice(0, 8);
    };

    const getIndicatorFields = () => fieldDefinitions.filter(field => field.name && (field.participaResumen || field.rol === 'Indicador' || field.agregacion === 'Porcentaje' || field.agregacion === 'Promedio' || field.agregacion === 'Suma'));

    const getNumericValuesForField = (fieldName, sourceRows) => sourceRows.map(row => parseNumber(row[fieldName])).filter(value => value !== null);

    const getGroupByFieldName = () => {
      const raw = String(state.groupByField || 'REGIONES').trim().toUpperCase();
      return ['REGIONES', 'PROVINCIA', 'MUNICIPIO'].includes(raw) ? raw : 'REGIONES';
    };

    const getGroupByFieldLabel = () => {
      const map = { REGIONES: 'Región', PROVINCIA: 'Provincia', MUNICIPIO: 'Municipio' };
      return map[getGroupByFieldName()] || 'Región';
    };

    const getFamiliesFieldName = (row) => {
      if (!row || typeof row !== 'object') return 'FAMILIAS_BENEFICIADAS';
      return Object.keys(row).find((key) => normalizeFieldName(key) === 'familias_beneficiadas') || 'FAMILIAS_BENEFICIADAS';
    };

    const findRowKeyByCandidates = (row, candidateTokens = []) => {
      if (!row || typeof row !== 'object') return null;
      const keys = Object.keys(row);
      const normalized = keys.map((key) => ({ key, token: normalizeKeyToken(key) }));
      for (const candidate of candidateTokens) {
        const candidateToken = normalizeKeyToken(candidate);
        const exact = normalized.find((item) => item.token === candidateToken);
        if (exact) return exact.key;
      }
      for (const candidate of candidateTokens) {
        const candidateToken = normalizeKeyToken(candidate);
        const partial = normalized.find((item) => item.token.includes(candidateToken));
        if (partial) return partial.key;
      }
      return null;
    };

    const getRowNumberByCandidates = (row, candidateTokens = []) => {
      const key = findRowKeyByCandidates(row, candidateTokens);
      if (!key) return null;
      return parseNumber(row[key]);
    };

    const getFamiliesByGroupSummary = (sourceRows) => {
      const groupFieldName = getGroupByFieldName();
      const totalsByGroup = new Map();
      sourceRows.forEach((row) => {
        const groupValue = getCellText(row, groupFieldName);
        if (!groupValue) return;
        const familiesFieldName = getFamiliesFieldName(row);
        const numericValue = parseNumber(row[familiesFieldName]);
        if (numericValue === null) return;
        totalsByGroup.set(groupValue, (totalsByGroup.get(groupValue) || 0) + numericValue);
      });
      return Array.from(totalsByGroup.entries())
        .map(([label, total]) => ({ label, total }))
        .sort((a, b) => b.total - a.total);
    };

    const aggregateFieldValues = (field, sourceRows, fullRows = rows) => {
      const numericValues = getNumericValuesForField(field.name, sourceRows);
      if (!numericValues.length) return null;
      const aggregation = String(field.agregacion || 'Ninguna').trim();
      switch (aggregation) {
        case 'Promedio':
          return numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
        case 'Porcentaje': {
          const denominator = getNumericValuesForField(field.name, fullRows);
          const total = denominator.reduce((sum, value) => sum + value, 0);
          if (!total) return 0;
          return (numericValues.reduce((sum, value) => sum + value, 0) / total) * 100;
        }
        case 'Suma':
          return numericValues.reduce((sum, value) => sum + value, 0);
        case 'Conteo':
          return numericValues.length;
        default:
          return numericValues.length ? numericValues[0] : null;
      }
    };

    const renderSummaries = (filteredRows) => {
      const container = document.getElementById('summariesRow');
      if (!container) return;
      const indicatorFields = getIndicatorFields().filter((field) => normalizeFieldName(field.name) !== 'familias_beneficiadas');
      const cards = [];
      cards.push(`
        <div class="col-6 col-md-4 col-xl-3">
          <div class="card card-visual shadow-sm p-3 h-100">
            <h6 class="text-secondary">Total de registros</h6>
            <div class="mt-3">
              <h3 class="fw-bold">${formatInteger(filteredRows.length)}</h3>
              <div class="text-muted small">Conteo según filtros aplicados</div>
            </div>
          </div>
        </div>`);
      const familiesSummary = getFamiliesByGroupSummary(filteredRows);
      if (familiesSummary.length) {
        const totalFamilies = familiesSummary.reduce((sum, item) => sum + item.total, 0);
        const groupLabel = getGroupByFieldLabel();
        const detailRows = familiesSummary.slice(0, 6).map((item) => `
          <div class="d-flex justify-content-between align-items-center py-1">
            <span>${escapeHtml(item.label)}</span>
            <strong>${formatDecimal(item.total)}</strong>
          </div>`).join('');
        cards.push(`
          <div class="col-12 col-lg-6">
            <div class="card card-visual shadow-sm p-3 h-100">
              <h6 class="text-secondary">Familias beneficiadas por ${escapeHtml(groupLabel)}</h6>
              <div class="mt-3">
                <h3 class="fw-bold">${formatDecimal(totalFamilies)}</h3>
                <div class="text-muted small">Suma agrupada por ${escapeHtml(groupLabel.toLowerCase())}</div>
                <div class="mt-3 small">${detailRows}</div>
              </div>
            </div>
          </div>`);
      }
      if (indicatorFields.length) {
        cards.push(...indicatorFields.map((field) => {
          const value = aggregateFieldValues(field, filteredRows, rows);
          const label = field.label || field.name;
          const note = `${field.agregacion || 'Valor'} • ${field.name}`;
          return `
            <div class="col-6 col-md-4 col-xl-3">
              <div class="card card-visual shadow-sm p-3 h-100">
                <h6 class="text-secondary">${escapeHtml(label)}</h6>
                <div class="mt-3">
                  <h3 class="fw-bold">${formatValueByField(field, value)}</h3>
                  <div class="text-muted small">${escapeHtml(note)}</div>
                </div>
              </div>
            </div>`;
        }));
      }
      if (!cards.length) {
        container.innerHTML = '<div class="col-12"><div class="alert alert-secondary">No hay indicadores definidos en el esquema.</div></div>';
        return;
      }
      container.innerHTML = cards.join('');
    };

    const renderSheetFilter = () => {
      const select = document.getElementById('filterHoja');
      if (!select) return;
      const currentValue = state.hojaFilter;
      const sheets = uniqueValues(rows.map(row => getCellText(row, '__sourceSheet')));
      select.innerHTML = '<option value="">Todas</option>' + sheets.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
      if (sheets.includes(currentValue)) {
        select.value = currentValue;
      } else {
        select.value = '';
        state.hojaFilter = '';
      }
    };

    const renderCategoryFilter = () => {
      const select = document.getElementById('filterCategoria');
      if (!select) return;
      const currentValue = state.categoryFilter;
      const categories = uniqueValues(rows.map(getCategoryValue));
      select.innerHTML = '<option value="">Todas</option>' + categories.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
      if (categories.includes(currentValue)) {
        select.value = currentValue;
      } else {
        select.value = '';
        state.categoryFilter = '';
      }
    };

    const renderDynamicFilters = () => {
      const container = document.getElementById('dynamicFiltersRow');
      if (!container) return;
      const fields = getDynamicFilterFields();
      if (!fields.length) {
        container.innerHTML = '';
        return;
      }
      container.innerHTML = fields.map((field) => {
        if (isSpecialNumericFilterField(field)) {
          const savedFilter = state.dynamicFilters[field.name] || { op: '>=', value: '', valueTo: '' };
          const op = savedFilter.op || '>=';
          const value = savedFilter.value ?? '';
          const valueTo = savedFilter.valueTo ?? '';
          return `
            <div class="col-12 col-md-6 col-xl-3">
              <label class="form-label">${escapeHtml(getFieldLabel(field))}</label>
              <div class="input-group">
                <select class="form-select numeric-filter-op" data-field-name="${escapeHtml(field.name)}">
                  <option value=">=">Mayor o igual</option>
                  <option value="<=">Menor o igual</option>
                  <option value=">">Mayor que</option>
                  <option value="<">Menor que</option>
                  <option value="=">Igual a</option>
                  <option value="between">Entre</option>
                </select>
                <input type="number" step="any" class="form-control numeric-filter-value" data-field-name="${escapeHtml(field.name)}" placeholder="Valor" value="${escapeHtml(value)}">
                <input type="number" step="any" class="form-control numeric-filter-value-to ${op === 'between' ? '' : 'd-none'}" data-field-name="${escapeHtml(field.name)}" placeholder="Hasta" value="${escapeHtml(valueTo)}">
              </div>
            </div>
          `;
        }
        return `
          <div class="col-12 col-md-6 col-xl-3">
            <label class="form-label">${escapeHtml(getFieldLabel(field))}</label>
            <select class="form-select dynamic-filter-select" data-field-name="${escapeHtml(field.name)}">
              <option value="">Todos</option>
            </select>
          </div>
        `;
      }).join('');

      fields.forEach((field) => {
        if (isSpecialNumericFilterField(field)) {
          const savedFilter = state.dynamicFilters[field.name] || { op: '>=', value: '', valueTo: '' };
          const opControl = container.querySelector(`.numeric-filter-op[data-field-name="${field.name}"]`);
          const valueControl = container.querySelector(`.numeric-filter-value[data-field-name="${field.name}"]`);
          const valueToControl = container.querySelector(`.numeric-filter-value-to[data-field-name="${field.name}"]`);
          if (opControl) opControl.value = savedFilter.op || '>=';
          if (valueControl) valueControl.value = savedFilter.value ?? '';
          if (valueToControl) valueToControl.value = savedFilter.valueTo ?? '';
          if (valueToControl) {
            valueToControl.classList.toggle('d-none', opControl && opControl.value !== 'between');
          }
          return;
        }
        const select = container.querySelector(`.dynamic-filter-select[data-field-name="${field.name}"]`);
        if (!select) return;
        const values = uniqueValues(rows.map(row => getCellText(row, field.name)));
        select.innerHTML = '<option value="">Todos</option>' + values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
        const savedValue = state.dynamicFilters[field.name] || '';
        select.value = values.includes(savedValue) ? savedValue : '';
      });
    };

    const applyFilters = () => {
      const filteredRows = rows.filter((row) => {
        if (state.hojaFilter && String(getCellText(row, '__sourceSheet')).toLowerCase() !== String(state.hojaFilter).trim().toLowerCase()) {
          return false;
        }
        if (state.categoryFilter && getCategoryValue(row).toLowerCase() !== String(state.categoryFilter).trim().toLowerCase()) {
          return false;
        }
        return Object.entries(state.dynamicFilters).every(([fieldName, filterValue]) => {
          if (!filterValue) return true;
          const rowValue = getCellText(row, fieldName);
          if (typeof filterValue === 'object') {
            if (!filterValue.op) return true;
            const op = filterValue.op;
            const value = String(filterValue.value || '').trim();
            const valueTo = String(filterValue.valueTo || '').trim();
            if (op === 'between') {
              if (value === '' || valueTo === '') return true;
            } else if (value === '') {
              return true;
            }
            return compareNumericValue(rowValue, op, value, valueTo);
          }
          return rowValue === filterValue;
        });
      });
      currentFilteredRows = filteredRows;
      renderSummaries(filteredRows);
      renderCharts(filteredRows);
      renderColumnVisibilityDropdown();
      renderTable(filteredRows);
      updateMap(filteredRows);
      syncPdfDesignerContext();
      if (document.getElementById('pdfDesignerLayoutRows')) {
        renderPdfDesignerLayout();
      }
    };

    const refreshView = () => {
      renderSheetFilter();
      renderCategoryFilter();
      renderDynamicFilters();
      const selects = Array.from(document.querySelectorAll('.dynamic-filter-select'));
      const numericOps = Array.from(document.querySelectorAll('.numeric-filter-op'));
      const numericValues = Array.from(document.querySelectorAll('.numeric-filter-value'));
      const numericValuesTo = Array.from(document.querySelectorAll('.numeric-filter-value-to'));
      const dynamicFilters = Object.fromEntries(selects.map((select) => [select.dataset.fieldName, select.value]).filter(([, value]) => value));
      numericOps.forEach((opControl) => {
        const fieldName = opControl.dataset.fieldName;
        const valueControl = numericValues.find(input => input.dataset.fieldName === fieldName);
        const valueToControl = numericValuesTo.find(input => input.dataset.fieldName === fieldName);
        const filter = {
          op: opControl.value,
          value: valueControl ? String(valueControl.value || '').trim() : '',
          valueTo: valueToControl ? String(valueToControl.value || '').trim() : ''
        };
        if (filter.op !== 'between') {
          if (filter.value) {
            dynamicFilters[fieldName] = filter;
          }
        } else if (filter.value || filter.valueTo) {
          dynamicFilters[fieldName] = filter;
        }
      });
      state.dynamicFilters = dynamicFilters;
      applyFilters();
    };

    const handleCategoryChange = () => {
      const select = document.getElementById('filterCategoria');
      state.categoryFilter = select ? select.value : '';
      applyFilters();
    };

    const handleSheetChange = () => {
      const select = document.getElementById('filterHoja');
      state.hojaFilter = select ? select.value : '';
      applyFilters();
    };

    const resetToAllProjects = () => {
      if (!currentUnitId) return;
      state.hojaFilter = '';
      state.categoryFilter = '';
      state.dynamicFilters = {};
      state.groupByField = 'REGIONES';
      const hojaSelect = document.getElementById('filterHoja');
      const categorySelect = document.getElementById('filterCategoria');
      const groupSelect = document.getElementById('groupByFieldSelect');
      if (hojaSelect) hojaSelect.value = '';
      if (categorySelect) categorySelect.value = '';
      if (groupSelect) groupSelect.value = 'REGIONES';
      document.querySelectorAll('.dynamic-filter-select').forEach(select => {
        select.value = '';
      });
      applyFilters();
      persistCurrentUnitContext();
    };


