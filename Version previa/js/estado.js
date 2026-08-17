    // ==========================================================================
    // MODULO: ESTADO GLOBAL Y UNIDADES
    // Variables compartidas por toda la app, catalogo de unidades/areas,
    // ruteo por hash (#unidad/xxx) y persistencia del contexto de cada unidad.
    // ==========================================================================

    let rows = [];
    let rawData = [];
    let fieldDefinitions = [];
    let fieldDefinitionsByName = new Map();
    let dataTable;
    let currentTableMode = 'fid';
    let state = { hojaFilter: '', categoryFilter: '', dynamicFilters: {}, visibleColumnsBySheet: {}, groupByField: 'REGIONES' };
    let chartInstances = [];
    let pdfDesignerModal;
    let map;
    let markersLayer;
    let mapBaseLayersControl;
    let highlightLayer;
    let mapHighlightSelection = { regiones: [], provincias: [], municipios: [] };
    let currentFilteredRows = [];
    let currentUnitId = null;
    const unitStore = {};

    // El catalogo de unidades ya NO va hardcodeado: se lee de img/index.json
    // (generado por generate_manifests.py a partir de lo que haya en img/).
    // Correr ese script despues de agregar/quitar/renombrar una imagen de unidad.
    let unitCatalog = [];
    let unitCatalogPromise = null;

    const loadUnitCatalog = () => {
      if (unitCatalogPromise) return unitCatalogPromise;
      unitCatalogPromise = fetch('img/index.json')
        .then((res) => {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then((items) => {
          unitCatalog = (Array.isArray(items) ? items : []).map((item) => {
            const baseName = String(item.imageFile || '').replace(/\.[^.]+$/, '').trim();
            return {
              id: slugify(baseName),
              imagePath: `img/${item.imageFile}`,
              label: baseName
            };
          });
        })
        .catch((error) => {
          console.error('No se pudo cargar el catalogo de unidades (img/index.json):', error);
          unitCatalog = [];
        });
      return unitCatalogPromise;
    };

    if (typeof proyectosRaw === 'undefined') {
      window.proyectosRaw = { raw: [] };
    }

    const getDefaultViewState = () => ({ hojaFilter: '', categoryFilter: '', dynamicFilters: {}, visibleColumnsBySheet: {}, groupByField: 'REGIONES' });
    const createDefaultUnitContext = () => ({ rows: [], rawData: [], fieldDefinitions: [], fieldDefinitionsByName: new Map(), state: getDefaultViewState(), currentTableMode: 'fid' });

    const persistCurrentUnitContext = () => {
      if (!currentUnitId || !unitStore[currentUnitId]) return;
      unitStore[currentUnitId].rows = rows;
      unitStore[currentUnitId].rawData = rawData;
      unitStore[currentUnitId].fieldDefinitions = fieldDefinitions;
      unitStore[currentUnitId].fieldDefinitionsByName = fieldDefinitionsByName;
      unitStore[currentUnitId].state = state;
      unitStore[currentUnitId].currentTableMode = currentTableMode;
    };

    const loadUnitContext = (unitId) => {
      if (!unitStore[unitId]) {
        unitStore[unitId] = createDefaultUnitContext();
      }
      const context = unitStore[unitId];
      rows = context.rows;
      rawData = context.rawData;
      fieldDefinitions = context.fieldDefinitions;
      fieldDefinitionsByName = context.fieldDefinitionsByName;
      state = { ...getDefaultViewState(), ...(context.state || {}) };
      state.pdfLayout = normalizePdfLayout(state.pdfLayout);
      currentTableMode = context.currentTableMode || 'fid';
      currentFilteredRows = rows.slice();
      window.proyectosRaw = { raw: rows };
    };

    const getUnitById = (unitId) => unitCatalog.find((unit) => unit.id === unitId) || null;
    const getDefaultUnit = () => unitCatalog[0] || null;
    const getUnitHash = (unitId) => `#unidad/${unitId}`;

    const showHomeView = () => {
      persistCurrentUnitContext();
      currentUnitId = null;
      document.getElementById('homeSection')?.classList.remove('d-none');
      document.getElementById('appSection')?.classList.add('d-none');
      document.getElementById('btnResetFilters')?.classList.add('d-none');
      document.getElementById('btnGoHome')?.classList.add('d-none');
      document.getElementById('btnOpenPdfDesigner')?.classList.add('d-none');
      document.getElementById('unitShortcutsNavbar')?.classList.add('d-none');
      document.getElementById('activeUnitBanner')?.classList.add('d-none');
      const brand = document.querySelector('.navbar-brand');
      if (brand) brand.textContent = 'Resumen Interactivo - Visor por unidades';
    };

    const renderUnitShortcuts = (activeUnitId) => {
      const container = document.getElementById('unitShortcutsNavbar');
      if (!container) return;
      const otherUnits = unitCatalog.filter((unit) => unit.id !== activeUnitId);
      if (!otherUnits.length) {
        container.innerHTML = '';
        container.classList.add('d-none');
        return;
      }
      container.innerHTML = otherUnits.map((unit) => `
        <a class="unit-shortcut-btn" href="${getUnitHash(unit.id)}" title="${escapeHtml(unit.label)}">
          <img src="${escapeHtml(unit.imagePath)}" alt="${escapeHtml(unit.label)}">
        </a>
      `).join('');
      container.classList.remove('d-none');
    };

    const showUnitView = (unit) => {
      if (!unit) return;
      persistCurrentUnitContext();
      currentUnitId = unit.id;
      loadUnitContext(unit.id);

      const brand = document.querySelector('.navbar-brand');
      if (brand) brand.textContent = 'Resumen Interactivo - Visor por unidades';

      const activeUnitBanner = document.getElementById('activeUnitBanner');
      const activeUnitLabel = document.getElementById('activeUnitLabel');
      if (activeUnitLabel) activeUnitLabel.textContent = unit.label;
      activeUnitBanner?.classList.remove('d-none');

      document.getElementById('homeSection')?.classList.add('d-none');
      document.getElementById('appSection')?.classList.remove('d-none');
      document.getElementById('btnResetFilters')?.classList.remove('d-none');
      document.getElementById('btnGoHome')?.classList.remove('d-none');
      document.getElementById('btnOpenPdfDesigner')?.classList.remove('d-none');
      renderUnitShortcuts(unit.id);
      refreshView();
    };

    const renderHomeUnits = () => {
      const grid = document.getElementById('homeUnitsGrid');
      if (!grid) return;
      grid.innerHTML = unitCatalog.map((unit) => `
        <div class="col-12 col-md-6 col-xl-4">
          <a class="text-decoration-none" href="${getUnitHash(unit.id)}">
            <div class="card unit-card shadow-sm h-100">
              <div class="card-body d-flex flex-column align-items-center justify-content-center text-center gap-3">
                <img src="${escapeHtml(unit.imagePath)}" alt="${escapeHtml(unit.label)}">
                <h6 class="mb-0 text-dark">${escapeHtml(unit.label)}</h6>
              </div>
            </div>
          </a>
        </div>
      `).join('');
    };

    const parseHashRoute = (hashValue) => {
      const hash = String(hashValue || '').trim();
      if (!hash || hash === '#' || hash === '#inicio') return { section: 'home' };
      const unitMatch = hash.match(/^#unidad\/(.+)$/i);
      if (unitMatch) {
        return { section: 'unit', unitId: decodeURIComponent(unitMatch[1]) };
      }
      return { section: 'home' };
    };

    const applyRoute = () => {
      const route = parseHashRoute(window.location.hash);
      if (route.section === 'home') {
        showHomeView();
        return;
      }
      const unit = getUnitById(route.unitId) || getDefaultUnit();
      if (!unit) {
        showHomeView();
        return;
      }
      if (!getUnitById(route.unitId)) {
        window.location.hash = getUnitHash(unit.id);
        return;
      }
      showUnitView(unit);
    };


