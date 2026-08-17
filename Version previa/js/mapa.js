    // ==========================================================================
    // MODULO: MAPA (Leaflet)
    // Construccion del mapa, deteccion de coordenadas, marcadores.
    // ==========================================================================

    const buildMap = () => {
      const container = document.getElementById('map');
      if (!container) return;
      if (!DEPARTAMENTO_GEOJSON || !BOLIVIA_GEOJSON) {
        if (mapGeoDataError) {
          container.innerHTML = '<div class="text-danger small p-3">No se pudo cargar el mapa base. Verifica tu conexión, o que la página se esté sirviendo desde un servidor (no abierta como archivo local).</div>';
          return;
        }
        container.innerHTML = '<div class="text-muted small p-3">Cargando mapa base...</div>';
        loadMapGeoData().then(() => {
          if (document.getElementById('map')) buildMap();
        });
        return;
      }
      if (map) {
        map.remove();
        map = null; 
        markersLayer = null;
        mapBaseLayersControl = null;
      }
      map = L.map(container, { scrollWheelZoom: false }).setView([-17.5, -65.7], 6);
      const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      });
      const esriWorldImageryLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
      });
      osmLayer.addTo(map);
      const departamentoLayer = L.geoJSON(DEPARTAMENTO_GEOJSON, {
        style: { color: '#0d6efd', weight: 2, fillOpacity: 0.03, dashArray: '4' },
        interactive: false
      }).addTo(map);

      // Capas de Regiones/Provincias/Municipios: vacias al inicio, se cargan
      // bajo demanda (fetch a Geojson/<Nivel>/_TODOS.geojson) la primera vez
      // que el usuario las activa en el control de capas, igual que el resto
      // del sitio evita cargar de mas. Quedan en cache una vez cargadas.
      const adminLevelStyles = {
        Regiones: { color: '#7c3aed', weight: 2, fillOpacity: 0 },
        Provincias: { color: '#059669', weight: 1.5, fillOpacity: 0, dashArray: '6 3' },
        Municipios: { color: '#db2777', weight: 1, fillOpacity: 0, dashArray: '2 3' }
      };
      const adminLevelLoaded = { Regiones: false, Provincias: false, Municipios: false };
      const buildAdminLevelLayer = (levelName) => L.geoJSON(null, {
        style: adminLevelStyles[levelName],
        onEachFeature: (feature, layer) => {
          const nombre = feature?.properties?.NOMBRE;
          if (nombre) layer.bindTooltip(String(nombre), { sticky: true });
        }
      });
      const regionesLayer = buildAdminLevelLayer('Regiones');
      const provinciasLayer = buildAdminLevelLayer('Provincias');
      const municipiosLayer = buildAdminLevelLayer('Municipios');
      const adminLevelLayers = { Regiones: regionesLayer, Provincias: provinciasLayer, Municipios: municipiosLayer };

      map.on('overlayadd', (event) => {
        const levelName = event.name;
        const targetLayer = adminLevelLayers[levelName];
        if (!targetLayer || adminLevelLoaded[levelName]) return;
        adminLevelLoaded[levelName] = true;
        fetch(`Geojson/${levelName}/_TODOS.geojson`)
          .then((res) => {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
          })
          .then((data) => targetLayer.addData(data))
          .catch((error) => {
            adminLevelLoaded[levelName] = false;
            console.error(`No se pudo cargar ${levelName}/_TODOS.geojson:`, error);
          });
      });

      mapBaseLayersControl = L.control.layers({
        'Base OSM': osmLayer,
        'Esri World Imagery': esriWorldImageryLayer
      }, {
        'Límite departamental': departamentoLayer,
        'Regiones': regionesLayer,
        'Provincias': provinciasLayer,
        'Municipios': municipiosLayer
      }, { collapsed: false }).addTo(map);
      markersLayer = L.featureGroup().addTo(map);
      highlightLayer = L.featureGroup().addTo(map);
      renderMapHighlightPickers();
      refreshMapHighlightLayer();
      const deptoBounds = departamentoLayer.getBounds();
      if (deptoBounds.isValid()) map.fitBounds(deptoBounds, { padding: [10, 10] });
    };

    // Selector "Resaltar entidades especificas": independiente de los
    // toggles Regiones/Provincias/Municipios de arriba (que muestran TODAS
    // las entidades de un nivel). Aqui se elige una o varias por nombre y se
    // dibujan encima, reutilizando loadSelectedBoundaries (geodata.js) --
    // el mismo mecanismo que usa el widget de mapa del disenador de PDF.
    const MAP_HIGHLIGHT_GROUPS = [
      { key: 'regiones', label: 'Región', options: PDF_MAP_REGIONES, checkboxClass: 'map-highlight-region-checkbox', btnId: 'mapHighlightRegionBtn' },
      { key: 'provincias', label: 'Provincia', options: PDF_MAP_PROVINCIAS, checkboxClass: 'map-highlight-provincia-checkbox', btnId: 'mapHighlightProvinciaBtn' },
      { key: 'municipios', label: 'Municipio', options: PDF_MAP_MUNICIPIOS, checkboxClass: 'map-highlight-municipio-checkbox', btnId: 'mapHighlightMunicipioBtn' }
    ];

    const renderMapHighlightPickers = () => {
      const container = document.getElementById('mapHighlightPickers');
      if (!container) return;
      container.innerHTML = MAP_HIGHLIGHT_GROUPS.map((group) => renderPdfMapPickerDropdown({
        groupKey: group.key,
        groupLabel: group.label,
        options: group.options,
        selectedValues: mapHighlightSelection[group.key],
        checkboxClass: group.checkboxClass,
        scope: 'live',
        emptyLabel: 'ninguna',
        btnId: group.btnId
      })).join('');
    };

    const updateMapHighlightButtonLabel = (groupKey) => {
      const group = MAP_HIGHLIGHT_GROUPS.find((item) => item.key === groupKey);
      const button = group && document.getElementById(group.btnId);
      if (!group || !button) return;
      const count = (mapHighlightSelection[groupKey] || []).length;
      button.textContent = count ? `${group.label} (${count})` : `${group.label} (ninguna)`;
    };

    const refreshMapHighlightLayer = async () => {
      if (!map || !highlightLayer) return;
      highlightLayer.clearLayers();
      const boundaries = await loadSelectedBoundaries({ config: mapHighlightSelection });
      boundaries.forEach((boundary) => {
        L.geoJSON(boundary.geojson, {
          style: { ...boundary.style, fillOpacity: 0.25 },
          onEachFeature: (feature, layer) => {
            const nombre = feature?.properties?.NOMBRE;
            if (nombre) layer.bindTooltip(String(nombre), { sticky: true });
          }
        }).addTo(highlightLayer);
      });
    };

    const syncMapSize = () => {
      const container = document.getElementById('map');
      if (!container) return;
      const width = container.clientWidth;
      if (!width) return;
      container.style.height = `${width}px`;
      if (map) {
        map.invalidateSize();
      }
    };

    const detectCoordinateFields = () => {
      const candidates = ['LATITUD', 'LONGITUD', 'LAT', 'LNG', 'LONGITUDE', 'LONGITUD_E', 'LATITUD_E'];
      const fieldNames = fieldDefinitions.map(field => field.name);
      const latField = candidates.find(candidate => fieldNames.includes(candidate)) || fieldNames.find(name => /^lat/i.test(name)) || fieldNames.find(name => /latitud/i.test(name));
      const lngField = candidates.find(candidate => fieldNames.includes(candidate) && /long|lng/i.test(candidate)) || fieldNames.find(name => /^lng|^lon|long/i.test(name)) || fieldNames.find(name => /longitud/i.test(name));
      return { latField, lngField };
    };

    const isValidCoordinatePair = (lat, lng) => {
      return lat !== null
        && lng !== null
        && Number.isFinite(lat)
        && Number.isFinite(lng)
        && lat !== 0
        && lng !== 0
        && lat >= -90
        && lat <= 90
        && lng >= -180
        && lng <= 180;
    };

    const updateMap = (filteredRows) => {
      syncMapSize();
      if (!map) buildMap();
      if (!markersLayer) return;
      markersLayer.clearLayers();
      const { latField, lngField } = detectCoordinateFields();
      const validPoints = filteredRows.filter(row => {
        const lat = parseNumber(row[latField]);
        const lng = parseNumber(row[lngField]);
        return isValidCoordinatePair(lat, lng);
      });
      if (!validPoints.length) return;
      validPoints.forEach((row) => {
        const lat = parseNumber(row[latField]);
        const lng = parseNumber(row[lngField]);
        const deptoKey = findRowKeyByCandidates(row, ['depto', 'departamento', 'region', 'regiones']);
        const provinciaKey = findRowKeyByCandidates(row, ['provincia']);
        const municipioKey = findRowKeyByCandidates(row, ['municipio']);
        const locationText = [
          deptoKey ? getCellText(row, deptoKey) : '',
          provinciaKey ? getCellText(row, provinciaKey) : '',
          municipioKey ? getCellText(row, municipioKey) : ''
        ].filter(Boolean).join(' - ');
        const estadoKey = findRowKeyByCandidates(row, ['estado', 'estado proyecto', 'estado del proyecto']);
        const estadoValue = estadoKey ? getCellText(row, estadoKey) : '';
        const familiesValue = parseNumber(row[getFamiliesFieldName(row)]);
        const areaValue = getRowNumberByCandidates(row, ['area_riego', 'area de riego', 'superficie_riego', 'superficie de riego']);
        const costoValue = getRowNumberByCandidates(row, ['costo_total_del_proyecto', 'costo total del proyecto', 'costo_total', 'costo']);
        const detailLines = [];
        if (estadoValue) detailLines.push(`<div><strong>Estado:</strong> ${escapeHtml(estadoValue)}</div>`);
        if (costoValue !== null) detailLines.push(`<div><strong>Costo:</strong> ${formatCurrencyValue(costoValue)}</div>`);
        if (areaValue !== null) detailLines.push(`<div><strong>Área de riego:</strong> ${formatAreaValue(areaValue)}</div>`);
        if (familiesValue !== null) detailLines.push(`<div><strong>Familias beneficiadas:</strong> ${formatDecimal(familiesValue)}</div>`);
        const popup = `
          <strong>${getCellText(row, 'NOMBRE') || getCellText(row, 'NOMBRE_DEL_PROYECTO') || 'Registro'}</strong><br>
          ${locationText ? `${escapeHtml(locationText)}<br>` : ''}
          ${detailLines.join('')}
        `;
        L.marker([lat, lng]).bindPopup(popup).addTo(markersLayer);
      });
      const bounds = markersLayer.getBounds();
      if (bounds && bounds.isValid()) map.fitBounds(bounds, { padding: [10, 10] });
    };


