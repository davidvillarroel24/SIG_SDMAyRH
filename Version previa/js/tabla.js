    // ==========================================================================
    // MODULO: TABLA (DataTables)
    // Columnas visibles por hoja, construccion de columnas y render de filas.
    // ==========================================================================

    const getRowsForCurrentSheet = () => {
      if (!state.hojaFilter) return rows;
      return rows.filter((row) => String(getCellText(row, '__sourceSheet')).toLowerCase() === String(state.hojaFilter).trim().toLowerCase());
    };

    const getCurrentSheetKey = () => state.hojaFilter || '__all__';

    const getVisibleColumnsForSheet = (available) => {
      const sheetKey = getCurrentSheetKey();
      const saved = Array.isArray(state.visibleColumnsBySheet[sheetKey]) ? state.visibleColumnsBySheet[sheetKey] : [];
      const validSelections = saved.filter((name) => available.some(field => field.name === name));
      if (validSelections.length && validSelections.length === saved.length) return validSelections;
      return getDefaultVisibleColumns(available);
    };

    const getDefaultVisibleColumns = (available) => {
      const docsField = available.find(field => normalizeFieldName(field.name) === 'documentos');
      const otherFields = available.filter(field => normalizeFieldName(field.name) !== 'documentos').slice(0, Math.max(0, 8 - (docsField ? 1 : 0))).map(field => field.name);
      if (docsField) {
        return [docsField.name, ...otherFields];
      }
      return otherFields;
    };

    const getAvailableColumns = () => {
      const sheetRows = getRowsForCurrentSheet();
      const presentFields = new Set();
      sheetRows.forEach((row) => {
        Object.keys(row).forEach((key) => {
          if (!key || ['__rowId', '__sourceLabel', '__sourceSheet', '__sourceCategory', '__documentos'].includes(key)) return;
          presentFields.add(normalizeFieldName(key));
        });
      });
      const allVisibleFields = fieldDefinitions.filter(field => field.name && field.visibleTabla !== false && !['__rowId', '__sourceLabel', '__sourceSheet', '__sourceCategory', '__documentos'].includes(field.name));
      const docsField = allVisibleFields.find(field => normalizeFieldName(field.name) === 'documentos');
      return allVisibleFields.filter((field) => presentFields.has(normalizeFieldName(field.name)) || normalizeFieldName(field.name) === 'documentos');
    };

    const renderColumnVisibilityDropdown = () => {
      const container = document.getElementById('columnVisibilityDropdownMenu');
      if (!container) return;
      const available = getAvailableColumns();
      const selectedColumnNames = getVisibleColumnsForSheet(available);
      const sheetKey = getCurrentSheetKey();
      state.visibleColumnsBySheet[sheetKey] = [...selectedColumnNames];
      const selected = new Set(selectedColumnNames);
      container.innerHTML = available.map((field) => `
        <label class="dropdown-item d-flex align-items-center gap-2 mb-1">
          <input class="form-check-input column-visibility-checkbox" type="checkbox" value="${escapeHtml(field.name)}" ${selected.has(field.name) ? 'checked' : ''}>
          <span>${escapeHtml(getFieldLabel(field))}</span>
        </label>
      `).join('');
    };

    const buildTableColumns = () => {
      const available = getAvailableColumns();
      const selected = new Set(getVisibleColumnsForSheet(available));
      return available.filter(field => selected.has(field.name)).map((field) => ({
        title: getFieldLabel(field),
        data: field.name,
        orderable: normalizeFieldName(field.name) !== 'documentos',
        render: (value, type, row) => {
          if (normalizeFieldName(field.name) === 'documentos') {
            const docs = getDocumentsForRow(row);
            if (!docs.length) return '<span class="text-muted">No hay documentos</span>';
            return `<button type="button" class="btn btn-sm btn-outline-primary btn-docs">Ver (${docs.length})</button>`;
          }
          if (value === null || value === undefined || value === '') return '-';
          if (isCurrencyField(field)) {
            const numeric = parseNumber(value);
            if (numeric !== null) return type === 'display' ? formatCurrencyValue(numeric) : numeric;
          }
          if (isAreaField(field)) {
            const numeric = parseNumber(value);
            if (numeric !== null) return type === 'display' ? formatAreaValue(numeric) : numeric;
          }
          if (isNumericField(field)) {
            const numeric = parseNumber(value);
            if (numeric !== null) return type === 'display' ? formatDecimal(numeric) : numeric;
          }
          if (typeof value === 'number' && Number.isFinite(value)) {
            return type === 'display' ? formatDecimal(value) : value;
          }
          if (typeof value === 'string' && /^[\s\d.,-]+$/.test(value)) {
            const numeric = parseNumber(value);
            if (numeric !== null) return type === 'display' ? formatDecimal(numeric) : numeric;
          }
          if (Array.isArray(value)) return value.length ? value.map(v => String(v)).join(', ') : '-';
          if (typeof value === 'object') return JSON.stringify(value);
          return String(value);
        }
      }));
    };

    const renderTable = (filteredRows) => {
      if (dataTable) {
        dataTable.clear().destroy();
        dataTable = null;
      }
      const tableEl = document.getElementById('proyectosTable');
      if (!tableEl) return;
      tableEl.innerHTML = '';
      const columns = buildTableColumns();
      if (!columns.length) {
        tableEl.innerHTML = '<div class="alert alert-secondary">No hay columnas visibles para mostrar.</div>';
        return;
      }
      dataTable = $('#proyectosTable').DataTable({
        data: filteredRows,
        columns,
        pageLength: 15,
        lengthMenu: [[10, 15, 25, 50, 100], [10, 15, 25, 50, 100]],
        order: [[0, 'asc']],
        language: { url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' },
        columnDefs: [{ targets: '_all', defaultContent: '-' }]
      });
    };


