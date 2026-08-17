    // ==========================================================================
    // MODULO: UTILIDADES Y FORMATO
    // Numeros, fechas, moneda, texto: funciones puras, sin estado global.
    // ==========================================================================

    const parseNumber = (value) => {
      if (value === null || value === undefined) return null;
      if (typeof value === 'number') return Number.isFinite(value) ? value : null;
      const text = String(value).trim();
      if (!text) return null;
      const normalized = text.replace(/\s/g, '');
      if (!normalized) return null;
      const hasDot = normalized.includes('.');
      const hasComma = normalized.includes(',');
      let cleaned = normalized;
      if (hasDot && hasComma) {
        const lastDot = normalized.lastIndexOf('.');
        const lastComma = normalized.lastIndexOf(',');
        if (lastDot > lastComma) {
          cleaned = normalized.replace(/\./g, '').replace(/,/g, '.');
        } else {
          cleaned = normalized.replace(/,/g, '');
        }
      } else if (hasComma) {
        cleaned = normalized.replace(/,/g, '.');
      } else {
        cleaned = normalized.replace(/\./g, '');
      }
      const num = parseFloat(cleaned);
      return Number.isFinite(num) ? num : null;
    };

    const parseDate = (value) => {
      if (!value && value !== 0) return null;
      const text = String(value).trim();
      if (!text || text.toUpperCase() === 'N' || text.toUpperCase() === 'N/A') return null;
      const parts = text.split(/[\/\.-]/).map(p => p.trim());
      if (parts.length < 3) return null;
      const [day, month, year] = parts;
      const d = parseInt(day, 10);
      const m = parseInt(month, 10);
      let y = parseInt(year, 10);
      if ([d, m, y].some(v => Number.isNaN(v))) return null;
      if (y < 100) y += 2000;
      const date = new Date(y, m - 1, d);
      return isNaN(date.getTime()) ? null : date;
    };

    const formatMoney = (value) => {
      if (value === null || value === undefined || !Number.isFinite(value)) return '-';
      return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    };

    const formatInteger = (value) => {
      if (value === null || value === undefined || !Number.isFinite(value)) return '-';
      return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(value);
    };

    const formatDecimal = (value) => {
      if (value === null || value === undefined || !Number.isFinite(value)) return '-';
      return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    };

    const formatCurrencyValue = (value) => {
      if (value === null || value === undefined || !Number.isFinite(value)) return '-';
      return `Bs. ${formatMoney(value)}`;
    };

    const formatAreaValue = (value) => {
      if (value === null || value === undefined || !Number.isFinite(value)) return '-';
      return `${formatDecimal(value)} Ha.`;
    };

    const normalizeKeyToken = (value = '') => String(value)
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '');

    const formatValueByField = (field, value) => {
      if (value === null || value === undefined || value === '') return '-';
      if (!field) return String(value);
      if (isCurrencyField(field)) {
        const numeric = parseNumber(value);
        if (numeric !== null) {
          return formatCurrencyValue(numeric);
        }
      }
      if (isAreaField(field)) {
        const numeric = parseNumber(value);
        if (numeric !== null) {
          return formatAreaValue(numeric);
        }
      }
      if (isNumericField(field)) {
        const numeric = parseNumber(value);
        if (numeric !== null) {
          if (field.agregacion === 'Porcentaje') return `${formatDecimal(numeric)} %`;
          return formatDecimal(numeric);
        }
      }
      return String(value);
    };

    const normalizeTableMode = (value) => {
      const normalized = String(value ?? '').trim().toLowerCase();
      if (!normalized) return null;
      const aliases = { fid: 'fid', programtico: 'programatica', programatico: 'programatica', programatica: 'programatica', programática: 'programatica' };
      return aliases[normalized] || null;
    };

    const slugify = (value = '') => String(value).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const uniqueValues = (list) => Array.from(new Set(list.filter(v => v !== undefined && v !== null && String(v).trim()))).sort((a, b) => String(a).localeCompare(b, 'es'));
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

    const isNumericField = (field) => {
      if (!field || !field.tipo) return false;
      return /n[uú]mero|number|decimal|int|float|double/i.test(String(field.tipo));
    };

    const isCurrencyField = (field) => {
      if (!field) return false;
      const tipo = String(field.tipo || '').trim();
      const normalizedName = normalizeFieldName(field.name || '');
      return /moneda|currency/i.test(tipo) || /costo|monto|importe|presupuesto/.test(normalizedName);
    };

    const isAreaField = (field) => {
      if (!field) return false;
      const normalizedName = normalizeFieldName(field.name || '');
      return ['area_riego', 'area de riego', 'superficie_riego', 'superficie de riego'].includes(normalizedName)
        || (/area/.test(normalizedName) && /riego/.test(normalizedName));
    };

    const isListField = (field) => {
      if (!field || !field.tipo) return false;
      return /^lista$/i.test(String(field.tipo).trim());
    };

    const getFieldLabel = (field) => field?.label || field?.name || '';

    const normalizeDisplayValue = (value, fieldName = '') => {
      if (value === null || value === undefined) return '';
      const text = String(value).trim();
      if (!text) return '';
      const normalized = text.replace(/\s+/g, ' ').trim();
      const locationFieldNames = ['provincia', 'municipio', 'region', 'región', 'departamento', 'depto', 'dpto'];
      const isLocationField = fieldName && locationFieldNames.includes(normalizeFieldName(fieldName));
      return isLocationField ? normalized.toUpperCase() : normalized;
    };

    const getCellText = (row, key) => {
      if (!key) return '';
      const value = row[key];
      if (value === null || value === undefined) return '';
      if (Array.isArray(value)) return value.map(item => normalizeDisplayValue(item, key)).join(', ');
      return normalizeDisplayValue(value, key);
    };

    const getCategoryValue = (row) => {
      const candidates = ['Categoria', 'CATEGORIA', 'CATEGORÍA', 'categoria'];
      for (const key of candidates) {
        const value = getCellText(row, key);
        if (value) return value;
      }
      return getCellText(row, '__sourceCategory') || getCellText(row, '__sourceLabel') || 'Sin categoría';
    };

    const normalizeFieldName = (name) => String(name || '').trim().toLowerCase();

