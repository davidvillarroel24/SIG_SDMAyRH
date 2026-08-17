    // ==========================================================================
    // MODULO: ESQUEMA Y CARGA DE DATOS
    // Lee el JSON exportado por el macro de Excel (Hojas/Esquema/Campos/Registros),
    // valida su forma, decodifica el archivo y gestiona los documentos adjuntos.
    // ==========================================================================

    const isSchemaPayload = (value) => value && typeof value === 'object' && Array.isArray(value.Hojas);

    const parseSchemaPayload = (parsed, sourceLabel) => {
      const rows = [];
      const fieldDefinitions = [];
      if (!isSchemaPayload(parsed)) return { rows, fieldDefinitions };

      parsed.Hojas.forEach((sheet, sheetIndex) => {
        const sheetName = String(sheet?.Nombre || `Hoja ${sheetIndex + 1}`).trim();
        const fields = Array.isArray(sheet?.Esquema?.Campos) ? sheet.Esquema.Campos : [];
        fields.forEach((field) => {
          const name = String(field?.Nombre || '').trim();
          if (!name) return;
          fieldDefinitions.push({
            id: String(field?.Id || slugify(name)),
            name,
            label: name,
            tipo: String(field?.Tipo || 'Texto').trim(),
            rol: String(field?.Rol || 'Universal').trim(),
            agregacion: String(field?.Agregacion || 'Ninguna').trim(),
            visibleTabla: field?.VisibleTabla !== false,
            visibleGrafico: field?.VisibleGrafico === true,
            participaResumen: field?.ParticipaResumen === true,
            formato: String(field?.Formato || ''),
            orden: Number(field?.Orden ?? 9999)
          });
        });

        const records = Array.isArray(sheet?.Registros) ? sheet.Registros : [];
        records.forEach((record, index) => {
          const values = record?.Valores && typeof record.Valores === 'object' ? { ...record.Valores } : {};
          const row = { ...values };
          row.__sourceSheet = sheetName;
          row.__sourceLabel = sourceLabel;
          row.__sourceCategory = `${sourceLabel}${sheetName ? ` / ${sheetName}` : ''}`;
          row.__rowId = `${sourceLabel}|${sheetName}|${index + 1}`;
          const documentosKey = Object.keys(record || {}).find((key) => String(key || '').trim().toLowerCase() === 'documentos');
          row.__documentos = documentosKey && Array.isArray(record[documentosKey]) ? record[documentosKey] : [];
          rows.push(row);
        });
      });

      return { rows, fieldDefinitions };
    };

    const getDocumentsFieldKey = (row) => {
      if (!row || typeof row !== 'object') return null;
      return Object.keys(row).find((key) => normalizeFieldName(key) === 'documentos') || null;
    };
    const getDocumentsForRow = (row) => {
      const key = getDocumentsFieldKey(row);
      const docs = key && Array.isArray(row[key]) ? row[key] : (Array.isArray(row.__documentos) ? row.__documentos : []);
      return docs.filter(doc => doc && (doc.URL || doc.url));
    };

    const isProjectLikeObject = (value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
      const keys = Object.keys(value);
      return keys.some(key => {
        const normalizedKey = String(key).trim().toLowerCase();
        return ['categoria', 'fid', 'nombre', 'nombre_del', 'nombre_del_proyecto', 'estado', 'provincia', 'municipio', 'costo total del proyecto'].includes(normalizedKey)
          || /proyecto|categoria|fid|nombre|estado|provincia|municipio/i.test(normalizedKey);
      });
    };

    const extractProjectItems = (value) => {
      if (Array.isArray(value)) {
        const direct = value.filter(isProjectLikeObject);
        if (direct.length) return direct;
        return value.flatMap(item => extractProjectItems(item));
      }
      if (!value || typeof value !== 'object') return [];
      const candidates = [];
      Object.values(value).forEach(candidate => {
        if (Array.isArray(candidate)) {
          candidates.push(...extractProjectItems(candidate));
        } else if (isProjectLikeObject(candidate)) {
          candidates.push(candidate);
        }
      });
      return candidates;
    };

    const registerFieldDefinitions = (definitions) => {
      definitions.forEach((field) => {
        if (!field || !field.name) return;
        const existing = fieldDefinitionsByName.get(field.name);
        if (!existing) {
          fieldDefinitionsByName.set(field.name, field);
          fieldDefinitions.push(field);
        }
      });
      fieldDefinitions.sort((a, b) => (a.orden || 9999) - (b.orden || 9999) || String(a.label || a.name).localeCompare(String(b.label || b.name), 'es'));
    };

    const detectTextEncoding = (buffer) => {
      if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 2) return null;
      const bytes = new Uint8Array(buffer.slice(0, 2));
      if (bytes[0] === 0xFF && bytes[1] === 0xFE) return 'utf-16le';
      if (bytes[0] === 0xFE && bytes[1] === 0xFF) return 'utf-16be';
      return null;
    };

    const stripBom = (text) => {
      if (!text) return text;
      return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
    };

    const decodeText = (buffer, encodings = []) => {
      if (!(buffer instanceof ArrayBuffer)) return null;
      const detected = detectTextEncoding(buffer);
      const tryEncodings = [];
      if (detected) {
        tryEncodings.push(detected);
      }
      tryEncodings.push(...Array.isArray(encodings) ? encodings : [encodings]);
      for (const encoding of tryEncodings) {
        try {
          const decoder = new TextDecoder(encoding, { fatal: true });
          const text = decoder.decode(buffer);
          return stripBom(text);
        } catch (e) {
          // continuar con siguiente codificación
        }
      }
      return null;
    };

    const applyParsedJson = (parsed, sourceLabel = 'JSON') => {
      if (!currentUnitId) {
        throw new Error('Selecciona una unidad antes de cargar JSON.');
      }
      const schemaPayload = parseSchemaPayload(parsed, sourceLabel);
      const schemaRows = schemaPayload.rows;
      const fallbackItems = extractProjectItems(parsed);
      const items = schemaRows.length ? schemaRows : fallbackItems;
      if (!items.length) {
        throw new Error(`No se pudieron encontrar registros válidos en ${sourceLabel}.`);
      }
      const existingIds = new Set(rows.map(row => row.__rowId));
      items.forEach((item) => {
        if (!item.__rowId || !existingIds.has(item.__rowId)) {
          rows.push(item);
          existingIds.add(item.__rowId);
        }
      });
      registerFieldDefinitions(schemaPayload.fieldDefinitions);
      if (!fieldDefinitions.length) {
        registerFieldDefinitions(fallbackItems.map((item) => ({ name: 'Categoria', label: 'Categoría', tipo: 'Lista', orden: 1 })));
      }
      window.proyectosRaw = { raw: rows };
      rawData = rows;
      refreshView();
      persistCurrentUnitContext();
      Swal.fire({ icon: 'success', title: 'JSON cargado', text: `Se añadieron ${items.length} registros y ahora hay ${rows.length} en memoria (${sourceLabel}).` });
    };

    const loadJsonFile = (file, encodings = ['utf-8', 'utf-16le', 'utf-16be', 'windows-1252']) => {
      if (!file) return Promise.reject(new Error('No se proporcionó un archivo válido.'));
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const buffer = reader.result;
          if (!(buffer instanceof ArrayBuffer)) {
            reject(new Error('No se pudo leer el archivo como binario.'));
            return;
          }
          let text = decodeText(buffer, encodings);
          let usedEncoding = null;
          if (text !== null) {
            const detected = detectTextEncoding(buffer);
            usedEncoding = detected || 'utf-8';
          }
          if (text === null) {
            reject(new Error('No se pudo decodificar el archivo con las codificaciones probadas.'));
            return;
          }
          try {
            const parsed = JSON.parse(text);
            resolve({ parsed, sourceLabel: usedEncoding || file.name || 'JSON' });
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = () => reject(new Error('Error leyendo el archivo'));
        reader.readAsArrayBuffer(file);
      });
    };

    const loadJsonFiles = async (files) => {
      const fileList = Array.from(files || []).filter(Boolean);
      if (!fileList.length) return;
      for (const file of fileList) {
        try {
          const { parsed, sourceLabel } = await loadJsonFile(file);
          applyParsedJson(parsed, sourceLabel);
        } catch (error) {
          Swal.fire({ icon: 'error', title: 'Error al leer JSON', text: error.message });
          return;
        }
      }
    };

    const loadJsonUrl = async (url) => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status} - ${response.statusText}`);
        const buffer = await response.arrayBuffer();
        const text = decodeText(buffer, ['utf-8', 'utf-16le', 'utf-16be', 'windows-1252']);
        if (text === null) {
          throw new Error('No se pudo decodificar el contenido JSON desde la URL.');
        }
        const parsed = JSON.parse(text);
        applyParsedJson(parsed, `URL: ${url}`);
      } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error al cargar JSON', text: error.message });
      }
    };

    const initJsonLoader = () => {
      const input = document.getElementById('fileInputJson');
      if (!input) return;
      input.addEventListener('change', async () => {
        if (input.files && input.files.length) {
          await loadJsonFiles(input.files);
          input.value = '';
        }
      });
    };

    // Lista "Biblioteca" de datasets precargados desde proyectos/index.json
    // (generado por generate_manifests.py). Se refresca cada vez que se abre
    // el dropdown, para que muestre siempre lo ultimo que haya en la carpeta.
    const renderProyectosLibraryMenu = () => {
      const menu = document.getElementById('proyectosLibraryMenu');
      if (!menu) return;
      menu.innerHTML = '<div class="text-muted small px-2">Cargando...</div>';
      fetch('proyectos/index.json')
        .then((res) => {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then((items) => {
          const list = Array.isArray(items) ? items : [];
          if (!list.length) {
            menu.innerHTML = '<div class="text-muted small px-2">No hay datasets en proyectos/.</div>';
            return;
          }
          menu.innerHTML = list.map((item) => `
            <button type="button" class="dropdown-item proyectos-library-item" data-file="${escapeHtml(item.file || '')}">${escapeHtml(item.label || item.file || '')}</button>
          `).join('');
        })
        .catch((error) => {
          menu.innerHTML = '<div class="text-danger small px-2">No se pudo cargar la biblioteca.</div>';
          console.error('No se pudo cargar proyectos/index.json:', error);
        });
    };

    const reloadDataFromJson = () => {
      if (!currentUnitId) {
        Swal.fire({ icon: 'warning', title: 'Selecciona una unidad', text: 'Debes ingresar a una unidad antes de cargar archivos JSON.' });
        return;
      }
      const input = document.getElementById('fileInputJson');
      if (!input) {
        Swal.fire({ icon: 'error', title: 'No se encontró el cargador de JSON' });
        return;
      }
      input.click();
    };

    const normalizeDocumentUrl = (url) => {
      if (!url) return '';
      let value = String(url).trim();
      if (/^[a-zA-Z]+:/.test(value) && !value.startsWith('http://') && !value.startsWith('https://') && !value.startsWith('file://')) {
        value = value.replace(/\\/g, '/');
        if (/^[A-Za-z]:\//.test(value)) {
          value = `file:///${value.replace(/^([A-Za-z]):\//, '$1:/')}`;
        }
      }
      return value;
    };

    const openDocumentLink = async (url) => {
      const normalized = normalizeDocumentUrl(url);
      if (!normalized) {
        Swal.fire({ icon: 'warning', title: 'URL inválida', text: 'El documento no tiene una ruta válida.' });
        return;
      }
      const shouldCheck = normalized.startsWith('http://') || normalized.startsWith('https://');
      if (shouldCheck) {
        try {
          const resp = await fetch(normalized, { method: 'HEAD' });
          if (!resp.ok && resp.type !== 'opaque') {
            Swal.fire({ icon: 'error', title: 'No se encontró el documento', text: `No se pudo acceder a: ${normalized}` });
            return;
          }
        } catch (err) {
          Swal.fire({ icon: 'error', title: 'No se encontró el documento', text: `No se pudo acceder a: ${normalized}` });
          return;
        }
      }
      const win = window.open(normalized, '_blank');
      if (!win) {
        Swal.fire({ icon: 'error', title: 'No se pudo abrir el documento', text: 'El navegador bloqueó la apertura en nueva pestaña.' });
      }
    };

    const openDocumentsModal = (row, docs) => {
      const modalTitle = document.getElementById('documentsModalLabel');
      const modalBody = document.getElementById('documentsModalBody');
      if (!modalTitle || !modalBody) return;
      modalTitle.textContent = `Documentos: ${row.NOMBRE_DEL_PROYECTO || row.NOMBRE || 'Registro'}`;
      if (!docs.length) {
        modalBody.innerHTML = '<div class="alert alert-secondary">No hay documentos registrados.</div>';
      } else {
        modalBody.innerHTML = `<div class="list-group">${docs.map((doc, index) => `
          <button type="button" class="list-group-item list-group-item-action doc-link-btn d-flex justify-content-between align-items-center" data-url="${doc.URL || doc.url}">
            <span>${doc.Nombre || doc.Name || doc.nombre || `Documento ${index + 1}`}</span>
            <span class="badge bg-primary">Abrir</span>
          </button>
        `).join('')}</div>`;
      }
      const modalEl = document.getElementById('documentsModal');
      const bsModal = new bootstrap.Modal(modalEl);
      bsModal.show();
    };


