    // ==========================================================================
    // MODULO: DATOS GEOGRAFICOS (Departamento y Bolivia via fetch)
    // Las siluetas ya NO van hardcodeadas en el HTML: se cargan una sola vez
    // desde Geojson/Departamento/COCHABAMBA.geojson y
    // Geojson/Bolivia/Bolivia_Silueta.geojson al iniciar la pagina.
    // Requiere servir el sitio por http(s) -- no funciona abriendo el
    // archivo suelto con file:// (por eso antes iban embebidas).
    // ==========================================================================

    let DEPARTAMENTO_GEOJSON = null;
    let BOLIVIA_GEOJSON = null;
    let mapGeoDataError = false;
    let mapGeoDataPromise = null;

    const loadMapGeoData = () => {
      if (mapGeoDataPromise) return mapGeoDataPromise;
      mapGeoDataPromise = Promise.all([
        fetch('Geojson/Departamento/COCHABAMBA.geojson').then((res) => {
          if (!res.ok) throw new Error('HTTP ' + res.status + ' al cargar el departamento');
          return res.json();
        }),
        fetch('Geojson/Bolivia/Bolivia_Silueta.geojson').then((res) => {
          if (!res.ok) throw new Error('HTTP ' + res.status + ' al cargar Bolivia');
          return res.json();
        })
      ]).then(([depto, bolivia]) => {
        DEPARTAMENTO_GEOJSON = depto;
        BOLIVIA_GEOJSON = bolivia;
      }).catch((error) => {
        mapGeoDataError = true;
        console.error('No se pudieron cargar las siluetas geograficas (Departamento/Bolivia):', error);
      });
      return mapGeoDataPromise;
    };

    const getPolygonRings = (geojson) => {
      const rings = [];
      (geojson?.features || []).forEach((feature) => {
        const geom = feature?.geometry;
        if (!geom) return;
        if (geom.type === 'Polygon') {
          if (geom.coordinates[0]) rings.push(geom.coordinates[0]);
        } else if (geom.type === 'MultiPolygon') {
          geom.coordinates.forEach((polygon) => {
            if (polygon[0]) rings.push(polygon[0]);
          });
        }
      });
      return rings;
    };

    // La primera entrada de "boundaries" es siempre el limite principal:
    // define el encuadre/zoom del mapa. Las siguientes se dibujan encima
    // como referencia adicional (ej. Cochabamba resaltado dentro de Bolivia).
    // Son "getters" (no un objeto literal fijo) para que siempre lean el
    // valor mas reciente de DEPARTAMENTO_GEOJSON/BOLIVIA_GEOJSON una vez
    // que el fetch haya terminado.
    const MAP_SCOPES = {
      get departamento() {
        return {
          boundaries: [
            {
              geojson: DEPARTAMENTO_GEOJSON,
              style: { color: '#0d6efd', weight: 2, fillOpacity: 0.04, dashArray: '4' },
              canvasStroke: '#0b57d0',
              canvasDash: [5, 4]
            }
          ],
          label: 'Depto. Cochabamba',
          fallbackView: { center: [-17.5, -65.7], zoom: 8 }
        };
      },
      get bolivia() {
        return {
          boundaries: [
            {
              geojson: BOLIVIA_GEOJSON,
              style: { color: '#c2410c', weight: 2, fillOpacity: 0.02, dashArray: '4' },
              canvasStroke: '#c2410c',
              canvasDash: [5, 4]
            },
            {
              geojson: DEPARTAMENTO_GEOJSON,
              style: { color: '#0d6efd', weight: 2.5, fillOpacity: 0.18 },
              canvasStroke: '#0b57d0',
              canvasDash: []
            }
          ],
          label: 'Bolivia (Cochabamba resaltado)',
          fallbackView: { center: [-16.7, -64.6], zoom: 5 }
        };
      }
    };

    const getMapScope = (column) => MAP_SCOPES[column?.widgetType === 'map_bolivia' ? 'bolivia' : 'departamento'];

    // Listas hardcodeadas a partir de los nombres de archivo en Geojson\Regiones,
    // Geojson\Provincias y Geojson\Municipios. Alimentan los selectores del
    // widget de mapa; ver loadSelectedBoundaries() mas abajo para el fetch
    // real de las entidades marcadas.
    const PDF_MAP_REGIONES = ['ANDINA', 'CONO_SUR', 'METROPOLITANA', 'TROPICO', 'VALLES'];
    const PDF_MAP_PROVINCIAS = ['ARANI', 'ARQUE', 'AYOPAYA', 'BOLÍVAR', 'CAMPERO', 'CAPINOTA', 'CARRASCO', 'CERCADO', 'CHAPARE', 'ESTEBAN_ARZE', 'GERMAN_JORDAN', 'MIZQUE', 'PUNATA', 'QUILLACOLLO', 'TAPACARI', 'TIRAQUE', 'TOTORA'];
    const PDF_MAP_MUNICIPIOS = ['AIQUILE', 'ALALAY', 'ANZALDO', 'ARANI', 'ARBIETO', 'ARQUE', 'BOLIVAR', 'CAPINOTA', 'CHIMORE', 'CLIZA', 'COCAPATA', 'COCHABAMBA', 'COLCAPIRHUA', 'COLOMI', 'CUCHUMUELA_(V._G.VILLARROEL)', 'ENTRE_RIOS', 'INDEPENDENCIA', 'MIZQUE', 'MOROCHATA', 'OMEREQUE', 'PASORAPA', 'POCONA', 'POJO', 'PUERTO_VILLARROEL', 'PUNATA', 'QUILLACOLLO', 'SACABA', 'SACABAMBA', 'SAN_BENITO', 'SANTIVAÑEZ', 'SHINAOTHA', 'SICAYA', 'SIPESIPE', 'TACACHI', 'TACOPAYA', 'TAPACARI', 'TARATA', 'TIQUIPAYA', 'TIRAQUE', 'TOCO', 'TOLATA', 'TOTORA', 'VACAS', 'VILA_VILA', 'VILLA_RIVERO', 'VILLA_TUNARI', 'VINTO'];

    const formatPickerLabel = (name = '') => String(name).replace(/_/g, ' ');

    const renderPdfMapPickerDropdown = ({ groupKey, groupLabel, options, selectedValues, checkboxClass, attrs = '', scope = 'pdf', emptyLabel = 'todas', btnId = '' }) => {
      const selected = new Set(Array.isArray(selectedValues) ? selectedValues : []);
      const buttonLabel = selected.size ? `${groupLabel} (${selected.size})` : `${groupLabel} (${emptyLabel})`;
      const allSelected = options.length > 0 && options.every((name) => selected.has(name));
      const itemsHtml = options.map((name) => `
        <label class="dropdown-item d-flex align-items-center gap-2 mb-1">
          <input class="form-check-input ${checkboxClass}" type="checkbox" value="${escapeHtml(name)}" ${attrs} ${selected.has(name) ? 'checked' : ''}>
          <span>${escapeHtml(formatPickerLabel(name))}</span>
        </label>
      `).join('');
      return `
        <div class="col-12 col-md-4">
          <label class="form-label">${escapeHtml(groupLabel)}</label>
          <div class="dropdown">
            <button class="btn btn-outline-secondary btn-sm dropdown-toggle w-100" type="button" ${btnId ? `id="${btnId}"` : ''} data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">
              ${escapeHtml(buttonLabel)}
            </button>
            <div class="dropdown-menu p-2" style="max-height: 250px; overflow-y: auto;">
              <label class="dropdown-item d-flex align-items-center gap-2 mb-1 fw-semibold">
                <input class="form-check-input map-picker-select-all" type="checkbox" data-scope="${scope}" data-group="${groupKey}" data-target-class="${checkboxClass}" data-empty-label="${escapeHtml(emptyLabel)}" ${attrs} ${allSelected ? 'checked' : ''}>
                <span>Seleccionar todos</span>
              </label>
              <hr class="my-1">
              ${itemsHtml}
            </div>
          </div>
        </div>`;
    };

    // Carga individual (con cache) de una entidad de Regiones/Provincias/
    // Municipios seleccionada en los checkboxes del widget de mapa, para
    // resaltarla encima del limite base (departamento/Bolivia) al generar
    // la imagen del mapa para el PDF.
    const individualBoundaryCache = new Map();

    const loadIndividualBoundary = (levelFolder, name) => {
      const key = `${levelFolder}/${name}`;
      if (individualBoundaryCache.has(key)) return individualBoundaryCache.get(key);
      const promise = fetch(`Geojson/${levelFolder}/${name}.geojson`)
        .then((res) => {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .catch((error) => {
          console.error(`No se pudo cargar Geojson/${key}.geojson:`, error);
          return null;
        });
      individualBoundaryCache.set(key, promise);
      return promise;
    };

    const SELECTED_BOUNDARY_GROUPS = {
      regiones: { folder: 'Regiones', color: '#7c3aed' },
      provincias: { folder: 'Provincias', color: '#059669' },
      municipios: { folder: 'Municipios', color: '#db2777' }
    };

    const loadSelectedBoundaries = async (column) => {
      const tasks = [];
      Object.entries(SELECTED_BOUNDARY_GROUPS).forEach(([group, { folder, color }]) => {
        const names = Array.isArray(column?.config?.[group]) ? column.config[group] : [];
        names.forEach((name) => {
          tasks.push(
            loadIndividualBoundary(folder, name).then((geojson) => (geojson ? {
              geojson,
              style: { color, weight: 2, fillOpacity: 0.15 },
              canvasStroke: color,
              canvasDash: []
            } : null))
          );
        });
      });
      const results = await Promise.all(tasks);
      return results.filter(Boolean);
    };


