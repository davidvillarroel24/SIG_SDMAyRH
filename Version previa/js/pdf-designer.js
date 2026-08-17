    // ==========================================================================
    // MODULO: DISENADOR DE PDF
    // Layout tipo grid (filas/columnas/widgets), plantillas, estimacion de
    // paginas y exportacion con html2pdf.
    // ==========================================================================

    const createDefaultPdfLayout = () => ({ rows: [createDefaultPdfRow()] });
    const createDefaultPdfPageConfig = () => ({
      orientation: 'portrait',
      header: {
        enabled: true,
        heightMm: 24,
        title: '',
        subtitle: '',
        leftLogo: '',
        rightLogo: ''
      },
      footer: {
        enabled: true,
        heightMm: 18,
        text: '',
        leftLogo: '',
        rightLogo: ''
      }
    });
    const pdfWidgetTypes = [
      { value: 'indicator', label: 'Indicador' },
      { value: 'chart', label: 'Gráfico' },
      { value: 'table', label: 'Tabla' },
      { value: 'map', label: 'Mapa' },
      { value: 'map_bolivia', label: 'Bolivia' },
      { value: 'text', label: 'Texto' },
      { value: 'image', label: 'Imagen' }
    ];

    const pdfMarkerScaleOptions = [0.5, 0.75, 1, 1.25, 1.5];
    const pdfFamiliesIndicatorOptions = [
      { name: '__familias_total__', label: 'Familias beneficiadas (Total)' },
      { name: '__familias_region__', label: 'Familias beneficiadas (Suma por Región)' },
      { name: '__familias_provincia__', label: 'Familias beneficiadas (Suma por Provincia)' },
      { name: '__familias_municipio__', label: 'Familias beneficiadas (Suma por Municipio)' }
    ];
    const PDF_LETTER_SIZE_MM = { width: 215.9, height: 279.4 };
    const PDF_FIXED_MARGINS_MM = { top: 10, right: 10, bottom: 10, left: 15 };
    const PDF_MAIN_PADDING_MM = { top: 4, right: 0, bottom: 4, left: 0 };

    const pdfRowPresets = [
      { label: '12', widths: [12] },
      { label: '6-6', widths: [6, 6] },
      { label: '4-4-4', widths: [4, 4, 4] },
      { label: '3-3-3-3', widths: [3, 3, 3, 3] }
    ];

    const createPdfId = (prefix = 'pdf') => {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return `${prefix}-${window.crypto.randomUUID()}`;
      }
      return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    };

    const createDefaultPdfColumn = (width = 12, widgetType = 'indicator') => ({
      id: createPdfId('pdf-col'),
      width,
      widgetType,
      widgetTitle: '',
      config: {
        fieldName: '',
        aggregation: 'Suma',
        chartType: 'bar',
        textContent: '',
        boldText: false,
        markerScale: 1,
        imageUrl: '',
        imageDataUrl: '',
        imageFit: 'contain',
        imageHeightMm: 52
      },
      nestedRows: []
    });

    const createDefaultPdfRow = () => ({
      id: createPdfId('pdf-row'),
      title: 'Fila 1',
      heightAdjustMm: 0,
      columns: [createDefaultPdfColumn(12, 'indicator')]
    });

    const clonePdfColumn = (column) => {
      const base = column && typeof column === 'object' ? column : {};
      return {
        ...base,
        config: { ...(base.config || {}) },
        nestedRows: Array.isArray(base.nestedRows)
          ? base.nestedRows.map((row) => ({
            ...row,
            columns: Array.isArray(row.columns) ? row.columns.map((item) => clonePdfColumn(item)) : []
          }))
          : []
      };
    };

    const normalizePdfColumn = (column, index = 0, allowNestedRows = true) => {
      const widgetType = pdfWidgetTypes.some((item) => item.value === column?.widgetType) ? column.widgetType : 'indicator';
      const parsedWidth = parseInt(column?.width, 10);
      const width = Number.isFinite(parsedWidth) && parsedWidth >= 1 && parsedWidth <= 12 ? parsedWidth : 12;
      const sourceConfig = column?.config && typeof column.config === 'object' ? column.config : {};
      const fieldOptions = getIndicatorFields();
      const defaultFieldName = fieldOptions[0]?.name || '';
      const rawMarkerScale = Number(sourceConfig.markerScale);
      const markerScale = pdfMarkerScaleOptions.includes(rawMarkerScale) ? rawMarkerScale : 1;
      const imageHeightRaw = Number(sourceConfig.imageHeightMm);
      const imageHeightMm = Number.isFinite(imageHeightRaw) ? Math.max(10, Math.min(130, imageHeightRaw)) : 52;
      const imageFit = ['contain', 'cover', 'fill'].includes(String(sourceConfig.imageFit || '').trim())
        ? String(sourceConfig.imageFit).trim()
        : 'contain';
      const nestedRows = allowNestedRows && Array.isArray(column?.nestedRows)
        ? column.nestedRows.map((row, rowIndex) => normalizePdfRow(row, rowIndex, false))
        : [];
      const sanitizeNameList = (value, validOptions) => {
        const valid = new Set(validOptions);
        return Array.isArray(value) ? value.filter((item) => valid.has(item)) : [];
      };
      return {
        id: String(column?.id || createPdfId('pdf-col')),
        width,
        widgetType,
        widgetTitle: String(column?.widgetTitle || '').trim(),
        order: Number.isFinite(Number(column?.order)) ? Number(column.order) : index + 1,
        config: {
          fieldName: String(sourceConfig.fieldName || defaultFieldName || '').trim(),
          aggregation: ['Suma', 'Promedio', 'Conteo', 'Porcentaje'].includes(String(sourceConfig.aggregation || '').trim()) ? String(sourceConfig.aggregation).trim() : 'Suma',
          chartType: ['bar', 'doughnut'].includes(String(sourceConfig.chartType || '').trim()) ? String(sourceConfig.chartType).trim() : 'bar',
          textContent: String(sourceConfig.textContent || '').trim(),
          boldText: Boolean(sourceConfig.boldText),
          markerScale,
          imageUrl: String(sourceConfig.imageUrl || '').trim(),
          imageDataUrl: String(sourceConfig.imageDataUrl || '').trim(),
          imageFit,
          imageHeightMm,
          regiones: sanitizeNameList(sourceConfig.regiones, PDF_MAP_REGIONES),
          provincias: sanitizeNameList(sourceConfig.provincias, PDF_MAP_PROVINCIAS),
          municipios: sanitizeNameList(sourceConfig.municipios, PDF_MAP_MUNICIPIOS)
        },
        nestedRows
      };
    };

    const normalizePdfRow = (row, index = 0, allowNestedRows = true) => {
      const columns = Array.isArray(row?.columns) && row.columns.length ? row.columns.map((column, columnIndex) => normalizePdfColumn(column, columnIndex, allowNestedRows)) : [createDefaultPdfColumn(12, 'indicator')];
      const rawAdjust = Number(row?.heightAdjustMm);
      const heightAdjustMm = Number.isFinite(rawAdjust) ? Math.max(-40, Math.min(80, rawAdjust)) : 0;
      const hasExplicitTitle = row && typeof row === 'object' && Object.prototype.hasOwnProperty.call(row, 'title');
      const normalizedTitle = hasExplicitTitle
        ? String(row.title ?? '').trim()
        : `Fila ${index + 1}`;
      return {
        id: String(row?.id || createPdfId('pdf-row')),
        title: normalizedTitle,
        heightAdjustMm,
        columns
      };
    };

    const normalizePdfLayout = (layout) => {
      const rows = Array.isArray(layout?.rows) && layout.rows.length ? layout.rows.map((row, index) => normalizePdfRow(row, index)) : [createDefaultPdfRow()];
      return { rows };
    };

    const normalizePdfPageConfig = (config) => {
      const defaults = createDefaultPdfPageConfig();
      const source = config && typeof config === 'object' ? config : {};
      const orientation = ['portrait', 'landscape'].includes(String(source.orientation || '').trim()) ? String(source.orientation).trim() : defaults.orientation;
      const clampValue = (value, fallback, min, max) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return fallback;
        return Math.min(max, Math.max(min, numeric));
      };
      const headerSource = source.header && typeof source.header === 'object' ? source.header : {};
      const footerSource = source.footer && typeof source.footer === 'object' ? source.footer : {};
      return {
        orientation,
        header: {
          enabled: headerSource.enabled !== false,
          heightMm: clampValue(headerSource.heightMm, defaults.header.heightMm, 8, 70),
          title: String(headerSource.title || ''),
          subtitle: String(headerSource.subtitle || ''),
          leftLogo: String(headerSource.leftLogo || ''),
          rightLogo: String(headerSource.rightLogo || '')
        },
        footer: {
          enabled: footerSource.enabled !== false,
          heightMm: clampValue(footerSource.heightMm, defaults.footer.heightMm, 8, 70),
          text: String(footerSource.text || ''),
          leftLogo: String(footerSource.leftLogo || ''),
          rightLogo: String(footerSource.rightLogo || '')
        }
      };
    };

    const getPdfLayout = () => {
      if (!state.pdfLayout) {
        state.pdfLayout = createDefaultPdfLayout();
      }
      state.pdfLayout = normalizePdfLayout(state.pdfLayout);
      return state.pdfLayout;
    };

    const getPdfPageConfig = () => {
      if (!state.pdfPageConfig) {
        state.pdfPageConfig = createDefaultPdfPageConfig();
      }
      state.pdfPageConfig = normalizePdfPageConfig(state.pdfPageConfig);
      return state.pdfPageConfig;
    };

    const savePdfLayout = (layout) => {
      state.pdfLayout = normalizePdfLayout(layout);
      syncPdfDesignerContext();
      renderPdfDesignerLayout();
      persistCurrentUnitContext();
    };

    const savePdfPageConfig = (pageConfig) => {
      state.pdfPageConfig = normalizePdfPageConfig(pageConfig);
      renderPdfPageConfigControls();
      updatePdfPageEstimate();
      persistCurrentUnitContext();
    };

    const updatePdfLayoutRow = (rowId, updater) => {
      const layout = getPdfLayout();
      const rowIndex = layout.rows.findIndex((row) => row.id === rowId);
      if (rowIndex === -1) return;
      const nextRows = layout.rows.map((row) => ({
        ...row,
        columns: Array.isArray(row.columns) ? row.columns.map((column) => clonePdfColumn(column)) : []
      }));
      updater(nextRows[rowIndex]);
      savePdfLayout({ rows: nextRows });
    };

    const addPdfLayoutRow = () => {
      const layout = getPdfLayout();
      const nextRows = layout.rows.map((row) => ({ ...row, columns: row.columns.map((column) => ({ ...column })) }));
      nextRows.push({
        id: createPdfId('pdf-row'),
        title: `Fila ${nextRows.length + 1}`,
        columns: [createDefaultPdfColumn(12, 'indicator')]
      });
      savePdfLayout({ rows: nextRows });
    };

    const removePdfLayoutRow = (rowId) => {
      const layout = getPdfLayout();
      const nextRows = layout.rows.filter((row) => row.id !== rowId);
      savePdfLayout({ rows: nextRows.length ? nextRows : [createDefaultPdfRow()] });
    };

    const setPdfRowPreset = (rowId, widths) => {
      updatePdfLayoutRow(rowId, (row) => {
        const previousColumns = Array.isArray(row.columns) ? row.columns : [];
        row.columns = widths.map((width, index) => {
          const previous = previousColumns[index];
          return {
            id: previous?.id || createPdfId('pdf-col'),
            width,
            widgetType: previous?.widgetType || 'indicator',
            widgetTitle: previous?.widgetTitle || '',
            order: index + 1,
            config: { ...(previous?.config || createDefaultPdfColumn(width, 'indicator').config) },
            nestedRows: Array.isArray(previous?.nestedRows) ? previous.nestedRows.map((item, idx) => normalizePdfRow(item, idx, false)) : []
          };
        });
      });
    };

    const addPdfLayoutColumn = (rowId) => {
      updatePdfLayoutRow(rowId, (row) => {
        row.columns.push(createDefaultPdfColumn(12, 'indicator'));
      });
    };

    const removePdfLayoutColumn = (rowId, columnId) => {
      updatePdfLayoutRow(rowId, (row) => {
        row.columns = row.columns.filter((column) => column.id !== columnId);
        if (!row.columns.length) {
          row.columns = [createDefaultPdfColumn(12, 'indicator')];
        }
      });
    };

    const getPdfIndicatorFieldOptions = () => {
      const baseOptions = getIndicatorFields();
      const regularOptions = (baseOptions.length ? baseOptions : fieldDefinitions)
        .filter((field) => field.name && !['__rowId', '__sourceLabel', '__sourceSheet', '__sourceCategory', '__documentos'].includes(field.name))
        .filter((field) => normalizeFieldName(field.name) !== 'familias_beneficiadas');
      const hasFamiliesField = Boolean(getFamiliesBeneficiadasField()) || rows.some((row) => parseNumber(row[getFamiliesFieldName(row)]) !== null);
      if (!hasFamiliesField) {
        return regularOptions;
      }
      return [...pdfFamiliesIndicatorOptions, ...regularOptions];
    };

    const getPdfChartFieldOptions = () => {
      const listFields = getDynamicFilterFields().filter((field) => field.name && !isNumericField(field) && normalizeFieldName(field.name) !== 'familias_beneficiadas');
      const familiesField = getFamiliesBeneficiadasField();
      const chartOptions = [];
      if (familiesField) {
        chartOptions.push({ value: '__familias_beneficiadas__', label: `Familias beneficiadas por ${getGroupByFieldLabel()}` });
      }
      listFields.forEach((field) => {
        chartOptions.push({ value: field.name, label: getFieldLabel(field) });
      });
      return chartOptions;
    };

    const updatePdfLayoutColumn = (rowId, columnId, updater) => {
      updatePdfLayoutRow(rowId, (row) => {
        const column = row.columns.find((item) => item.id === columnId);
        if (column) {
          updater(column);
        }
      });
    };

    const createDefaultPdfNestedRow = (index = 0) => ({
      id: createPdfId('pdf-subrow'),
      title: `Subfila ${index + 1}`,
      heightAdjustMm: 0,
      columns: [createDefaultPdfColumn(12, 'indicator')]
    });

    const addPdfNestedRow = (rowId, parentColumnId) => {
      updatePdfLayoutColumn(rowId, parentColumnId, (column) => {
        if (!Array.isArray(column.nestedRows)) column.nestedRows = [];
        column.nestedRows.push(createDefaultPdfNestedRow(column.nestedRows.length));
      });
    };

    const removePdfNestedRow = (rowId, parentColumnId, nestedRowId) => {
      updatePdfLayoutColumn(rowId, parentColumnId, (column) => {
        const rowsList = Array.isArray(column.nestedRows) ? column.nestedRows : [];
        const next = rowsList.filter((item) => item.id !== nestedRowId);
        column.nestedRows = next.length ? next : [createDefaultPdfNestedRow(0)];
      });
    };

    const updatePdfNestedRow = (rowId, parentColumnId, nestedRowId, updater) => {
      updatePdfLayoutColumn(rowId, parentColumnId, (column) => {
        if (!Array.isArray(column.nestedRows)) column.nestedRows = [createDefaultPdfNestedRow(0)];
        const nestedRow = column.nestedRows.find((item) => item.id === nestedRowId);
        if (!nestedRow) return;
        updater(nestedRow);
      });
    };

    const addPdfNestedColumn = (rowId, parentColumnId, nestedRowId) => {
      updatePdfNestedRow(rowId, parentColumnId, nestedRowId, (nestedRow) => {
        if (!Array.isArray(nestedRow.columns)) nestedRow.columns = [createDefaultPdfColumn(12, 'indicator')];
        nestedRow.columns.push(createDefaultPdfColumn(12, 'indicator'));
      });
    };

    const removePdfNestedColumn = (rowId, parentColumnId, nestedRowId, columnId) => {
      updatePdfNestedRow(rowId, parentColumnId, nestedRowId, (nestedRow) => {
        nestedRow.columns = (Array.isArray(nestedRow.columns) ? nestedRow.columns : []).filter((item) => item.id !== columnId);
        if (!nestedRow.columns.length) nestedRow.columns = [createDefaultPdfColumn(12, 'indicator')];
      });
    };

    const updatePdfNestedColumn = (rowId, parentColumnId, nestedRowId, columnId, updater) => {
      updatePdfNestedRow(rowId, parentColumnId, nestedRowId, (nestedRow) => {
        const column = (Array.isArray(nestedRow.columns) ? nestedRow.columns : []).find((item) => item.id === columnId);
        if (!column) return;
        updater(column);
      });
    };

    const setPdfNestedRowPreset = (rowId, parentColumnId, nestedRowId, widths) => {
      updatePdfNestedRow(rowId, parentColumnId, nestedRowId, (nestedRow) => {
        const previousColumns = Array.isArray(nestedRow.columns) ? nestedRow.columns : [];
        nestedRow.columns = widths.map((width, index) => {
          const previous = previousColumns[index];
          return {
            id: previous?.id || createPdfId('pdf-col'),
            width,
            widgetType: previous?.widgetType || 'indicator',
            widgetTitle: previous?.widgetTitle || '',
            order: index + 1,
            config: { ...(previous?.config || createDefaultPdfColumn(width, 'indicator').config) },
            nestedRows: []
          };
        });
      });
    };

    const renderLogoPreview = (previewId, src) => {
      const container = document.getElementById(previewId);
      if (!container) return;
      const value = String(src || '').trim();
      if (!value) {
        container.textContent = '-';
        return;
      }
      container.innerHTML = `<img src="${escapeHtml(value)}" alt="Logo">`;
    };

    const renderPdfPageConfigControls = () => {
      const config = getPdfPageConfig();
      const setValue = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.value = value;
      };
      setValue('pdfPageOrientation', config.orientation);
      setValue('pdfHeaderHeightMm', String(config.header.heightMm));
      setValue('pdfFooterHeightMm', String(config.footer.heightMm));
      setValue('pdfHeaderTitle', config.header.title);
      setValue('pdfHeaderSubtitle', config.header.subtitle);
      setValue('pdfFooterText', config.footer.text);
      renderLogoPreview('pdfHeaderLeftLogoPreview', config.header.leftLogo);
      renderLogoPreview('pdfHeaderRightLogoPreview', config.header.rightLogo);
      renderLogoPreview('pdfFooterLeftLogoPreview', config.footer.leftLogo);
      renderLogoPreview('pdfFooterRightLogoPreview', config.footer.rightLogo);
    };

    const estimatePdfWidgetHeightMm = (column) => {
      const nestedRows = Array.isArray(column?.nestedRows) ? column.nestedRows : [];
      if (nestedRows.length) {
        const nestedHeight = estimatePdfLayoutHeightMm({ rows: nestedRows });
        return Math.max(24, 10 + nestedHeight);
      }
      const type = String(column?.widgetType || 'indicator');
      const titleHeight = String(column?.widgetTitle || '').trim() ? 8 : 0;
      if (type === 'indicator') return 24 + titleHeight;
      if (type === 'chart') return 76 + titleHeight;
      if (type === 'map' || type === 'map_bolivia') return 76 + titleHeight;
      if (type === 'table') return 56 + titleHeight;
      if (type === 'image') {
        const imageHeight = Number(column?.config?.imageHeightMm);
        return Math.max(24, Math.min(140, Number.isFinite(imageHeight) ? imageHeight : 52)) + titleHeight;
      }
      if (type === 'text') {
        const text = String(column?.config?.textContent || '').trim();
        const lines = Math.max(1, Math.ceil(text.length / 60));
        return Math.min(60, 16 + lines * 6 + titleHeight);
      }
      return 24 + titleHeight;
    };

    const estimatePdfLayoutHeightMm = (layout) => {
      const rowsInLayout = Array.isArray(layout?.rows) ? layout.rows : [];
      if (!rowsInLayout.length) return 0;
      return rowsInLayout.reduce((total, row, index) => {
        const columns = Array.isArray(row.columns) ? row.columns : [];
        const rowBase = 12;
        const rowHeader = String(row.title || '').trim() ? 10 : 0;
        const maxColumnHeight = columns.length ? Math.max(...columns.map(estimatePdfWidgetHeightMm)) : 20;
        const rowAdjust = Number.isFinite(Number(row?.heightAdjustMm)) ? Number(row.heightAdjustMm) : 0;
        const gapAfter = index === rowsInLayout.length - 1 ? 0 : 6;
        return total + rowBase + rowHeader + maxColumnHeight + rowAdjust + gapAfter;
      }, 0);
    };

    const getLetterPageHeightMm = (orientation) => {
      if (orientation === 'landscape') return PDF_LETTER_SIZE_MM.width;
      return PDF_LETTER_SIZE_MM.height;
    };

    const getLetterPageWidthMm = (orientation) => {
      if (orientation === 'landscape') return PDF_LETTER_SIZE_MM.height;
      return PDF_LETTER_SIZE_MM.width;
    };

    const updatePdfPageEstimate = () => {
      const layout = getPdfLayout();
      const config = getPdfPageConfig();
      const pageHeight = getLetterPageHeightMm(config.orientation);
      const headerHeight = config.header.enabled ? config.header.heightMm : 0;
      const footerHeight = config.footer.enabled ? config.footer.heightMm : 0;
      const available = pageHeight
        - PDF_FIXED_MARGINS_MM.top
        - PDF_FIXED_MARGINS_MM.bottom
        - headerHeight
        - footerHeight
        - PDF_MAIN_PADDING_MM.top
        - PDF_MAIN_PADDING_MM.bottom;
      const contentHeight = estimatePdfLayoutHeightMm(layout);
      const safeAvailable = Math.max(1, available);
      const pages = Math.max(1, Math.ceil(contentHeight / safeAvailable));

      const setText = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.textContent = String(value);
      };
      setText('pdfLetterAvailableMm', `${available.toFixed(1)} mm`);
      setText('pdfLayoutEstimatedMm', `${contentHeight.toFixed(1)} mm`);
      setText('pdfEstimatedPages', pages);

      const alert = document.getElementById('pdfPageEstimateAlert');
      if (!alert) return;
      if (available <= 0) {
        alert.className = 'alert alert-danger mb-0 mt-3';
        alert.textContent = 'No hay espacio útil: reduce el alto del encabezado o pie para poder renderizar contenido.';
        return;
      }
      if (pages === 1) {
        alert.className = 'alert alert-success mb-0 mt-3';
        alert.textContent = 'El layout estimado entra en una hoja carta.';
        return;
      }
      alert.className = 'alert alert-warning mb-0 mt-3';
      alert.textContent = `El contenido estimado ocupará ${pages} páginas carta. Debes repetir encabezado y pie en cada página.`;
    };

    const updatePdfPageConfigFromControls = () => {
      const config = getPdfPageConfig();
      const orientation = document.getElementById('pdfPageOrientation')?.value || config.orientation;
      const headerHeightMm = Number(document.getElementById('pdfHeaderHeightMm')?.value);
      const footerHeightMm = Number(document.getElementById('pdfFooterHeightMm')?.value);
      const headerTitle = document.getElementById('pdfHeaderTitle')?.value || '';
      const headerSubtitle = document.getElementById('pdfHeaderSubtitle')?.value || '';
      const footerText = document.getElementById('pdfFooterText')?.value || '';
      savePdfPageConfig({
        ...config,
        orientation,
        header: {
          ...config.header,
          heightMm: headerHeightMm,
          title: headerTitle,
          subtitle: headerSubtitle
        },
        footer: {
          ...config.footer,
          heightMm: footerHeightMm,
          text: footerText
        }
      });
    };

    const readImageAsDataUrl = (file) => {
      return new Promise((resolve, reject) => {
        if (!file) {
          reject(new Error('No se seleccionó imagen.'));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
        reader.readAsDataURL(file);
      });
    };

    const assignPdfLogo = async (slot, file) => {
      try {
        const dataUrl = await readImageAsDataUrl(file);
        const config = getPdfPageConfig();
        if (slot === 'header-left') {
          savePdfPageConfig({ ...config, header: { ...config.header, leftLogo: dataUrl } });
        }
        if (slot === 'header-right') {
          savePdfPageConfig({ ...config, header: { ...config.header, rightLogo: dataUrl } });
        }
        if (slot === 'footer-left') {
          savePdfPageConfig({ ...config, footer: { ...config.footer, leftLogo: dataUrl } });
        }
        if (slot === 'footer-right') {
          savePdfPageConfig({ ...config, footer: { ...config.footer, rightLogo: dataUrl } });
        }
      } catch (error) {
        Swal.fire({ icon: 'error', title: 'No se pudo cargar el logo', text: error.message });
      }
    };

    const getPdfIndicatorSummary = (column, sourceRows) => {
      const config = column?.config || {};
      const fieldName = String(config.fieldName || '').trim();
      const aggregation = String(config.aggregation || 'Suma').trim();
      if (!fieldName) {
        return { title: 'Indicador sin configurar', value: '-', detail: '' };
      }
      if (fieldName === '__familias_total__') {
        const total = sourceRows.reduce((sum, row) => {
          const value = parseNumber(row[getFamiliesFieldName(row)]);
          return sum + (value || 0);
        }, 0);
        return { title: 'Familias beneficiadas', value: formatDecimal(total), detail: 'Total global' };
      }
      if (fieldName === '__familias_region__' || fieldName === '__familias_provincia__' || fieldName === '__familias_municipio__') {
        const groupFieldNameMap = {
          __familias_region__: 'REGIONES',
          __familias_provincia__: 'PROVINCIA',
          __familias_municipio__: 'MUNICIPIO'
        };
        const labelMap = {
          __familias_region__: 'Región',
          __familias_provincia__: 'Provincia',
          __familias_municipio__: 'Municipio'
        };
        const grouped = new Map();
        const groupFieldName = groupFieldNameMap[fieldName];
        sourceRows.forEach((row) => {
          const groupLabel = getCellText(row, groupFieldName) || 'Sin dato';
          const value = parseNumber(row[getFamiliesFieldName(row)]);
          if (value === null) return;
          grouped.set(groupLabel, (grouped.get(groupLabel) || 0) + value);
        });
        const sorted = Array.from(grouped.entries()).sort((a, b) => b[1] - a[1]);
        const total = sorted.reduce((sum, item) => sum + item[1], 0);
        const preview = sorted.slice(0, 3).map(([name, value]) => `${name}: ${formatDecimal(value)}`).join(' | ');
        return {
          title: `Familias beneficiadas por ${labelMap[fieldName]}`,
          value: formatDecimal(total),
          detail: preview || 'Sin datos'
        };
      }
      const field = fieldDefinitions.find((item) => item.name === fieldName);
      if (!field) {
        return { title: 'Indicador', value: '-', detail: 'Campo no disponible' };
      }
      const tempField = { ...field, agregacion: aggregation };
      const value = aggregateFieldValues(tempField, sourceRows, rows);
      return {
        title: getFieldLabel(field),
        value: formatValueByField(field, value),
        detail: `${aggregation} sobre datos filtrados`
      };
    };

    const getPdfChartSummary = (column, sourceRows) => {
      const fieldName = String(column?.config?.fieldName || '').trim();
      if (!fieldName) {
        return { title: 'Gráfico sin campo', items: [] };
      }
      if (fieldName === '__familias_beneficiadas__') {
        const grouped = getChartDataForFamiliesByGroup(sourceRows);
        const items = grouped.labels.slice(0, 6).map((label, index) => ({ label, value: grouped.data[index] }));
        return { title: `Familias por ${getGroupByFieldLabel()}`, items };
      }
      const counts = {};
      sourceRows.forEach((row) => {
        const key = getCellText(row, fieldName) || 'Sin dato';
        counts[key] = (counts[key] || 0) + 1;
      });
      const items = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([label, value]) => ({ label, value }));
      const field = fieldDefinitions.find((item) => item.name === fieldName);
      return { title: field ? getFieldLabel(field) : fieldName, items };
    };

    const getPdfChartSeries = (column, sourceRows) => {
      const fieldName = String(column?.config?.fieldName || '').trim();
      if (!fieldName) {
        return { labels: [], values: [], title: 'Gráfico sin campo' };
      }
      if (fieldName === '__familias_beneficiadas__') {
        const grouped = getChartDataForFamiliesByGroup(sourceRows);
        return {
          labels: grouped.labels.slice(0, 12),
          values: grouped.data.slice(0, 12),
          title: `Familias por ${getGroupByFieldLabel()}`
        };
      }
      const counts = {};
      sourceRows.forEach((row) => {
        const key = getCellText(row, fieldName) || 'Sin dato';
        counts[key] = (counts[key] || 0) + 1;
      });
      const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12);
      const field = fieldDefinitions.find((item) => item.name === fieldName);
      return {
        labels: sorted.map((item) => item[0]),
        values: sorted.map((item) => item[1]),
        title: field ? getFieldLabel(field) : fieldName
      };
    };

    const generateChartImageDataUrl = async (column, sourceRows) => {
      const series = getPdfChartSeries(column, sourceRows);
      if (!series.labels.length) return '';
      const canvas = document.createElement('canvas');
      canvas.width = 980;
      canvas.height = 460;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';
      const chartType = String(column?.config?.chartType || 'bar');
      const chart = new Chart(ctx, {
        type: chartType === 'doughnut' ? 'doughnut' : 'bar',
        data: {
          labels: series.labels,
          datasets: [{
            label: series.title,
            data: series.values,
            backgroundColor: series.labels.map((_, idx) => getGoogleChartColor(idx)),
            borderColor: series.labels.map((_, idx) => getGoogleChartColor(idx)),
            borderWidth: 1,
            borderRadius: chartType === 'bar' ? 6 : 0,
            maxBarThickness: 34
          }]
        },
        options: {
          ...getGoogleChartBaseOptions({ isDoughnut: chartType === 'doughnut', showLegend: chartType === 'doughnut' }),
          responsive: false,
          animation: false
        }
      });

      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
      const dataUrl = chart.toBase64Image('image/png', 1);
      chart.destroy();
      return dataUrl;
    };

    const waitForImagesInElement = async (element) => {
      if (!element) return;
      const images = Array.from(element.querySelectorAll('img'));
      if (!images.length) return;
      await Promise.all(images.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise((resolve) => {
          const done = () => {
            img.removeEventListener('load', done);
            img.removeEventListener('error', done);
            resolve();
          };
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        });
      }));
    };

    const generateMapCanvasDataUrl = async (column, sourceRows) => {
      if (!DEPARTAMENTO_GEOJSON || !BOLIVIA_GEOJSON) return '';
      const scope = getMapScope(column);
      const selectedBoundaries = await loadSelectedBoundaries(column);
      const allBoundaries = [...scope.boundaries, ...selectedBoundaries];
      const { latField, lngField } = detectCoordinateFields();
      const points = sourceRows
        .map((row) => {
          const lat = parseNumber(row[latField]);
          const lng = parseNumber(row[lngField]);
          if (!isValidCoordinatePair(lat, lng)) return null;
          return { lat, lng };
        })
        .filter(Boolean);
      const primaryBoundary = scope.boundaries[0];

      const canvas = document.createElement('canvas');
      canvas.width = 980;
      canvas.height = 460;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';

      ctx.fillStyle = '#eef6ff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#d4e4fb';
      ctx.lineWidth = 1;
      for (let x = 40; x < canvas.width; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x, 20);
        ctx.lineTo(x, canvas.height - 20);
        ctx.stroke();
      }
      for (let y = 20; y < canvas.height; y += 60) {
        ctx.beginPath();
        ctx.moveTo(20, y);
        ctx.lineTo(canvas.width - 20, y);
        ctx.stroke();
      }

      const [scopeMinLng, scopeMinLat, scopeMaxLng, scopeMaxLat] = primaryBoundary.geojson.bbox || [-67.01, -18.69, -64.18, -15.7];
      const minLat = Math.min(scopeMinLat, ...points.map((p) => p.lat));
      const maxLat = Math.max(scopeMaxLat, ...points.map((p) => p.lat));
      const minLng = Math.min(scopeMinLng, ...points.map((p) => p.lng));
      const maxLng = Math.max(scopeMaxLng, ...points.map((p) => p.lng));
      const pad = 10;
      const latRange = Math.max(0.0001, maxLat - minLat);
      const lngRange = Math.max(0.0001, maxLng - minLng);
      const project = (lat, lng) => ({
        x: pad + ((lng - minLng) / lngRange) * (canvas.width - 2 * pad),
        y: pad + (1 - (lat - minLat) / latRange) * (canvas.height - 2 * pad)
      });

      allBoundaries.forEach((boundary) => {
        ctx.setLineDash(boundary.canvasDash || []);
        ctx.strokeStyle = boundary.canvasStroke;
        ctx.lineWidth = boundary.style?.weight || 1.5;
        getPolygonRings(boundary.geojson).forEach((ring) => {
          ctx.beginPath();
          ring.forEach(([lng, lat], index) => {
            const { x, y } = project(lat, lng);
            if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          });
          ctx.closePath();
          ctx.stroke();
        });
      });
      ctx.setLineDash([]);

      const markerScale = Number(column?.config?.markerScale || 1);
      const radius = Math.max(2, 4 * markerScale);

      points.forEach((point) => {
        const { x, y } = project(point.lat, point.lng);
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(13, 110, 253, 0.65)';
        ctx.fill();
        ctx.strokeStyle = '#0b57d0';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      ctx.fillStyle = '#111827';
      ctx.font = 'bold 16px Segoe UI';
      ctx.fillText('Mapa de puntos georreferenciados', 24, 26);
      ctx.font = '12px Segoe UI';
      ctx.fillStyle = '#4b5563';
      ctx.fillText(`Puntos: ${points.length} | Escala marker: ${markerScale}x | Límite: ${scope.label}`, 24, 44);
      return canvas.toDataURL('image/png');
    };

    const generateLeafletMapImageDataUrl = async (column, sourceRows) => {
      if (typeof leafletImage !== 'function') return '';
      await loadMapGeoData();
      if (!DEPARTAMENTO_GEOJSON || !BOLIVIA_GEOJSON) return '';
      const scope = getMapScope(column);
      const selectedBoundaries = await loadSelectedBoundaries(column);
      const allBoundaries = [...scope.boundaries, ...selectedBoundaries];
      const { latField, lngField } = detectCoordinateFields();
      const points = sourceRows
        .map((row) => {
          const lat = parseNumber(row[latField]);
          const lng = parseNumber(row[lngField]);
          if (!isValidCoordinatePair(lat, lng)) return null;
          return { lat, lng };
        })
        .filter(Boolean);

      const host = document.createElement('div');
      host.style.position = 'fixed';
      host.style.left = '-10000px';
      host.style.top = '0';
      host.style.width = '980px';
      host.style.height = '700px';
      host.style.zIndex = '-1';
      document.body.appendChild(host);

      let exportMap;
      try {
        exportMap = L.map(host, { zoomControl: false, attributionControl: false, preferCanvas: true });
        exportMap.invalidateSize();
        let hasTileError = false;
        const tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          crossOrigin: true,
          maxZoom: 19,
          subdomains: 'abcd'
        });
        tileLayer.on('tileerror', () => {
          hasTileError = true;
        });
        tileLayer.addTo(exportMap);

        const boundaryLayers = allBoundaries.map((boundary) => L.geoJSON(boundary.geojson, {
          style: boundary.style,
          interactive: false
        }).addTo(exportMap));

        const markerScale = Number(column?.config?.markerScale || 1);
        const radius = Math.max(2, 4 * markerScale);
        const markerLayer = L.featureGroup();
        points.forEach((point) => {
          L.circleMarker([point.lat, point.lng], {
            radius,
            color: '#0b57d0',
            weight: 1,
            fillColor: '#0d6efd',
            fillOpacity: 0.65
          }).addTo(markerLayer);
        });
        markerLayer.addTo(exportMap);
        const bounds = markerLayer.getBounds();
        const primaryBounds = boundaryLayers[0].getBounds();

        if (bounds.isValid()) {
          bounds.extend(primaryBounds);
          exportMap.fitBounds(bounds, { padding: [10, 10] });
        } else if (primaryBounds.isValid()) {
          exportMap.fitBounds(primaryBounds, { padding: [10, 10] });
        } else {
          exportMap.setView(scope.fallbackView.center, scope.fallbackView.zoom);
        }

        await new Promise((resolve) => setTimeout(resolve, 1100));
        if (hasTileError) {
          return '';
        }
        const dataUrl = await new Promise((resolve) => {
          leafletImage(exportMap, (err, canvas) => {
            if (err || !canvas) {
              resolve('');
              return;
            }
            try {
              resolve(canvas.toDataURL('image/png'));
            } catch (e) {
              resolve('');
            }
          });
        });
        return dataUrl;
      } catch (error) {
        return '';
      } finally {
        if (exportMap) {
          exportMap.remove();
        }
        host.remove();
      }
    };

    const collectPdfColumnsFromRows = (rowsList = [], parentWidthFraction = 1) => {
      const items = [];
      (Array.isArray(rowsList) ? rowsList : []).forEach((row) => {
        const columns = Array.isArray(row?.columns) ? row.columns : [];
        columns.forEach((column) => {
          const ownFraction = Math.max(1, Math.min(12, Number(column?.width) || 12)) / 12;
          const widthFraction = parentWidthFraction * ownFraction;
          items.push({ column, widthFraction });
          const nestedRows = Array.isArray(column?.nestedRows) ? column.nestedRows : [];
          if (nestedRows.length) {
            items.push(...collectPdfColumnsFromRows(nestedRows, widthFraction));
          }
        });
      });
      return items;
    };

    const MM_TO_PX = 3.7795;

    const generateFittedImageDataUrl = (sourceDataUrl, targetWidthPx, targetHeightPx, fitMode) => {
      return new Promise((resolve) => {
        if (!sourceDataUrl) { resolve(''); return; }
        const width = Math.max(1, Math.round(targetWidthPx) || 1);
        const height = Math.max(1, Math.round(targetHeightPx) || 1);
        const img = new Image();
        img.onload = () => {
          const srcW = img.naturalWidth || img.width;
          const srcH = img.naturalHeight || img.height;
          if (!srcW || !srcH) { resolve(''); return; }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(''); return; }
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          if (fitMode === 'fill') {
            ctx.drawImage(img, 0, 0, width, height);
          } else {
            const scale = fitMode === 'cover'
              ? Math.max(width / srcW, height / srcH)
              : Math.min(width / srcW, height / srcH);
            const drawW = srcW * scale;
            const drawH = srcH * scale;
            ctx.drawImage(img, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
          }
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve('');
        img.src = sourceDataUrl;
      });
    };

    const buildPdfAssetCache = async (layoutRows, sourceRows, pageContentWidthMm = 180) => {
      const cache = {};
      const allColumns = collectPdfColumnsFromRows(layoutRows || []);
      for (const { column, widthFraction } of allColumns) {
        if (!column || !column.id) continue;
        if (column.widgetType === 'chart') {
          cache[column.id] = await generateChartImageDataUrl(column, sourceRows);
        }
        if (column.widgetType === 'map' || column.widgetType === 'map_bolivia') {
          const leafletMapImage = await generateLeafletMapImageDataUrl(column, sourceRows);
          cache[column.id] = leafletMapImage || await generateMapCanvasDataUrl(column, sourceRows);
        }
        if (column.widgetType === 'image') {
          const rawSrc = String(column?.config?.imageDataUrl || column?.config?.imageUrl || '').trim();
          if (rawSrc) {
            const fit = ['contain', 'cover', 'fill'].includes(String(column?.config?.imageFit || '').trim())
              ? String(column.config.imageFit).trim()
              : 'contain';
            const heightMmRaw = Number(column?.config?.imageHeightMm);
            const heightMm = Number.isFinite(heightMmRaw) ? Math.max(10, Math.min(130, heightMmRaw)) : 52;
            const widthMm = Math.max(20, pageContentWidthMm * widthFraction);
            const fitted = await generateFittedImageDataUrl(rawSrc, widthMm * MM_TO_PX, heightMm * MM_TO_PX, fit);
            cache[column.id] = fitted || rawSrc;
          }
        }
      }
      return cache;
    };

    const renderPdfRowsPreview = (rowsList, sourceRows, assetCache = {}, isNested = false) => {
      const safeRows = Array.isArray(rowsList) ? rowsList : [];
      if (!safeRows.length) return '';
      return safeRows.map((row) => {
        const columns = Array.isArray(row.columns) ? row.columns : [];
        const columnsHtml = columns.map((column) => {
          const width = Math.max(1, Math.min(12, Number(column.width) || 12));
          const basis = `${(width / 12) * 100}%`;
          return `<div class="pdf-layout-render-col" style="flex: 0 0 ${basis}; max-width: ${basis};">${renderPdfWidgetPreview(column, sourceRows, assetCache)}</div>`;
        }).join('');
        const title = String(row.title || '').trim();
        return `<div class="pdf-layout-render-row ${isNested ? 'mt-2' : ''}">${title ? `<div class="fw-semibold mb-2">${escapeHtml(title)}</div>` : ''}<div class="pdf-layout-render-columns">${columnsHtml}</div></div>`;
      }).join('');
    };

    const renderPdfWidgetPreview = (column, sourceRows, assetCache = {}) => {
      const widgetType = String(column?.widgetType || 'indicator');
      const customTitle = String(column?.widgetTitle || '').trim();
      const titleHtml = customTitle ? `<div class="pdf-widget-title">${escapeHtml(customTitle)}</div>` : '';
      const nestedRows = Array.isArray(column?.nestedRows) ? column.nestedRows : [];
      if (nestedRows.length) {
        const nestedHtml = renderPdfRowsPreview(nestedRows, sourceRows, assetCache, true);
        return `${titleHtml}<span class="pdf-chip">Subfilas</span>${nestedHtml || '<div class="text-muted">Sin subfilas configuradas.</div>'}`;
      }
      if (widgetType === 'indicator') {
        const summary = getPdfIndicatorSummary(column, sourceRows);
        return `${titleHtml}<span class="pdf-chip">Indicador</span><div class="fw-bold fs-6">${escapeHtml(summary.value)}</div><div class="pdf-indicator-title">${escapeHtml(summary.title)}</div><div class="text-muted pdf-indicator-detail">${escapeHtml(summary.detail)}</div>`;
      }
      if (widgetType === 'chart') {
        const chart = getPdfChartSummary(column, sourceRows);
        const imageSrc = assetCache[column.id] || '';
        if (imageSrc) {
          return `${titleHtml}<span class="pdf-chip">Gráfico (${escapeHtml(column?.config?.chartType || 'bar')})</span><div class="fw-semibold mb-1">${escapeHtml(chart.title)}</div><img src="${escapeHtml(imageSrc)}" alt="Gráfico" class="pdf-media-image pdf-media-image-chart">`;
        }
        const rowsHtml = chart.items.map((item) => `<div>${escapeHtml(item.label)}: <strong>${escapeHtml(formatChartNumericValue(item.value))}</strong></div>`).join('');
        return `${titleHtml}<span class="pdf-chip">Gráfico (${escapeHtml(column?.config?.chartType || 'bar')})</span><div class="fw-semibold mb-1">${escapeHtml(chart.title)}</div>${rowsHtml || '<div class="text-muted">Sin datos para graficar.</div>'}`;
      }
      if (widgetType === 'map' || widgetType === 'map_bolivia') {
        const chipLabel = widgetType === 'map_bolivia' ? 'Bolivia' : 'Mapa';
        const points = getMapPointCount(sourceRows);
        const markerScale = Number(column?.config?.markerScale || 1);
        const imageSrc = assetCache[column.id] || '';
        if (imageSrc) {
          return `${titleHtml}<span class="pdf-chip">${chipLabel}</span><div class="pdf-map-fill"><img src="${escapeHtml(imageSrc)}" alt="${chipLabel}" class="pdf-media-image pdf-media-image-map"></div>`;
        }
        return `${titleHtml}<span class="pdf-chip">${chipLabel}</span><div>Puntos válidos: <strong>${escapeHtml(formatInteger(points))}</strong></div><div class="text-muted">Escala de marker: ${escapeHtml(String(markerScale))}x</div>`;
      }
      if (widgetType === 'image') {
        const rawSrc = String(column?.config?.imageDataUrl || column?.config?.imageUrl || '').trim();
        if (!rawSrc) {
          return `${titleHtml}<span class="pdf-chip">Imagen</span><div class="text-muted">Sin imagen configurada.</div>`;
        }
        const imageSrc = assetCache[column.id] || rawSrc;
        return `${titleHtml}<span class="pdf-chip">Imagen</span><img src="${escapeHtml(imageSrc)}" alt="Imagen" class="pdf-media-image pdf-media-image-fitted">`;
      }
      if (widgetType === 'table') {
        return `${titleHtml}<span class="pdf-chip">Tabla</span><div>Registros filtrados: <strong>${escapeHtml(formatInteger(sourceRows.length))}</strong></div><div class="text-muted">La tabla completa se incluye en la próxima iteración.</div>`;
      }
      if (widgetType === 'text') {
        const text = String(column?.config?.textContent || '').trim() || 'Sin texto';
        const tag = column?.config?.boldText ? 'strong' : 'span';
        return `${titleHtml}<span class="pdf-chip">Texto</span><${tag}>${escapeHtml(text)}</${tag}>`;
      }
      return `${titleHtml}<div class="text-muted">Widget no reconocido.</div>`;
    };

    const getPdfPageChunks = (layoutRows, availableMm) => {
      const safeAvailable = Math.max(1, availableMm);
      const chunks = [];
      let currentChunk = [];
      let currentHeight = 0;
      layoutRows.forEach((row) => {
        const rowHeight = estimatePdfLayoutHeightMm({ rows: [row] });
        if (currentChunk.length && currentHeight + rowHeight > safeAvailable) {
          chunks.push(currentChunk);
          currentChunk = [row];
          currentHeight = rowHeight;
          return;
        }
        currentChunk.push(row);
        currentHeight += rowHeight;
      });
      if (currentChunk.length) chunks.push(currentChunk);
      return chunks.length ? chunks : [[]];
    };

    const buildPdfPrintDocument = async (sourceRowsOverride = null) => {
      const container = document.getElementById('pdfPrintRoot');
      if (!container) return null;
      const layout = getPdfLayout();
      const config = getPdfPageConfig();
      const sourceRows = Array.isArray(sourceRowsOverride)
        ? sourceRowsOverride
        : (Array.isArray(currentFilteredRows) ? currentFilteredRows : []);
      const pageHeight = getLetterPageHeightMm(config.orientation);
      const pageWidth = getLetterPageWidthMm(config.orientation);
      const headerHeight = config.header.enabled ? config.header.heightMm : 0;
      const footerHeight = config.footer.enabled ? config.footer.heightMm : 0;
      const availableMm = pageHeight
        - PDF_FIXED_MARGINS_MM.top
        - PDF_FIXED_MARGINS_MM.bottom
        - headerHeight
        - footerHeight
        - PDF_MAIN_PADDING_MM.top
        - PDF_MAIN_PADDING_MM.bottom;
      const pageChunks = getPdfPageChunks(layout.rows, availableMm);
      const pageContentWidthMm = pageWidth
        - PDF_FIXED_MARGINS_MM.left
        - PDF_FIXED_MARGINS_MM.right
        - PDF_MAIN_PADDING_MM.left
        - PDF_MAIN_PADDING_MM.right;
      const assetCache = await buildPdfAssetCache(layout.rows, sourceRows, pageContentWidthMm);

      container.classList.toggle('pdf-landscape', config.orientation === 'landscape');
      container.style.width = `${pageWidth}mm`;

      const pagesHtml = pageChunks.map((rowsChunk, pageIndex) => {
        const bodyMinHeight = Math.max(20, availableMm);
        const rowsHtml = renderPdfRowsPreview(rowsChunk, sourceRows, assetCache, false);
        return `
          <section class="pdf-page ${config.orientation === 'landscape' ? 'landscape' : ''}" style="height:${pageHeight}mm; min-height:${pageHeight}mm; padding:${PDF_FIXED_MARGINS_MM.top}mm ${PDF_FIXED_MARGINS_MM.right}mm ${PDF_FIXED_MARGINS_MM.bottom}mm ${PDF_FIXED_MARGINS_MM.left}mm;">
            ${config.header.enabled ? `<header class="pdf-page-header" style="height: ${headerHeight}mm; padding: 0 6px;"><div style="width: 20%; height: 100%;">${config.header.leftLogo ? `<img src="${escapeHtml(config.header.leftLogo)}" alt="Logo izquierdo">` : ''}</div><div style="width: 60%; text-align: center; line-height: 1.2;"><div style="font-weight: 700; font-size: 15px;">${escapeHtml(config.header.title || '')}</div><div style="font-size: 12px; color: #6b7280;">${escapeHtml(config.header.subtitle || '')}</div></div><div style="width: 20%; height: 100%; text-align: right;">${config.header.rightLogo ? `<img src="${escapeHtml(config.header.rightLogo)}" alt="Logo derecho">` : ''}</div></header>` : ''}
            <main style="min-height: ${bodyMinHeight}mm; padding: ${PDF_MAIN_PADDING_MM.top}mm ${PDF_MAIN_PADDING_MM.right}mm ${PDF_MAIN_PADDING_MM.bottom}mm ${PDF_MAIN_PADDING_MM.left}mm; overflow: hidden;">${rowsHtml || '<div class="text-muted">No hay filas en el layout.</div>'}</main>
            ${config.footer.enabled ? `<footer class="pdf-page-footer" style="height: ${footerHeight}mm; padding: 0 6px;"><div style="width: 20%; height: 100%;">${config.footer.leftLogo ? `<img src="${escapeHtml(config.footer.leftLogo)}" alt="Logo pie izquierdo">` : ''}</div><div style="width: 60%; text-align: center;">${escapeHtml((config.footer.text || '').replace('{n}', String(pageIndex + 1)))}</div><div style="width: 20%; height: 100%; text-align: right;">${config.footer.rightLogo ? `<img src="${escapeHtml(config.footer.rightLogo)}" alt="Logo pie derecho">` : ''}</div></footer>` : ''}
          </section>`;
      }).join('');

      container.innerHTML = pagesHtml;
      return { container, config, pageCount: pageChunks.length };
    };

    const previewPdfPrintableView = async () => {
      const built = await buildPdfPrintDocument();
      if (!built) return;
      const cleanup = () => {
        document.body.classList.remove('pdf-printing');
        window.removeEventListener('afterprint', cleanup);
      };
      document.body.classList.add('pdf-printing');
      window.addEventListener('afterprint', cleanup);
      window.print();
    };

    const exportPdfFile = async (sourceRowsOverride = null, fileSuffix = '') => {
      if (typeof html2pdf === 'undefined') {
        Swal.fire({ icon: 'error', title: 'Librería de PDF no disponible', text: 'No se pudo cargar html2pdf para exportar.' });
        return;
      }
      document.body.classList.add('pdf-exporting');
      const built = await buildPdfPrintDocument(sourceRowsOverride);
      if (!built) {
        document.body.classList.remove('pdf-exporting');
        return;
      }
      await waitForImagesInElement(built.container);
      const unit = currentUnitId ? getUnitById(currentUnitId) : null;
      const safeName = slugify(unit?.label || 'reporte-pdf');
      const suffix = String(fileSuffix || '').trim();
      const baseFilename = `${safeName}-${new Date().toISOString().slice(0, 10)}`;
      const options = {
        margin: [0, 0, 0, 0],
        filename: `${baseFilename}${suffix ? `-${slugify(suffix)}` : ''}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: {
          unit: 'mm',
          format: 'letter',
          orientation: built.config.orientation === 'landscape' ? 'landscape' : 'portrait'
        },
        pagebreak: { mode: [] }
      };
      try {
        await html2pdf().set(options).from(built.container).save();
      } finally {
        document.body.classList.remove('pdf-exporting');
      }
    };

    const getPdfTemplateFileName = (name) => {
      const safe = slugify(name || 'plantilla-pdf');
      const date = new Date().toISOString().slice(0, 10);
      return `${safe}-${date}.json`;
    };

    const buildPdfTemplatePayload = (name) => ({
      kind: 'pdf-designer-template',
      version: 1,
      name: String(name || '').trim() || 'Plantilla PDF',
      savedAt: new Date().toISOString(),
      layout: getPdfLayout(),
      pageConfig: getPdfPageConfig()
    });

    const downloadJsonFile = (filename, data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    };

    const saveCurrentPdfTemplate = () => {
      const rawName = window.prompt('Nombre de la plantilla PDF:', 'Plantilla PDF');
      if (rawName === null) return;
      const name = String(rawName || '').trim();
      if (!name) {
        Swal.fire({ icon: 'warning', title: 'Nombre requerido', text: 'Debes ingresar un nombre para la plantilla.' });
        return;
      }
      const payload = buildPdfTemplatePayload(name);
      downloadJsonFile(getPdfTemplateFileName(name), payload);
      Swal.fire({ icon: 'success', title: 'Plantilla exportada', text: 'Se descargó el archivo JSON de la plantilla.' });
    };

    const loadPdfTemplatePayload = (payload) => {
      if (!payload || typeof payload !== 'object') {
        throw new Error('El archivo no contiene un objeto JSON válido.');
      }
      const isTemplate = String(payload.kind || '').trim() === 'pdf-designer-template';
      if (!isTemplate) {
        throw new Error('El archivo no corresponde a una plantilla del diseñador PDF.');
      }
      savePdfLayout(payload.layout || createDefaultPdfLayout());
      savePdfPageConfig(payload.pageConfig || createDefaultPdfPageConfig());
    };

    const loadPdfTemplateFromFile = async (file) => {
      if (!file) return;
      try {
        const text = await file.text();
        const payload = JSON.parse(text);
        loadPdfTemplatePayload(payload);
        Swal.fire({ icon: 'success', title: 'Plantilla cargada', text: `Se aplicó la plantilla "${String(payload.name || file.name || 'sin nombre')}".` });
      } catch (error) {
        Swal.fire({ icon: 'error', title: 'No se pudo cargar la plantilla', text: error.message || 'Archivo inválido.' });
      }
    };

    const loadPdfTemplateIntoDesigner = () => {
      const input = document.getElementById('pdfTemplateFileInput');
      if (!input) {
        Swal.fire({ icon: 'error', title: 'No se encontró el cargador de plantillas.' });
        return;
      }
      input.click();
    };

    // Lista "Cargar desde biblioteca" de plantillas precargadas desde
    // plantillas/index.json (generado por generate_manifests.py). Se
    // refresca cada vez que se abre el dropdown.
    const renderPlantillasLibraryMenu = () => {
      const menu = document.getElementById('plantillasLibraryMenu');
      if (!menu) return;
      menu.innerHTML = '<div class="text-muted small px-2">Cargando...</div>';
      fetch('plantillas/index.json')
        .then((res) => {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then((items) => {
          const list = Array.isArray(items) ? items : [];
          if (!list.length) {
            menu.innerHTML = '<div class="text-muted small px-2">No hay plantillas en plantillas/.</div>';
            return;
          }
          menu.innerHTML = list.map((item) => `
            <button type="button" class="dropdown-item plantillas-library-item" data-file="${escapeHtml(item.file || '')}">${escapeHtml(item.label || item.file || '')}</button>
          `).join('');
        })
        .catch((error) => {
          menu.innerHTML = '<div class="text-danger small px-2">No se pudo cargar la biblioteca.</div>';
          console.error('No se pudo cargar plantillas/index.json:', error);
        });
    };

    const loadPlantillaFromLibrary = async (file) => {
      try {
        const response = await fetch(`plantillas/${file}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        loadPdfTemplatePayload(payload);
        Swal.fire({ icon: 'success', title: 'Plantilla cargada', text: `Se aplicó la plantilla "${String(payload.name || file)}".` });
      } catch (error) {
        Swal.fire({ icon: 'error', title: 'No se pudo cargar la plantilla', text: error.message || 'Archivo inválido.' });
      }
    };

    const getPdfBatchConfig = () => {
      const mode = String(document.getElementById('pdfBatchMode')?.value || 'single').trim();
      const groupField = String(document.getElementById('pdfBatchGroupField')?.value || 'REGIONES').trim();
      return {
        mode: mode === 'grouped' ? 'grouped' : 'single',
        groupField: ['REGIONES', 'PROVINCIA', 'MUNICIPIO'].includes(groupField) ? groupField : 'REGIONES'
      };
    };

    const exportPdfBatch = async () => {
      const sourceRows = Array.isArray(currentFilteredRows) ? currentFilteredRows : [];
      if (!sourceRows.length) {
        Swal.fire({ icon: 'warning', title: 'Sin datos', text: 'No hay registros filtrados para exportar.' });
        return;
      }
      const batch = getPdfBatchConfig();
      if (batch.mode === 'single') {
        await exportPdfFile(sourceRows);
        return;
      }

      const groups = new Map();
      sourceRows.forEach((row) => {
        const key = getCellText(row, batch.groupField) || 'Sin dato';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
      });
      const entries = Array.from(groups.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'es'));
      if (!entries.length) {
        Swal.fire({ icon: 'warning', title: 'Sin grupos', text: 'No se pudo agrupar los registros para la exportación por lote.' });
        return;
      }

      for (const [groupLabel, rowsGroup] of entries) {
        await exportPdfFile(rowsGroup, `${batch.groupField}-${groupLabel}`);
      }

      Swal.fire({ icon: 'success', title: 'Lote completado', text: `Se exportaron ${entries.length} archivos PDF separados por ${batch.groupField.toLowerCase()}.` });
    };

    const renderPdfDesignerLayout = () => {
      const container = document.getElementById('pdfDesignerLayoutRows');
      if (!container) return;
      const layout = getPdfLayout();
      const widthOptions = [12,11,10,9, 8,7, 6,5,4, 3, 2,1];
      const indicatorOptions = getPdfIndicatorFieldOptions();
      const chartFieldOptions = getPdfChartFieldOptions();

      const datasetAttrs = (meta = {}) => {
        const attrs = [
          `data-row-id="${escapeHtml(meta.rowId || '')}"`,
          `data-column-id="${escapeHtml(meta.columnId || '')}"`
        ];
        if (meta.parentColumnId) attrs.push(`data-parent-column-id="${escapeHtml(meta.parentColumnId)}"`);
        if (meta.nestedRowId) attrs.push(`data-nested-row-id="${escapeHtml(meta.nestedRowId)}"`);
        return attrs.join(' ');
      };

      const renderNestedRowsEditor = (rowId, parentColumn, nestedRows) => {
        const rowsSafe = Array.isArray(nestedRows) ? nestedRows : [];
        if (!rowsSafe.length) {
          return '<div class="text-muted small mt-2">Sin subfilas configuradas.</div>';
        }
        return rowsSafe.map((nestedRow, nestedRowIndex) => {
          const nestedWidthSum = (Array.isArray(nestedRow.columns) ? nestedRow.columns : []).reduce((sum, item) => sum + (Number(item.width) || 0), 0);
          const nestedBadgeClass = nestedWidthSum === 12 ? 'bg-success' : nestedWidthSum < 12 ? 'bg-warning text-dark' : 'bg-danger';
          const nestedColumnsHtml = (Array.isArray(nestedRow.columns) ? nestedRow.columns : []).map((nestedColumn, nestedColumnIndex) => {
            return renderColumnCard(nestedColumn, nestedColumnIndex, {
              rowId,
              columnId: nestedColumn.id,
              parentColumnId: parentColumn.id,
              nestedRowId: nestedRow.id,
              isNestedColumn: true
            });
          }).join('');
          return `
            <div class="card border-secondary-subtle">
              <div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-2 py-2">
                <div class="d-flex align-items-center gap-2">
                  <strong class="small">Subfila ${nestedRowIndex + 1}</strong>
                  <span class="badge ${nestedBadgeClass}">Suma ${nestedWidthSum}/12</span>
                </div>
                <div class="d-flex flex-wrap gap-2">
                  ${pdfRowPresets.map((preset) => `<button type="button" class="btn btn-outline-primary btn-sm pdf-nested-row-preset-btn" data-row-id="${escapeHtml(rowId)}" data-parent-column-id="${escapeHtml(parentColumn.id)}" data-nested-row-id="${escapeHtml(nestedRow.id)}" data-widths="${preset.widths.join(',')}">${preset.label}</button>`).join('')}
                  <button type="button" class="btn btn-outline-success btn-sm pdf-add-nested-column-btn" data-row-id="${escapeHtml(rowId)}" data-parent-column-id="${escapeHtml(parentColumn.id)}" data-nested-row-id="${escapeHtml(nestedRow.id)}">Agregar columna</button>
                  <button type="button" class="btn btn-outline-danger btn-sm pdf-remove-nested-row-btn" data-row-id="${escapeHtml(rowId)}" data-parent-column-id="${escapeHtml(parentColumn.id)}" data-nested-row-id="${escapeHtml(nestedRow.id)}">Eliminar subfila</button>
                </div>
              </div>
              <div class="card-body">
                <div class="mb-2">
                  <label class="form-label">Nombre de subfila</label>
                  <input type="text" class="form-control form-control-sm pdf-nested-row-title-input" data-row-id="${escapeHtml(rowId)}" data-parent-column-id="${escapeHtml(parentColumn.id)}" data-nested-row-id="${escapeHtml(nestedRow.id)}" value="${escapeHtml(nestedRow.title || '')}">
                </div>
                <div class="d-flex flex-column gap-2">${nestedColumnsHtml}</div>
              </div>
            </div>`;
        }).join('');
      };

      function renderColumnCard(column, columnIndex, meta) {
        const currentConfig = column.config || {};
        const attrs = datasetAttrs(meta);
        const hasNestedRows = !meta.isNestedColumn && Array.isArray(column.nestedRows) && column.nestedRows.length;
        const removeBtnClass = meta.isNestedColumn ? 'pdf-remove-nested-column-btn' : 'pdf-remove-column-btn';

        const configHtml = (() => {
          if (hasNestedRows) {
            return `
              <div class="mt-3 pt-3 border-top">
                <div class="alert alert-light border mb-2">Esta columna usa subfilas internas. El widget principal queda desactivado mientras existan subfilas.</div>
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <strong class="small text-secondary">Subfilas internas</strong>
                  <button type="button" class="btn btn-outline-success btn-sm pdf-add-nested-row-btn" data-row-id="${escapeHtml(meta.rowId)}" data-column-id="${escapeHtml(column.id)}">Agregar subfila</button>
                </div>
                <div class="d-flex flex-column gap-2">${renderNestedRowsEditor(meta.rowId, column, column.nestedRows)}</div>
              </div>`;
          }
          if (column.widgetType === 'indicator') {
            const isFamiliesSynthetic = String(currentConfig.fieldName || '').startsWith('__familias_');
            return `
              <div class="mt-3 pt-3 border-top">
                <div class="row g-2">
                  <div class="col-12 col-md-6">
                    <label class="form-label">Indicador</label>
                    <select class="form-select form-select-sm pdf-column-field-input" ${attrs}>
                      <option value="">Selecciona un indicador</option>
                      ${indicatorOptions.map((field) => `<option value="${escapeHtml(field.name)}" ${currentConfig.fieldName === field.name ? 'selected' : ''}>${escapeHtml(field.label || getFieldLabel(field))}</option>`).join('')}
                    </select>
                  </div>
                  <div class="col-12 col-md-6">
                    <label class="form-label">Agregación</label>
                    ${isFamiliesSynthetic
                      ? '<div class="form-control form-control-sm bg-light">Suma (fija para Familias beneficiadas)</div>'
                      : `<select class="form-select form-select-sm pdf-column-aggregation-input" ${attrs}>${['Suma', 'Promedio', 'Conteo', 'Porcentaje'].map((option) => `<option value="${option}" ${currentConfig.aggregation === option ? 'selected' : ''}>${option}</option>`).join('')}</select>`}
                  </div>
                </div>
                ${isFamiliesSynthetic ? '<div class="text-muted small mt-2">Este indicador usa agregación de suma para total o por agrupación territorial.</div>' : ''}
              </div>`;
          }
          if (column.widgetType === 'chart') {
            return `
              <div class="mt-3 pt-3 border-top">
                <div class="row g-2">
                  <div class="col-12 col-md-6">
                    <label class="form-label">Campo del chart</label>
                    <select class="form-select form-select-sm pdf-column-field-input" ${attrs}>
                      <option value="">Selecciona un campo</option>
                      ${chartFieldOptions.map((field) => `<option value="${escapeHtml(field.value)}" ${currentConfig.fieldName === field.value ? 'selected' : ''}>${escapeHtml(field.label)}</option>`).join('')}
                    </select>
                  </div>
                  <div class="col-12 col-md-6">
                    <label class="form-label">Tipo de chart</label>
                    <select class="form-select form-select-sm pdf-column-chart-type-input" ${attrs}>
                      ${['bar', 'doughnut'].map((option) => `<option value="${option}" ${currentConfig.chartType === option ? 'selected' : ''}>${option}</option>`).join('')}
                    </select>
                  </div>
                </div>
              </div>`;
          }
          if (column.widgetType === 'text') {
            return `
              <div class="mt-3 pt-3 border-top">
                <div class="row g-2">
                  <div class="col-12">
                    <label class="form-label">Texto</label>
                    <textarea class="form-control form-control-sm pdf-column-text-input" rows="3" ${attrs} placeholder="Escribe el contenido del bloque">${escapeHtml(currentConfig.textContent || '')}</textarea>
                  </div>
                  <div class="col-12">
                    <div class="form-check">
                      <input class="form-check-input pdf-column-bold-input" type="checkbox" ${attrs} ${currentConfig.boldText ? 'checked' : ''}>
                      <label class="form-check-label">Negrita</label>
                    </div>
                  </div>
                </div>
              </div>`;
          }
          if (column.widgetType === 'map' || column.widgetType === 'map_bolivia') {
            return `
              <div class="mt-3 pt-3 border-top">
                <div class="row g-2 align-items-end">
                  <div class="col-12 col-md-6">
                    <label class="form-label">Escala de markers</label>
                    <select class="form-select form-select-sm pdf-column-marker-scale-input" ${attrs}>
                      ${pdfMarkerScaleOptions.map((option) => `<option value="${option}" ${Number(currentConfig.markerScale) === option ? 'selected' : ''}>${option}x</option>`).join('')}
                    </select>
                  </div>
                  <div class="col-12 col-md-6">
                    <div class="text-muted small">La escala se usará para reducir o ampliar el marcador en la renderización del mapa.</div>
                  </div>
                </div>
                <div class="row g-2 mt-1">
                  ${renderPdfMapPickerDropdown({ groupKey: 'regiones', groupLabel: 'Región', options: PDF_MAP_REGIONES, selectedValues: currentConfig.regiones, checkboxClass: 'pdf-column-region-checkbox', attrs, scope: 'pdf' })}
                  ${renderPdfMapPickerDropdown({ groupKey: 'provincias', groupLabel: 'Provincia', options: PDF_MAP_PROVINCIAS, selectedValues: currentConfig.provincias, checkboxClass: 'pdf-column-provincia-checkbox', attrs, scope: 'pdf' })}
                  ${renderPdfMapPickerDropdown({ groupKey: 'municipios', groupLabel: 'Municipio', options: PDF_MAP_MUNICIPIOS, selectedValues: currentConfig.municipios, checkboxClass: 'pdf-column-municipio-checkbox', attrs, scope: 'pdf' })}
                </div>
                <div class="text-muted small mt-1">Las entidades marcadas se resaltan sobre el mapa base. Sin selección no se resalta nada extra.</div>
              </div>`;
          }
          if (column.widgetType === 'image') {
            return `
              <div class="mt-3 pt-3 border-top">
                <div class="row g-2">
                  <div class="col-12">
                    <label class="form-label">URL de imagen (opcional)</label>
                    <input type="text" class="form-control form-control-sm pdf-column-image-url-input" ${attrs} value="${escapeHtml(currentConfig.imageUrl || '')}" placeholder="https://... o data:image/...">
                  </div>
                  <div class="col-12 d-flex flex-wrap gap-2 align-items-center">
                    <button type="button" class="btn btn-outline-secondary btn-sm pdf-column-image-upload-btn" ${attrs}>Cargar imagen</button>
                    <input type="file" accept="image/*" class="d-none pdf-column-image-input" ${attrs}>
                    <span class="text-muted small">${currentConfig.imageDataUrl ? 'Imagen local cargada' : 'Sin imagen local'}</span>
                  </div>
                  <div class="col-12 col-md-6">
                    <label class="form-label">Ajuste</label>
                    <select class="form-select form-select-sm pdf-column-image-fit-input" ${attrs}>
                      ${['contain', 'cover', 'fill'].map((fit) => `<option value="${fit}" ${String(currentConfig.imageFit || 'contain') === fit ? 'selected' : ''}>${fit}</option>`).join('')}
                    </select>
                  </div>
                  <div class="col-12 col-md-6">
                    <label class="form-label">Altura (mm)</label>
                    <input type="number" min="10" max="130" step="1" class="form-control form-control-sm pdf-column-image-height-input" ${attrs} value="${escapeHtml(String(currentConfig.imageHeightMm ?? 52))}">
                  </div>
                </div>
              </div>`;
          }
          if (column.widgetType === 'table') {
            return `
              <div class="mt-3 pt-3 border-top text-muted small">
                La tabla usará el contexto filtrado actual. En la siguiente fase se podrá elegir columnas y orden.
              </div>`;
          }
          return '';
        })();

        return `
          <div class="pdf-layout-column-card p-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <strong class="small">${meta.isNestedColumn ? 'Subcolumna' : 'Columna'} ${columnIndex + 1}</strong>
              <button type="button" class="btn btn-link btn-sm text-danger p-0 ${removeBtnClass}" ${attrs}>Eliminar</button>
            </div>
            <div class="row g-2">
              <div class="col-12 col-md-4">
                <label class="form-label">Ancho</label>
                <select class="form-select form-select-sm pdf-column-width-input" ${attrs}>
                  ${widthOptions.map((width) => `<option value="${width}" ${Number(column.width) === width ? 'selected' : ''}>${width}/12</option>`).join('')}
                </select>
              </div>
              <div class="col-12 col-md-4">
                <label class="form-label">Widget</label>
                <select class="form-select form-select-sm pdf-column-widget-input" ${attrs} ${hasNestedRows ? 'disabled' : ''}>
                  ${pdfWidgetTypes.map((type) => `<option value="${type.value}" ${column.widgetType === type.value ? 'selected' : ''}>${type.label}</option>`).join('')}
                </select>
              </div>
              <div class="col-12 col-md-4">
                <label class="form-label">Título</label>
                <input type="text" class="form-control form-control-sm pdf-column-title-input" ${attrs} value="${escapeHtml(column.widgetTitle || '')}" placeholder="Opcional">
              </div>
            </div>
            ${!meta.isNestedColumn ? `<div class="mt-2 d-flex flex-wrap gap-2">${hasNestedRows
              ? `<button type="button" class="btn btn-outline-warning btn-sm pdf-disable-nested-rows-btn" data-row-id="${escapeHtml(meta.rowId)}" data-column-id="${escapeHtml(column.id)}">Quitar subfilas</button>`
              : `<button type="button" class="btn btn-outline-info btn-sm pdf-enable-nested-rows-btn" data-row-id="${escapeHtml(meta.rowId)}" data-column-id="${escapeHtml(column.id)}">Activar subfilas</button>`}</div>` : ''}
            ${configHtml}
          </div>`;
      }

      const rowsHtml = layout.rows.map((row, rowIndex) => {
        const widthSum = row.columns.reduce((sum, column) => sum + (Number(column.width) || 0), 0);
        const widthBadgeClass = widthSum === 12 ? 'bg-success' : widthSum < 12 ? 'bg-warning text-dark' : 'bg-danger';
        const columnsHtml = row.columns.map((column, columnIndex) => renderColumnCard(column, columnIndex, {
          rowId: row.id,
          columnId: column.id,
          isNestedColumn: false
        })).join('');
        return `
          <div class="card shadow-sm pdf-layout-row-card">
            <div class="card-header d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
              <div class="d-flex flex-column gap-1">
                <div class="d-flex align-items-center gap-2 flex-wrap">
                  <strong>Fila ${rowIndex + 1}</strong>
                  <span class="badge ${widthBadgeClass}">Suma ${widthSum}/12</span>
                </div>
                <small class="text-muted">La suma ideal de columnas es 12 para una carta horizontal o vertical con grilla Bootstrap.</small>
              </div>
              <div class="d-flex flex-wrap gap-2">
                ${pdfRowPresets.map((preset) => `<button type="button" class="btn btn-outline-primary btn-sm pdf-row-preset-btn" data-row-id="${escapeHtml(row.id)}" data-widths="${preset.widths.join(',')}">${preset.label}</button>`).join('')}
                <button type="button" class="btn btn-outline-success btn-sm pdf-add-column-btn" data-row-id="${escapeHtml(row.id)}">Agregar columna</button>
                <button type="button" class="btn btn-outline-danger btn-sm pdf-remove-row-btn" data-row-id="${escapeHtml(row.id)}">Eliminar fila</button>
              </div>
            </div>
            <div class="card-body">
              <div class="mb-3">
                <label class="form-label">Nombre de la fila</label>
                <input type="text" class="form-control pdf-row-title-input" data-row-id="${escapeHtml(row.id)}" value="${escapeHtml(row.title || '')}">
              </div>
              <div class="d-flex flex-column gap-3">
                ${columnsHtml}
              </div>
            </div>
          </div>`;
      }).join('');
      container.innerHTML = rowsHtml || '<div class="alert alert-secondary mb-0">Aún no hay filas definidas.</div>';
      syncPdfDesignerContext();
      updatePdfPageEstimate();
    };

    const getVisibleColumnCount = () => {
      const available = getAvailableColumns();
      return getVisibleColumnsForSheet(available).length;
    };

    const getActiveFilterCount = () => {
      let count = 0;
      if (state.hojaFilter) count += 1;
      if (state.categoryFilter) count += 1;
      count += Object.values(state.dynamicFilters || {}).filter((value) => {
        if (!value) return false;
        if (typeof value === 'object') {
          return Boolean(value.value || value.valueTo);
        }
        return Boolean(value);
      }).length;
      return count;
    };

    const getMapPointCount = (sourceRows) => {
      const { latField, lngField } = detectCoordinateFields();
      if (!latField || !lngField) return 0;
      return sourceRows.filter((row) => {
        const lat = parseNumber(row[latField]);
        const lng = parseNumber(row[lngField]);
        return isValidCoordinatePair(lat, lng);
      }).length;
    };

    const syncPdfDesignerContext = () => {
      const unit = currentUnitId ? getUnitById(currentUnitId) : null;
      const unitLabel = unit ? unit.label : 'Sin unidad activa';
      const filteredRows = Array.isArray(currentFilteredRows) ? currentFilteredRows : [];
      const indicatorsCount = getIndicatorFields().length;
      const chartsCount = getDynamicFilterFields().filter(field => field.name && !isNumericField(field) && normalizeFieldName(field.name) !== 'familias_beneficiadas').length + (getFamiliesBeneficiadasField() ? 1 : 0);
      const columnsCount = getVisibleColumnCount();
      const mapPointsCount = getMapPointCount(filteredRows);

      const setText = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.textContent = String(value);
      };

      setText('pdfDesignerUnitLabel', unitLabel);
      setText('pdfDesignerRowsCount', filteredRows.length);
      setText('pdfDesignerFiltersCount', getActiveFilterCount());
      setText('pdfDesignerTableMode', currentTableMode || 'fid');
      setText('pdfDesignerIndicatorsCount', indicatorsCount);
      setText('pdfDesignerChartsCount', chartsCount);
      setText('pdfDesignerColumnsCount', columnsCount);
      setText('pdfDesignerMapPointsCount', mapPointsCount);

      const subtitle = document.getElementById('pdfDesignerModalSubtitle');
      if (subtitle) {
        subtitle.textContent = unit ? `Contexto activo de ${unit.label}.` : 'No hay unidad activa.';
      }
      const footer = document.getElementById('pdfDesignerModalFooter');
      if (footer) {
        footer.textContent = unit ? `Unidad ${unit.label} lista para construir filas, columnas y widgets.` : 'Selecciona una unidad para preparar el PDF.';
      }
    };

    const openPdfDesignerModal = () => {
      if (!currentUnitId) {
        Swal.fire({ icon: 'warning', title: 'Selecciona una unidad', text: 'Debes ingresar a una unidad antes de abrir el diseñador PDF.' });
        return;
      }
      getPdfLayout();
      renderPdfDesignerLayout();
      renderPdfPageConfigControls();
      updatePdfPageEstimate();
      syncPdfDesignerContext();
      pdfDesignerModal?.show();
    };

    const getPdfTargetMeta = (el) => ({
      rowId: String(el?.dataset?.rowId || '').trim(),
      columnId: String(el?.dataset?.columnId || '').trim(),
      parentColumnId: String(el?.dataset?.parentColumnId || '').trim(),
      nestedRowId: String(el?.dataset?.nestedRowId || '').trim()
    });

    const updateColumnByMeta = (meta, updater) => {
      if (!meta?.rowId || !meta?.columnId) return;
      if (meta.parentColumnId && meta.nestedRowId) {
        updatePdfNestedColumn(meta.rowId, meta.parentColumnId, meta.nestedRowId, meta.columnId, updater);
        return;
      }
      updatePdfLayoutColumn(meta.rowId, meta.columnId, updater);
    };

    const findPdfColumnByMeta = (meta) => {
      if (!meta?.rowId || !meta?.columnId) return null;
      const layout = getPdfLayout();
      const row = layout.rows.find((item) => item.id === meta.rowId);
      if (!row) return null;
      if (meta.parentColumnId && meta.nestedRowId) {
        const parentColumn = row.columns.find((item) => item.id === meta.parentColumnId);
        const nestedRow = (parentColumn?.nestedRows || []).find((item) => item.id === meta.nestedRowId);
        return (nestedRow?.columns || []).find((item) => item.id === meta.columnId) || null;
      }
      return row.columns.find((item) => item.id === meta.columnId) || null;
    };

    // Como updateColumnByMeta, pero SIN disparar renderPdfDesignerLayout().
    // Se usa para los checkboxes de Region/Provincia/Municipio: el re-render
    // completo cierra el dropdown en cada clic (savePdfLayout -> render),
    // asi que aqui se muta el layout ya vivo directamente y se persiste sin
    // reconstruir el HTML -- el llamador actualiza el boton a mano.
    const updateColumnByMetaSilent = (meta, updater) => {
      const column = findPdfColumnByMeta(meta);
      if (!column) return;
      updater(column);
      persistCurrentUnitContext();
    };


