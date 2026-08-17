    // ==========================================================================
    // MODULO: BOOTSTRAP / EVENTOS GLOBALES
    // Listeners de click y change delegados + arranque en DOMContentLoaded.
    // ==========================================================================

    document.addEventListener('click', async (event) => {
      if (event.target.closest('.btn-docs')) {
        const button = event.target.closest('.btn-docs');
        event.preventDefault();
        const rowData = dataTable.row($(button).closest('tr')).data();
        if (!rowData) return;
        const docs = getDocumentsForRow(rowData);
        openDocumentsModal(rowData, docs);
        return;
      }
      const target = event.target.closest('.doc-link-btn');
      if (!target) return;
      event.preventDefault();
      await openDocumentLink(target.dataset.url);
    });

    document.addEventListener('change', (event) => {
      const highlightGroupKey = event.target.classList.contains('map-highlight-region-checkbox') ? 'regiones'
        : event.target.classList.contains('map-highlight-provincia-checkbox') ? 'provincias'
        : event.target.classList.contains('map-highlight-municipio-checkbox') ? 'municipios'
        : null;
      if (highlightGroupKey) {
        const value = String(event.target.value || '');
        const checked = event.target.checked;
        const current = new Set(mapHighlightSelection[highlightGroupKey] || []);
        if (checked) current.add(value); else current.delete(value);
        mapHighlightSelection[highlightGroupKey] = Array.from(current);
        updateMapHighlightButtonLabel(highlightGroupKey);
        refreshMapHighlightLayer();
      }
      if (event.target.classList.contains('map-picker-select-all')) {
        const targetClass = event.target.dataset.targetClass;
        const groupKey = event.target.dataset.group;
        const scope = event.target.dataset.scope;
        const emptyLabel = event.target.dataset.emptyLabel || 'todas';
        const menu = event.target.closest('.dropdown-menu');
        const checkboxes = menu ? Array.from(menu.querySelectorAll(`.${targetClass}`)) : [];
        const allNames = checkboxes.map((cb) => cb.value);
        checkboxes.forEach((cb) => { cb.checked = event.target.checked; });
        const newSelection = event.target.checked ? allNames : [];
        const toggleBtn = event.target.closest('.dropdown')?.querySelector('.dropdown-toggle');
        const groupLabels = { regiones: 'Región', provincias: 'Provincia', municipios: 'Municipio' };
        const label = groupLabels[groupKey] || groupKey;
        if (toggleBtn) {
          toggleBtn.textContent = newSelection.length ? `${label} (${newSelection.length})` : `${label} (${emptyLabel})`;
        }
        if (scope === 'live') {
          mapHighlightSelection[groupKey] = newSelection;
          refreshMapHighlightLayer();
        } else {
          const meta = getPdfTargetMeta(event.target);
          updateColumnByMetaSilent(meta, (column) => {
            column.config[groupKey] = newSelection;
          });
        }
      }
      if (event.target.id === 'filterCategoria') {
        handleCategoryChange();
      }
      if (event.target.id === 'filterHoja') {
        handleSheetChange();
      }
      if (event.target.id === 'groupByFieldSelect') {
        state.groupByField = String(event.target.value || 'REGIONES').toUpperCase();
        applyFilters();
      }
      if (event.target.classList.contains('dynamic-filter-select')) {
        const select = event.target;
        state.dynamicFilters = { ...state.dynamicFilters, [select.dataset.fieldName]: select.value };
        if (!select.value) {
          delete state.dynamicFilters[select.dataset.fieldName];
        }
        applyFilters();
      }
      if (event.target.classList.contains('numeric-filter-op') || event.target.classList.contains('numeric-filter-value') || event.target.classList.contains('numeric-filter-value-to')) {
        const fieldName = event.target.dataset.fieldName;
        const container = document.getElementById('dynamicFiltersRow');
        const opControl = container.querySelector(`.numeric-filter-op[data-field-name="${fieldName}"]`);
        const valueControl = container.querySelector(`.numeric-filter-value[data-field-name="${fieldName}"]`);
        const valueToControl = container.querySelector(`.numeric-filter-value-to[data-field-name="${fieldName}"]`);
        if (!opControl || !valueControl) return;
        const filter = {
          op: opControl.value,
          value: valueControl.value ?? '',
          valueTo: valueToControl ? valueToControl.value ?? '' : ''
        };
        if (filter.op !== 'between') {
          filter.valueTo = '';
        }
        if (!filter.value && filter.op !== 'between') {
          delete state.dynamicFilters[fieldName];
        } else if (filter.op === 'between' && !filter.value && !filter.valueTo) {
          delete state.dynamicFilters[fieldName];
        } else {
          state.dynamicFilters = { ...state.dynamicFilters, [fieldName]: filter };
        }
        if (event.target.classList.contains('numeric-filter-op') && valueToControl) {
          valueToControl.classList.toggle('d-none', opControl.value !== 'between');
        }
        applyFilters();
      }
    });

    document.addEventListener('change', (event) => {
      if (event.target.classList.contains('column-visibility-checkbox')) {
        const checkbox = event.target;
        const value = checkbox.value;
        const sheetKey = getCurrentSheetKey();
        const currentSelections = Array.isArray(state.visibleColumnsBySheet[sheetKey]) ? [...state.visibleColumnsBySheet[sheetKey]] : getVisibleColumnsForSheet(getAvailableColumns());
        if (checkbox.checked) {
          if (!currentSelections.includes(value)) currentSelections.push(value);
        } else {
          const index = currentSelections.indexOf(value);
          if (index !== -1) currentSelections.splice(index, 1);
        }
        if (!currentSelections.length) {
          state.visibleColumnsBySheet[sheetKey] = getDefaultVisibleColumns(getAvailableColumns());
        } else {
          state.visibleColumnsBySheet[sheetKey] = currentSelections;
        }
        renderTable(currentFilteredRows);
      }
      if (event.target.classList.contains('pdf-row-title-input')) {
        const rowId = event.target.dataset.rowId;
        const title = String(event.target.value || '').trim();
        updatePdfLayoutRow(rowId, (row) => {
          row.title = title;
        });
      }
      if (event.target.classList.contains('pdf-column-width-input')) {
        const meta = getPdfTargetMeta(event.target);
        const width = parseInt(event.target.value, 10);
        updateColumnByMeta(meta, (column) => {
          column.width = Number.isFinite(width) ? width : 12;
        });
      }
      if (event.target.classList.contains('pdf-column-widget-input')) {
        const meta = getPdfTargetMeta(event.target);
        const widgetType = event.target.value;
        updateColumnByMeta(meta, (column) => {
          if (pdfWidgetTypes.some((type) => type.value === widgetType)) {
            column.widgetType = widgetType;
          }
        });
      }
      if (event.target.classList.contains('pdf-column-title-input')) {
        const meta = getPdfTargetMeta(event.target);
        const widgetTitle = String(event.target.value || '').trim();
        updateColumnByMeta(meta, (column) => {
          column.widgetTitle = widgetTitle;
        });
      }
      if (event.target.classList.contains('pdf-column-field-input')) {
        const meta = getPdfTargetMeta(event.target);
        updateColumnByMeta(meta, (column) => {
          column.config.fieldName = String(event.target.value || '').trim();
        });
      }
      if (event.target.classList.contains('pdf-column-aggregation-input')) {
        const meta = getPdfTargetMeta(event.target);
        updateColumnByMeta(meta, (column) => {
          column.config.aggregation = String(event.target.value || 'Suma').trim();
        });
      }
      if (event.target.classList.contains('pdf-column-chart-type-input')) {
        const meta = getPdfTargetMeta(event.target);
        updateColumnByMeta(meta, (column) => {
          column.config.chartType = String(event.target.value || 'bar').trim();
        });
      }
      if (event.target.classList.contains('pdf-column-text-input')) {
        const meta = getPdfTargetMeta(event.target);
        updateColumnByMeta(meta, (column) => {
          column.config.textContent = String(event.target.value || '').trim();
        });
      }
      if (event.target.classList.contains('pdf-column-bold-input')) {
        const meta = getPdfTargetMeta(event.target);
        updateColumnByMeta(meta, (column) => {
          column.config.boldText = Boolean(event.target.checked);
        });
      }
      if (event.target.classList.contains('pdf-column-marker-scale-input')) {
        const meta = getPdfTargetMeta(event.target);
        updateColumnByMeta(meta, (column) => {
          const scale = Number(event.target.value);
          column.config.markerScale = pdfMarkerScaleOptions.includes(scale) ? scale : 1;
        });
      }
      const mapPickerField = event.target.classList.contains('pdf-column-region-checkbox') ? 'regiones'
        : event.target.classList.contains('pdf-column-provincia-checkbox') ? 'provincias'
        : event.target.classList.contains('pdf-column-municipio-checkbox') ? 'municipios'
        : null;
      if (mapPickerField) {
        const meta = getPdfTargetMeta(event.target);
        const value = String(event.target.value || '');
        const checked = event.target.checked;
        const mapPickerLabels = { regiones: 'Región', provincias: 'Provincia', municipios: 'Municipio' };
        updateColumnByMetaSilent(meta, (column) => {
          const current = new Set(Array.isArray(column.config[mapPickerField]) ? column.config[mapPickerField] : []);
          if (checked) current.add(value); else current.delete(value);
          column.config[mapPickerField] = Array.from(current);
          const toggle = event.target.closest('.dropdown')?.querySelector('.dropdown-toggle');
          if (toggle) {
            const count = column.config[mapPickerField].length;
            const label = mapPickerLabels[mapPickerField];
            toggle.textContent = count ? `${label} (${count})` : `${label} (todas)`;
          }
        });
      }
      if (event.target.classList.contains('pdf-column-image-url-input')) {
        const meta = getPdfTargetMeta(event.target);
        updateColumnByMeta(meta, (column) => {
          column.config.imageUrl = String(event.target.value || '').trim();
        });
      }
      if (event.target.classList.contains('pdf-column-image-fit-input')) {
        const meta = getPdfTargetMeta(event.target);
        updateColumnByMeta(meta, (column) => {
          const fit = String(event.target.value || 'contain').trim();
          column.config.imageFit = ['contain', 'cover', 'fill'].includes(fit) ? fit : 'contain';
        });
      }
      if (event.target.classList.contains('pdf-column-image-height-input')) {
        const meta = getPdfTargetMeta(event.target);
        updateColumnByMeta(meta, (column) => {
          const value = Number(event.target.value);
          column.config.imageHeightMm = Number.isFinite(value) ? Math.max(10, Math.min(130, value)) : 52;
        });
      }
      if (event.target.classList.contains('pdf-column-image-input')) {
        const meta = getPdfTargetMeta(event.target);
        const file = event.target.files?.[0];
        if (file) {
          readImageAsDataUrl(file)
            .then((dataUrl) => {
              updateColumnByMeta(meta, (column) => {
                column.config.imageDataUrl = dataUrl;
              });
            })
            .catch((error) => {
              Swal.fire({ icon: 'error', title: 'No se pudo cargar la imagen', text: error.message });
            });
        }
        event.target.value = '';
      }
      if (event.target.classList.contains('pdf-nested-row-title-input')) {
        const rowId = String(event.target.dataset.rowId || '').trim();
        const parentColumnId = String(event.target.dataset.parentColumnId || '').trim();
        const nestedRowId = String(event.target.dataset.nestedRowId || '').trim();
        const title = String(event.target.value || '').trim();
        updatePdfNestedRow(rowId, parentColumnId, nestedRowId, (nestedRow) => {
          nestedRow.title = title;
        });
      }
      if (['pdfPageOrientation', 'pdfHeaderHeightMm', 'pdfFooterHeightMm', 'pdfHeaderTitle', 'pdfHeaderSubtitle', 'pdfFooterText'].includes(event.target.id)) {
        updatePdfPageConfigFromControls();
      }
      if (event.target.id === 'pdfHeaderLeftLogoInput') {
        assignPdfLogo('header-left', event.target.files?.[0]);
        event.target.value = '';
      }
      if (event.target.id === 'pdfHeaderRightLogoInput') {
        assignPdfLogo('header-right', event.target.files?.[0]);
        event.target.value = '';
      }
      if (event.target.id === 'pdfFooterLeftLogoInput') {
        assignPdfLogo('footer-left', event.target.files?.[0]);
        event.target.value = '';
      }
      if (event.target.id === 'pdfFooterRightLogoInput') {
        assignPdfLogo('footer-right', event.target.files?.[0]);
        event.target.value = '';
      }
      if (event.target.id === 'pdfTemplateFileInput') {
        const file = event.target.files?.[0];
        loadPdfTemplateFromFile(file);
        event.target.value = '';
      }
    });

    document.addEventListener('click', (event) => {
      const proyectosLibraryItem = event.target.closest('.proyectos-library-item');
      if (proyectosLibraryItem) {
        const file = String(proyectosLibraryItem.dataset.file || '').trim();
        if (file) loadJsonUrl(`proyectos/${file}`);
      }
      const plantillasLibraryItem = event.target.closest('.plantillas-library-item');
      if (plantillasLibraryItem) {
        const file = String(plantillasLibraryItem.dataset.file || '').trim();
        if (file) loadPlantillaFromLibrary(file);
      }
      const rowPresetButton = event.target.closest('.pdf-row-preset-btn');
      if (rowPresetButton) {
        const rowId = rowPresetButton.dataset.rowId;
        const widths = String(rowPresetButton.dataset.widths || '')
          .split(',')
          .map((value) => parseInt(value, 10))
          .filter((value) => Number.isFinite(value) && value >= 1 && value <= 12);
        if (widths.length) {
          setPdfRowPreset(rowId, widths);
        }
      }
      const addRowButton = event.target.closest('#btnPdfAddRow');
      if (addRowButton) {
        addPdfLayoutRow();
      }
      const resetLayoutButton = event.target.closest('#btnPdfResetLayout');
      if (resetLayoutButton) {
        savePdfLayout(createDefaultPdfLayout());
      }
      const addColumnButton = event.target.closest('.pdf-add-column-btn');
      if (addColumnButton) {
        addPdfLayoutColumn(addColumnButton.dataset.rowId);
      }
      const enableNestedRowsButton = event.target.closest('.pdf-enable-nested-rows-btn');
      if (enableNestedRowsButton) {
        updatePdfLayoutColumn(enableNestedRowsButton.dataset.rowId, enableNestedRowsButton.dataset.columnId, (column) => {
          column.nestedRows = [createDefaultPdfNestedRow(0)];
        });
      }
      const disableNestedRowsButton = event.target.closest('.pdf-disable-nested-rows-btn');
      if (disableNestedRowsButton) {
        updatePdfLayoutColumn(disableNestedRowsButton.dataset.rowId, disableNestedRowsButton.dataset.columnId, (column) => {
          column.nestedRows = [];
        });
      }
      const addNestedRowButton = event.target.closest('.pdf-add-nested-row-btn');
      if (addNestedRowButton) {
        addPdfNestedRow(addNestedRowButton.dataset.rowId, addNestedRowButton.dataset.columnId);
      }
      const removeNestedRowButton = event.target.closest('.pdf-remove-nested-row-btn');
      if (removeNestedRowButton) {
        removePdfNestedRow(removeNestedRowButton.dataset.rowId, removeNestedRowButton.dataset.parentColumnId, removeNestedRowButton.dataset.nestedRowId);
      }
      const addNestedColumnButton = event.target.closest('.pdf-add-nested-column-btn');
      if (addNestedColumnButton) {
        addPdfNestedColumn(addNestedColumnButton.dataset.rowId, addNestedColumnButton.dataset.parentColumnId, addNestedColumnButton.dataset.nestedRowId);
      }
      const removeNestedColumnButton = event.target.closest('.pdf-remove-nested-column-btn');
      if (removeNestedColumnButton) {
        removePdfNestedColumn(
          removeNestedColumnButton.dataset.rowId,
          removeNestedColumnButton.dataset.parentColumnId,
          removeNestedColumnButton.dataset.nestedRowId,
          removeNestedColumnButton.dataset.columnId
        );
      }
      const nestedRowPresetButton = event.target.closest('.pdf-nested-row-preset-btn');
      if (nestedRowPresetButton) {
        const widths = String(nestedRowPresetButton.dataset.widths || '')
          .split(',')
          .map((value) => parseInt(value, 10))
          .filter((value) => Number.isFinite(value) && value >= 1 && value <= 12);
        if (widths.length) {
          setPdfNestedRowPreset(
            nestedRowPresetButton.dataset.rowId,
            nestedRowPresetButton.dataset.parentColumnId,
            nestedRowPresetButton.dataset.nestedRowId,
            widths
          );
        }
      }
      const removeColumnButton = event.target.closest('.pdf-remove-column-btn');
      if (removeColumnButton) {
        removePdfLayoutColumn(removeColumnButton.dataset.rowId, removeColumnButton.dataset.columnId);
      }
      const removeRowButton = event.target.closest('.pdf-remove-row-btn');
      if (removeRowButton) {
        removePdfLayoutRow(removeRowButton.dataset.rowId);
      }
      if (event.target.closest('#btnPdfHeaderLeftLogo')) {
        document.getElementById('pdfHeaderLeftLogoInput')?.click();
      }
      if (event.target.closest('#btnPdfHeaderRightLogo')) {
        document.getElementById('pdfHeaderRightLogoInput')?.click();
      }
      if (event.target.closest('#btnPdfFooterLeftLogo')) {
        document.getElementById('pdfFooterLeftLogoInput')?.click();
      }
      if (event.target.closest('#btnPdfFooterRightLogo')) {
        document.getElementById('pdfFooterRightLogoInput')?.click();
      }
      if (event.target.closest('#btnPdfPreview')) {
        previewPdfPrintableView();
      }
      if (event.target.closest('#btnExportPdf')) {
        exportPdfFile();
      }
      if (event.target.closest('#btnPdfBatchExport')) {
        exportPdfBatch();
      }
      if (event.target.closest('#btnPdfSaveTemplate')) {
        saveCurrentPdfTemplate();
      }
      if (event.target.closest('#btnPdfLoadTemplate')) {
        loadPdfTemplateIntoDesigner();
      }
      const imageUploadButton = event.target.closest('.pdf-column-image-upload-btn');
      if (imageUploadButton) {
        const rowId = String(imageUploadButton.dataset.rowId || '').trim();
        const columnId = String(imageUploadButton.dataset.columnId || '').trim();
        const parentColumnId = String(imageUploadButton.dataset.parentColumnId || '').trim();
        const nestedRowId = String(imageUploadButton.dataset.nestedRowId || '').trim();
        const input = Array.from(document.querySelectorAll('.pdf-column-image-input')).find((item) => {
          if (String(item.dataset.rowId || '').trim() !== rowId) return false;
          if (String(item.dataset.columnId || '').trim() !== columnId) return false;
          if (String(item.dataset.parentColumnId || '').trim() !== parentColumnId) return false;
          if (String(item.dataset.nestedRowId || '').trim() !== nestedRowId) return false;
          return true;
        });
        input?.click();
      }
    });

    document.addEventListener('DOMContentLoaded', () => {
      loadMapGeoData().then(() => {
        if (document.getElementById('map')) buildMap();
      });
      initJsonLoader();
      document.getElementById('btnProyectosLibrary')?.addEventListener('show.bs.dropdown', renderProyectosLibraryMenu);
      document.getElementById('btnPlantillasLibrary')?.addEventListener('show.bs.dropdown', renderPlantillasLibraryMenu);
      document.getElementById('btnResetFilters')?.addEventListener('click', resetToAllProjects);
      document.getElementById('btnShowAll')?.addEventListener('click', resetToAllProjects);
      document.getElementById('btnReloadData')?.addEventListener('click', reloadDataFromJson);
      document.getElementById('btnOpenPdfDesigner')?.addEventListener('click', openPdfDesignerModal);
      document.getElementById('btnGoHome')?.addEventListener('click', () => {
        window.location.hash = '#inicio';
      });
      const pdfDesignerModalEl = document.getElementById('pdfDesignerModal');
      if (pdfDesignerModalEl) {
        pdfDesignerModal = new bootstrap.Modal(pdfDesignerModalEl);
        pdfDesignerModalEl.addEventListener('shown.bs.modal', () => {
          renderPdfDesignerLayout();
          renderPdfPageConfigControls();
          updatePdfPageEstimate();
        });
      }
      loadUnitCatalog().then(() => {
        renderHomeUnits();
        if (!window.location.hash || window.location.hash === '#') {
          window.location.hash = '#inicio';
        } else {
          applyRoute();
        }
      });
      window.addEventListener('hashchange', applyRoute);
      window.addEventListener('resize', syncMapSize);
    });

