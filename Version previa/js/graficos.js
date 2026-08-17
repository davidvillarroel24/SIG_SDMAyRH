    // ==========================================================================
    // MODULO: GRAFICOS (Chart.js)
    // Paleta y opciones base, construccion de datasets y render de graficos.
    // ==========================================================================

    const GOOGLE_CHART_COLORS = ['#4285F4', '#DB4437', '#F4B400', '#0F9D58', '#46BDC6', '#AB47BC', '#FF7043', '#9E9D24'];

    const getGoogleChartColor = (index = 0) => GOOGLE_CHART_COLORS[index % GOOGLE_CHART_COLORS.length];

    const formatChartNumericValue = (value) => {
      const numeric = parseNumber(value);
      return numeric === null ? String(value ?? '-') : formatDecimal(numeric);
    };

    const getGoogleChartBaseOptions = ({ isDoughnut = false, showLegend = false } = {}) => {
      const basePlugins = {
        legend: {
          display: showLegend,
          position: 'bottom',
          labels: {
            color: '#5f6368',
            boxWidth: 12,
            usePointStyle: true,
            font: { family: 'Roboto, Arial, sans-serif', size: 12 }
          }
        },
        tooltip: {
          backgroundColor: '#ffffff',
          borderColor: '#dadce0',
          borderWidth: 1,
          titleColor: '#202124',
          bodyColor: '#3c4043',
          displayColors: true,
          callbacks: {
            label: (context) => {
              const datasetLabel = context.dataset?.label ? `${context.dataset.label}: ` : '';
              const raw = context.parsed?.y ?? context.parsed ?? context.raw;
              return `${datasetLabel}${formatChartNumericValue(raw)}`;
            }
          }
        }
      };

      if (isDoughnut) {
        return {
          maintainAspectRatio: false,
          cutout: '58%',
          plugins: basePlugins
        };
      }

      return {
        maintainAspectRatio: false,
        plugins: basePlugins,
        scales: {
          x: {
            ticks: {
              color: '#5f6368',
              font: { family: 'Roboto, Arial, sans-serif', size: 14,weight: 'bold' }
            },
            grid: { display: false },
            border: { color: '#dadce0' }
          },
          y: {
            beginAtZero: true,
            ticks: {
              maxTicksLimit: 6,
              color: '#5f6368',
              precision: 0,
              callback: (value) => formatChartNumericValue(value),
              font: { family: 'Roboto, Arial, sans-serif', size: 16 }
            },
            grid: { color: '#eceff1' },
            border: { color: '#dadce0' }
          }
        }
      };
    };

    const destroyCharts = () => {
      chartInstances.forEach((chart) => chart && chart.destroy());
      chartInstances = [];
    };

    const getFamiliesBeneficiadasField = () => {
      return fieldDefinitions.find((field) => normalizeFieldName(field.name) === 'familias_beneficiadas') || null;
    };

    const getChartDataForFamiliesByGroup = (sourceRows) => {
      const grouped = new Map();
      const groupFieldName = getGroupByFieldName();
      const familiesFieldName = getFamiliesFieldName({});
      sourceRows.forEach((row) => {
        const label = getCellText(row, groupFieldName);
        if (!label) return;
        const familiesField = getFamiliesFieldName(row);
        const numericValue = parseNumber(row[familiesField]);
        if (numericValue === null) return;
        grouped.set(label, (grouped.get(label) || 0) + numericValue);
      });
      const labels = Array.from(grouped.keys()).sort((a, b) => grouped.get(b) - grouped.get(a));
      const data = labels.map((label) => grouped.get(label));
      return { labels, data };
    };

    const getChartTypeForField = (field) => {
      const haystack = `${field?.name || ''} ${getFieldLabel(field)}`.toLowerCase();
      if (/(riesgo|licenc|licencia)/i.test(haystack)) return 'doughnut';
      return 'bar';
    };

    const renderCharts = (filteredRows) => {
      const container = document.getElementById('chartsRow');
      if (!container) return;
      destroyCharts();
      const familiesField = getFamiliesBeneficiadasField();
      const listFields = getDynamicFilterFields().filter(field => field.name && !isNumericField(field) && normalizeFieldName(field.name) !== 'familias_beneficiadas');
      const chartCards = [];
      if (familiesField) {
        chartCards.push(`
          <div class="col-12 col-xl-6">
            <div class="card chart-card shadow-sm">
              <div class="card-body">
                <h5 class="card-title">Familias beneficiadas por ${escapeHtml(getGroupByFieldLabel().toLowerCase())}</h5>
                <canvas id="chart-familias-beneficiadas"></canvas>
              </div>
            </div>
          </div>`);
      }
      if (listFields.length) {
        chartCards.push(...listFields.map((field) => `
          <div class="col-12 col-xl-6">
            <div class="card chart-card shadow-sm">
              <div class="card-body">
                <h5 class="card-title">${escapeHtml(getFieldLabel(field))}</h5>
                <canvas id="chart-${slugify(field.name)}"></canvas>
              </div>
            </div>
          </div>
        `));
      }
      if (!chartCards.length) {
        container.innerHTML = '<div class="col-12"><div class="alert alert-secondary">No hay campos tipo Lista para graficar.</div></div>';
        container.classList.remove('has-many-charts');
        return;
      }
      container.innerHTML = chartCards.join('');
      container.classList.toggle('has-many-charts', chartCards.length > 1);

      if (familiesField) {
        const canvas = document.getElementById('chart-familias-beneficiadas');
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const { labels, data } = getChartDataForFamiliesByGroup(filteredRows);
            chartInstances.push(new Chart(ctx, {
              type: 'bar',
              data: {
                labels,
                datasets: [{
                  label: 'Familias beneficiadas',
                  data,
                  backgroundColor: getGoogleChartColor(0),
                  borderColor: getGoogleChartColor(0),
                  borderWidth: 1,
                  borderRadius: 6,
                  maxBarThickness: 34
                }]
              },
              options: getGoogleChartBaseOptions({ isDoughnut: false, showLegend: false })
            }));
          }
        }
      }

      listFields.forEach((field) => {
        const values = filteredRows.map(row => getCellText(row, field.name)).filter(Boolean);
        const counts = {};
        values.forEach((value) => {
          counts[value] = (counts[value] || 0) + 1;
        });
        const labels = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
        const canvas = document.getElementById(`chart-${slugify(field.name)}`);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const chartType = getChartTypeForField(field);
        const baseOptions = getGoogleChartBaseOptions({ isDoughnut: chartType === 'doughnut', showLegend: chartType === 'doughnut' });
        chartInstances.push(new Chart(ctx, {
          type: chartType,
          data: {
            labels,
            datasets: [{
              label: 'Cantidad',
              data: labels.map(label => counts[label]),
              backgroundColor: labels.map((_, idx) => getGoogleChartColor(idx)),
              borderColor: labels.map((_, idx) => getGoogleChartColor(idx)),
              borderWidth: 1,
              borderRadius: chartType === 'bar' ? 6 : 0,
              maxBarThickness: 34
            }]
          },
          options: baseOptions
        }));
      });
    };


